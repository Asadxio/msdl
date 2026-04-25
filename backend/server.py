from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime
import json
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

# Include the router in the main app
app.include_router(api_router)

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


def _collect_tokens(user_ids: list[str]) -> list[str]:
    if firebase_db is None or not user_ids:
        return []
    tokens: list[str] = []
    for uid in user_ids:
        snap = firebase_db.collection("users").document(uid).get()
        if not snap.exists:
            continue
        data = snap.to_dict() or {}
        for token in (data.get("fcm_tokens") or []):
            if isinstance(token, str) and token.strip():
                tokens.append(token.strip())
    return list(set(tokens))


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

    tokens = _collect_tokens(target_user_ids)
    if not tokens:
        return {"ok": True, "sent": 0}

    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=payload.title, body=payload.body),
        data={k: str(v) for k, v in (payload.data or {}).items()},
        tokens=tokens,
    )
    result = messaging.send_each_for_multicast(message)
    return {"ok": True, "sent": result.success_count, "failed": result.failure_count}

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
