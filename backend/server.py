from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
from urllib import request as urlrequest
import uuid
from datetime import datetime
import json
import time
from fastapi import HTTPException, Header
from firebase_admin import auth as firebase_auth, credentials, firestore as admin_firestore, initialize_app, messaging
import firebase_admin


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def _init_firebase_admin():
    if firebase_admin._apps:
        return

    service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if service_account_json:
        cred = credentials.Certificate(json.loads(service_account_json))
        initialize_app(cred)
        return

    service_account_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if service_account_path:
        cred = credentials.Certificate(service_account_path)
        initialize_app(cred)
        return

    raise RuntimeError("Firebase admin credentials not configured")


try:
    _init_firebase_admin()
    firebase_db = admin_firestore.client()
except Exception as exc:
    firebase_db = None
    logger.warning("Firebase Admin not initialized: %s", exc)


class PushSendRequest(BaseModel):
    title: str
    body: str
    data: dict | None = None
    user_ids: list[str] | None = None
    send_to_all: bool = False


def _bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")
    return authorization.split(" ", 1)[1].strip()


def _fetch_user_role(uid: str) -> str:
    if firebase_db is None:
        return ""
    snap = firebase_db.collection("users").document(uid).get()
    if not snap.exists:
        return ""
    data = snap.to_dict() or {}
    return str(data.get("role", ""))


def _dedupe(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))


def _collect_tokens(user_ids: list[str]) -> tuple[list[str], list[str], dict[str, list[str]]]:
    if firebase_db is None or not user_ids:
        return [], [], {}
    fcm_tokens: list[str] = []
    expo_tokens: list[str] = []
    token_owners: dict[str, list[str]] = {}
    for uid in user_ids:
        snap = firebase_db.collection("users").document(uid).get()
        if not snap.exists:
            continue
        data = snap.to_dict() or {}
        for token in (data.get("fcm_tokens") or []):
            if isinstance(token, str) and token.strip():
                safe_token = token.strip()
                fcm_tokens.append(safe_token)
                token_owners[safe_token] = token_owners.get(safe_token, []) + [uid]
        for token in (data.get("expo_push_tokens") or []):
            if isinstance(token, str) and token.strip():
                safe_token = token.strip()
                expo_tokens.append(safe_token)
                token_owners[safe_token] = token_owners.get(safe_token, []) + [uid]
    return _dedupe(fcm_tokens), _dedupe(expo_tokens), token_owners


def _remove_token_from_users(token: str, owners: dict[str, list[str]], field: str) -> None:
    if firebase_db is None or not token:
        return
    for uid in owners.get(token, []):
        try:
            firebase_db.collection("users").document(uid).update({
                field: admin_firestore.ArrayRemove([token]),
                "fcm_token_updated_at": admin_firestore.SERVER_TIMESTAMP,
            })
        except Exception as exc:
            logger.warning("Failed cleaning push token for %s: %s", uid, exc)


def _post_expo_json(url: str, payload: dict | list) -> dict:
    req = urlrequest.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    with urlrequest.urlopen(req, timeout=15) as response:
        return json.loads(response.read().decode("utf-8") or "{}")


def _chunked(values: list, size: int):
    for index in range(0, len(values), size):
        yield values[index:index + size]


def _send_expo_push(tokens: list[str], payload: PushSendRequest, token_owners: dict[str, list[str]]) -> dict:
    valid_tokens = [token for token in tokens if token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")]
    invalid_tokens = [token for token in tokens if token not in valid_tokens]
    for token in invalid_tokens:
        _remove_token_from_users(token, token_owners, "expo_push_tokens")
    if not valid_tokens:
        return {"sent": 0, "failed": len(invalid_tokens), "stale_removed": len(invalid_tokens), "retried": 0}

    sent = 0
    failed = len(invalid_tokens)
    stale_removed = len(invalid_tokens)
    retried = 0
    receipt_ids: list[str] = []
    retry_messages: list[dict] = []

    for token_batch in _chunked(valid_tokens, 100):
        messages = [{
            "to": token,
            "title": payload.title,
            "body": payload.body,
            "data": payload.data or {},
            "sound": "default",
            "channelId": str((payload.data or {}).get("channelId") or "default"),
        } for token in token_batch]
        try:
            response = _post_expo_json("https://exp.host/--/api/v2/push/send", messages)
        except Exception as exc:
            logger.warning("Expo push send failed, scheduling retry: %s", exc)
            retry_messages.extend(messages)
            continue

        tickets = response.get("data") or []
        for message, ticket in zip(messages, tickets):
            status = ticket.get("status")
            if status == "ok" and ticket.get("id"):
                sent += 1
                receipt_ids.append(ticket["id"])
                continue
            failed += 1
            error = ((ticket.get("details") or {}).get("error") or "")
            if error == "DeviceNotRegistered":
                stale_removed += 1
                _remove_token_from_users(message["to"], token_owners, "expo_push_tokens")
            elif error in {"MessageRateExceeded", "ExpoError", "PushTooManyExperienceIds"}:
                retry_messages.append(message)

    if receipt_ids:
        time.sleep(1.25)
        for receipt_batch in _chunked(receipt_ids, 300):
            try:
                receipts_response = _post_expo_json("https://exp.host/--/api/v2/push/getReceipts", {"ids": receipt_batch})
            except Exception as exc:
                logger.warning("Expo receipt polling failed: %s", exc)
                continue
            receipts = receipts_response.get("data") or {}
            for receipt in receipts.values():
                if receipt.get("status") == "ok":
                    continue
                failed += 1
                error = ((receipt.get("details") or {}).get("error") or "")
                if error == "DeviceNotRegistered":
                    stale_removed += 1
                    # Receipts do not include the token, so ticket-level cleanup remains the primary stale-token path.

    if retry_messages:
        retried = len(retry_messages)
        try:
            retry_response = _post_expo_json("https://exp.host/--/api/v2/push/send", retry_messages[:100])
            sent += sum(1 for ticket in (retry_response.get("data") or []) if ticket.get("status") == "ok")
        except Exception as exc:
            logger.warning("Expo push retry failed: %s", exc)

    return {"sent": sent, "failed": failed, "stale_removed": stale_removed, "retried": retried}



@api_router.post("/push/send")
async def send_push(payload: PushSendRequest, authorization: str | None = Header(default=None)):
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Push service not configured")

    try:
        decoded = firebase_auth.verify_id_token(_bearer_token(authorization))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    requester_uid = decoded.get("uid", "")
    requester_role = _fetch_user_role(requester_uid)
    is_admin = requester_role == "admin"

    if payload.send_to_all and not is_admin:
        raise HTTPException(status_code=403, detail="Admin required for broadcast push")

    target_user_ids = list(set(payload.user_ids or []))
    if payload.send_to_all:
        user_docs = firebase_db.collection("users").stream()
        target_user_ids = [d.id for d in user_docs]

    if not target_user_ids:
        return {"ok": True, "sent": 0}

    # Non-admin push guard: only chat notifications are allowed and user can notify only participants of their own chat.
    if not is_admin:
        event_type = str((payload.data or {}).get("type", "")).strip()
        if event_type not in {"chat_message", "chat_broadcast"}:
            raise HTTPException(status_code=403, detail="Non-admin push is restricted to chat notifications")
        chat_id = str((payload.data or {}).get("chat_id", "")).strip()
        if not chat_id:
            raise HTTPException(status_code=403, detail="Non-admin push requires chat context")
        chat_snap = firebase_db.collection("chats").document(chat_id).get()
        if not chat_snap.exists:
            raise HTTPException(status_code=404, detail="Chat not found")
        chat_data = chat_snap.to_dict() or {}
        participants = chat_data.get("participants") or []
        if requester_uid not in participants:
            raise HTTPException(status_code=403, detail="Not allowed to push for this chat")
        for uid in target_user_ids:
            if uid not in participants:
                raise HTTPException(status_code=403, detail="Recipient outside chat participants")

    tokens, expo_tokens, token_owners = _collect_tokens(target_user_ids)
    if not tokens and not expo_tokens:
        return {"ok": True, "sent": 0}

    result = None
    if tokens:
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=payload.title, body=payload.body),
            data={k: str(v) for k, v in (payload.data or {}).items()},
            tokens=tokens,
        )
        result = messaging.send_each_for_multicast(message)
    expo_result = _send_expo_push(expo_tokens, payload, token_owners)
    stale_codes = {
        "messaging/registration-token-not-registered",
        "messaging/invalid-registration-token",
    }
    stale_tokens: list[str] = []
    if result:
        for idx, response in enumerate(result.responses):
            if response.success:
                continue
            code = getattr(response.exception, "code", "") or ""
            if code in stale_codes and idx < len(tokens):
                stale_tokens.append(tokens[idx])
    if stale_tokens:
        for token in stale_tokens:
            _remove_token_from_users(token, token_owners, "fcm_tokens")
    return {
        "ok": True,
        "sent": (result.success_count if result else 0) + expo_result["sent"],
        "failed": (result.failure_count if result else 0) + expo_result["failed"],
        "stale_removed": len(stale_tokens) + expo_result["stale_removed"],
        "expo_retried": expo_result["retried"],
    }


# Include routes after every endpoint has been attached to the router.
app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
