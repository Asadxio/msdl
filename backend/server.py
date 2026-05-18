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
import base64
import uuid
from datetime import datetime
import json
import time
import requests
from fastapi import HTTPException, Header
from firebase_admin import auth as firebase_auth, credentials, firestore as admin_firestore, initialize_app, messaging
import firebase_admin
from agora_token_builder import RtcTokenBuilder


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

def _env_list(name: str, default: str = "") -> list[str]:
    raw = os.environ.get(name, default)
    return [v.strip() for v in str(raw).split(",") if v.strip()]


cors_origins = _env_list("CORS_ALLOW_ORIGINS", "http://localhost:8081,http://localhost:19006")
cors_methods = _env_list("CORS_ALLOW_METHODS", "GET,POST,OPTIONS")
cors_headers = _env_list("CORS_ALLOW_HEADERS", "Authorization,Content-Type")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=cors_methods,
    allow_headers=cors_headers,
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


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except (TypeError, ValueError):
        logger.warning("Invalid integer env %s, using %s", name, default)
        return default


AGORA_APP_ID = os.environ.get("AGORA_APP_ID", "").strip()
AGORA_APP_CERTIFICATE = os.environ.get("AGORA_APP_CERTIFICATE", "").strip()
AGORA_RTC_TOKEN_TTL_SECONDS = _env_int("AGORA_RTC_TOKEN_TTL_SECONDS", 900)
AGORA_RECORDING_UID_BASE = _env_int("AGORA_RECORDING_UID_BASE", 1900000000)
AGORA_CUSTOMER_ID = os.environ.get("AGORA_CUSTOMER_ID", "").strip()
AGORA_CUSTOMER_SECRET = os.environ.get("AGORA_CUSTOMER_SECRET", "").strip()
AGORA_RECORDING_VENDOR = _env_int("AGORA_RECORDING_VENDOR", 1)
AGORA_RECORDING_REGION = _env_int("AGORA_RECORDING_REGION", 0)
AGORA_RECORDING_BUCKET = os.environ.get("AGORA_RECORDING_BUCKET", "").strip()
AGORA_RECORDING_ACCESS_KEY = os.environ.get("AGORA_RECORDING_ACCESS_KEY", "").strip()
AGORA_RECORDING_SECRET_KEY = os.environ.get("AGORA_RECORDING_SECRET_KEY", "").strip()


class PushSendRequest(BaseModel):
    title: str
    body: str
    data: dict | None = None
    user_ids: list[str] | None = None
    send_to_all: bool = False


class LiveClassTokenRequest(BaseModel):
    live_class_id: str


class LiveClassRecordingRequest(BaseModel):
    live_class_id: str


def _agora_uid(firebase_uid: str) -> int:
    value = 0
    for char in firebase_uid:
        value = ((value << 5) - value + ord(char)) & 0xFFFFFFFF
    return abs(value % 2147480000) + 1


def _recording_uid(live_class_id: str) -> str:
    return str(AGORA_RECORDING_UID_BASE + (_agora_uid(live_class_id) % 10000000))


def _verify_firebase_request(authorization: str | None) -> tuple[str, str]:
    try:
        decoded = firebase_auth.verify_id_token(_bearer_token(authorization))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid auth token")
    uid = decoded.get("uid", "")
    role = _fetch_user_role(uid)
    if not uid or not role:
        raise HTTPException(status_code=403, detail="Approved user required")
    return uid, role


def _get_live_class(live_class_id: str) -> tuple[admin_firestore.DocumentReference, dict]:
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    safe_id = str(live_class_id or "").strip()
    if not safe_id or len(safe_id) > 128 or "/" in safe_id:
        raise HTTPException(status_code=400, detail="Invalid live_class_id")
    ref = firebase_db.collection("live_classes").document(safe_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Live class not found")
    return ref, snap.to_dict() or {}


def _is_live_class_member(uid: str, role: str, live_class: dict) -> bool:
    if role == "admin":
        return True
    if role == "teacher" and live_class.get("teacher_id") == uid:
        return True
    student_ids = live_class.get("student_ids") or []
    if uid in student_ids:
        return True
    course_id = str(live_class.get("course_id") or "")
    if course_id and firebase_db is not None:
        matches = firebase_db.collection("enrollments")\
            .where("course_id", "==", course_id)\
            .where("user_id", "==", uid)\
            .where("status", "==", "active")\
            .limit(1)\
            .stream()
        return any(True for _ in matches)
    return False


def _require_live_class_access(uid: str, role: str, live_class: dict, require_live: bool = True) -> None:
    if require_live and live_class.get("status") != "live":
        raise HTTPException(status_code=409, detail="Live class is not active")
    if not _is_live_class_member(uid, role, live_class):
        raise HTTPException(status_code=403, detail="Not enrolled for this live class")


def _require_teacher_for_live_class(uid: str, role: str, live_class: dict) -> None:
    if role == "admin":
        return
    if role == "teacher" and live_class.get("teacher_id") == uid:
        return
    raise HTTPException(status_code=403, detail="Teacher/admin access required")


def _build_rtc_token(channel_name: str, agora_uid: int, role: str) -> tuple[str, int]:
    if not AGORA_APP_ID or not AGORA_APP_CERTIFICATE:
        raise HTTPException(status_code=500, detail="Agora credentials are not configured")
    expire_at = int(time.time()) + max(60, min(AGORA_RTC_TOKEN_TTL_SECONDS, 3600))
    rtc_role = (
        getattr(RtcTokenBuilder, "Role_Publisher", 1)
        if role in {"teacher", "admin", "student", "recording"}
        else getattr(RtcTokenBuilder, "Role_Subscriber", 2)
    )
    token = RtcTokenBuilder.buildTokenWithUid(AGORA_APP_ID, AGORA_APP_CERTIFICATE, channel_name, agora_uid, rtc_role, expire_at)
    return token, expire_at


def _agora_auth_headers() -> dict[str, str]:
    if not AGORA_CUSTOMER_ID or not AGORA_CUSTOMER_SECRET:
        raise HTTPException(status_code=500, detail="Agora recording credentials are not configured")
    auth = base64.b64encode(f"{AGORA_CUSTOMER_ID}:{AGORA_CUSTOMER_SECRET}".encode("utf-8")).decode("utf-8")
    return {"Authorization": f"Basic {auth}", "Content-Type": "application/json"}


def _agora_recording_url(path: str) -> str:
    if not AGORA_APP_ID:
        raise HTTPException(status_code=500, detail="Agora App ID is not configured")
    return f"https://api.agora.io/v1/apps/{AGORA_APP_ID}/cloud_recording/{path}"


def _agora_recording_storage_config(live_class_id: str) -> dict:
    missing = [
        name for name, value in {
            "AGORA_RECORDING_BUCKET": AGORA_RECORDING_BUCKET,
            "AGORA_RECORDING_ACCESS_KEY": AGORA_RECORDING_ACCESS_KEY,
            "AGORA_RECORDING_SECRET_KEY": AGORA_RECORDING_SECRET_KEY,
        }.items() if not value
    ]
    if missing:
        raise HTTPException(status_code=500, detail=f"Missing recording storage config: {', '.join(missing)}")
    return {
        "vendor": AGORA_RECORDING_VENDOR,
        "region": AGORA_RECORDING_REGION,
        "bucket": AGORA_RECORDING_BUCKET,
        "accessKey": AGORA_RECORDING_ACCESS_KEY,
        "secretKey": AGORA_RECORDING_SECRET_KEY,
        "fileNamePrefix": ["live_classes", live_class_id],
    }


def _agora_post(path: str, payload: dict) -> dict:
    try:
        response = requests.post(_agora_recording_url(path), headers=_agora_auth_headers(), json=payload, timeout=20)
    except requests.RequestException as exc:
        logger.warning("Agora recording request failed: %s", exc)
        raise HTTPException(status_code=502, detail="Agora recording service unavailable")
    if not response.ok:
        logger.warning("Agora recording request failed %s: %s", response.status_code, response.text[:500])
        raise HTTPException(status_code=502, detail="Agora recording request failed")
    try:
        return response.json()
    except ValueError:
        return {}


def _mark_recording_failed(live_ref: admin_firestore.DocumentReference, existing: dict, error: str) -> None:
    data = {
        **existing,
        "status": "failed",
        "last_error": error[:240],
        "updated_at": admin_firestore.SERVER_TIMESTAMP,
    }
    live_ref.update({"recording": data, "updated_at": admin_firestore.SERVER_TIMESTAMP})
    live_ref.collection("recordings").document("metadata").set(data, merge=True)

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
    if str(data.get("status", "")) != "approved":
        return ""
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



@api_router.post("/live-class/token")
async def issue_live_class_token(payload: LiveClassTokenRequest, authorization: str | None = Header(default=None)):
    uid, role = _verify_firebase_request(authorization)
    live_ref, live_class = _get_live_class(payload.live_class_id)
    _require_live_class_access(uid, role, live_class)
    channel_name = str(live_class.get("channel_name") or "").strip()
    if not channel_name:
        raise HTTPException(status_code=409, detail="Live class channel is missing")
    agora_uid = _agora_uid(uid)
    token, expires_at = _build_rtc_token(channel_name, agora_uid, role)
    live_ref.collection("token_issues").document(uid).set({
        "user_id": uid,
        "role": role,
        "agora_uid": agora_uid,
        "issued_at": admin_firestore.SERVER_TIMESTAMP,
        "expires_at_epoch": expires_at,
    }, merge=True)
    return {
        "ok": True,
        "app_id": AGORA_APP_ID,
        "rtc_token": token,
        "expires_at_epoch": expires_at,
        "agora_uid": agora_uid,
        "channel_name": channel_name,
    }


@api_router.post("/live-class/recording/start")
async def start_live_class_recording(payload: LiveClassRecordingRequest, authorization: str | None = Header(default=None)):
    uid, role = _verify_firebase_request(authorization)
    live_ref, live_class = _get_live_class(payload.live_class_id)
    _require_live_class_access(uid, role, live_class)
    _require_teacher_for_live_class(uid, role, live_class)
    if live_class.get("status") != "live":
        raise HTTPException(status_code=409, detail="Live class is not active")
    recording = live_class.get("recording") or {}
    if recording.get("status") in {"starting", "recording"} and recording.get("resource_id") and recording.get("sid"):
        return {"ok": True, "recording": recording}

    channel_name = str(live_class.get("channel_name") or "").strip()
    if not channel_name:
        raise HTTPException(status_code=409, detail="Live class channel is missing")
    rec_uid = _recording_uid(payload.live_class_id)
    rec_token, rec_expires_at = _build_rtc_token(channel_name, int(rec_uid), "recording")
    starting_data = {
        **recording,
        "status": "starting",
        "provider": "agora_cloud_recording",
        "uid": rec_uid,
        "started_by": uid,
        "updated_at": admin_firestore.SERVER_TIMESTAMP,
    }
    live_ref.update({"recording": starting_data, "updated_at": admin_firestore.SERVER_TIMESTAMP})
    live_ref.collection("recordings").document("metadata").set(starting_data, merge=True)
    acquire_payload = {"cname": channel_name, "uid": rec_uid, "clientRequest": {"resourceExpiredHour": 24}}
    try:
        acquire_response = _agora_post("acquire", acquire_payload)
    except HTTPException as exc:
        _mark_recording_failed(live_ref, starting_data, str(exc.detail))
        raise
    resource_id = acquire_response.get("resourceId")
    if not resource_id:
        _mark_recording_failed(live_ref, starting_data, "Agora did not return recording resourceId")
        raise HTTPException(status_code=502, detail="Agora did not return recording resourceId")

    start_payload = {
        "cname": channel_name,
        "uid": rec_uid,
        "clientRequest": {
            "token": rec_token,
            "recordingConfig": {
                "channelType": 0,
                "streamTypes": 2,
                "audioProfile": 1,
                "videoStreamType": 0,
                "maxIdleTime": 120,
                "transcodingConfig": {
                    "width": 1280,
                    "height": 720,
                    "fps": 15,
                    "bitrate": 2260,
                    "mixedVideoLayout": 1,
                    "backgroundColor": "#07130D",
                },
            },
            "recordingFileConfig": {"avFileType": ["hls", "mp4"]},
            "storageConfig": _agora_recording_storage_config(payload.live_class_id),
        },
    }
    try:
        start_response = _agora_post(f"resourceid/{resource_id}/mode/mix/start", start_payload)
    except HTTPException as exc:
        _mark_recording_failed(live_ref, {**starting_data, "resource_id": resource_id}, str(exc.detail))
        raise
    sid = start_response.get("sid")
    if not sid:
        _mark_recording_failed(live_ref, {**starting_data, "resource_id": resource_id}, "Agora did not return recording sid")
        raise HTTPException(status_code=502, detail="Agora did not return recording sid")
    server_response = start_response.get("serverResponse") or {}
    file_list = server_response.get("fileList") if isinstance(server_response, dict) else None
    playback_url = ""
    if isinstance(file_list, list) and file_list:
        file_name = str(file_list[0].get("fileName") or "")
        if file_name and AGORA_RECORDING_BUCKET:
            playback_url = f"https://{AGORA_RECORDING_BUCKET}.s3.amazonaws.com/{file_name}"
    recording_data = {
        "status": "recording",
        "provider": "agora_cloud_recording",
        "resource_id": resource_id,
        "sid": sid,
        "uid": rec_uid,
        "token_expires_at_epoch": rec_expires_at,
        "playback_url": playback_url,
        "storage_path": f"live_classes/{payload.live_class_id}",
        "started_by": uid,
        "started_at": admin_firestore.SERVER_TIMESTAMP,
        "updated_at": admin_firestore.SERVER_TIMESTAMP,
    }
    live_ref.update({"recording": recording_data, "updated_at": admin_firestore.SERVER_TIMESTAMP})
    live_ref.collection("recordings").document("metadata").set(recording_data, merge=True)
    return {"ok": True, "recording": {k: v for k, v in recording_data.items() if k not in {"started_at", "updated_at"}}}


@api_router.post("/live-class/recording/stop")
async def stop_live_class_recording(payload: LiveClassRecordingRequest, authorization: str | None = Header(default=None)):
    uid, role = _verify_firebase_request(authorization)
    live_ref, live_class = _get_live_class(payload.live_class_id)
    _require_live_class_access(uid, role, live_class, require_live=False)
    _require_teacher_for_live_class(uid, role, live_class)
    recording = live_class.get("recording") or {}
    resource_id = str(recording.get("resource_id") or "").strip()
    sid = str(recording.get("sid") or "").strip()
    rec_uid = str(recording.get("uid") or _recording_uid(payload.live_class_id))
    channel_name = str(live_class.get("channel_name") or "").strip()
    if not channel_name:
        raise HTTPException(status_code=409, detail="Live class channel is missing")
    if not resource_id or not sid:
        raise HTTPException(status_code=409, detail="Recording is not active")
    stop_payload = {"cname": channel_name, "uid": rec_uid, "clientRequest": {}}
    stop_response = _agora_post(f"resourceid/{resource_id}/sid/{sid}/mode/mix/stop", stop_payload)
    server_response = stop_response.get("serverResponse") or {}
    file_list = server_response.get("fileList") if isinstance(server_response, dict) else []
    playback_url = str(recording.get("playback_url") or "")
    if isinstance(file_list, list) and file_list:
        file_name = str(file_list[0].get("fileName") or "")
        if file_name and AGORA_RECORDING_BUCKET:
            playback_url = f"https://{AGORA_RECORDING_BUCKET}.s3.amazonaws.com/{file_name}"
    recording_data = {
        **recording,
        "status": "ready" if playback_url else "processing",
        "playback_url": playback_url,
        "file_list": file_list if isinstance(file_list, list) else [],
        "stopped_by": uid,
        "stopped_at": admin_firestore.SERVER_TIMESTAMP,
        "updated_at": admin_firestore.SERVER_TIMESTAMP,
    }
    live_ref.update({"recording": recording_data, "updated_at": admin_firestore.SERVER_TIMESTAMP})
    live_ref.collection("recordings").document("metadata").set(recording_data, merge=True)

    if playback_url:
        existing = list(firebase_db.collection("recordings")
            .where("live_class_id", "==", payload.live_class_id)
            .limit(1)
            .stream())
        recording_doc = existing[0].reference if existing else firebase_db.collection("recordings").document()
        recording_doc.set({
            "title": live_class.get("title") or "Live Class Recording",
            "description": "Cloud recording from live class",
            "file_url": playback_url,
            "course_id": live_class.get("course_id") or "",
            "lesson_id": live_class.get("lesson_id") or "",
            "live_class_id": payload.live_class_id,
            "provider": "agora_cloud_recording",
            "created_by": live_class.get("teacher_name") or "teacher",
            "created_at": admin_firestore.SERVER_TIMESTAMP,
            "updated_at": admin_firestore.SERVER_TIMESTAMP,
        }, merge=True)
    return {"ok": True, "recording": {k: v for k, v in recording_data.items() if not k.endswith("_at")}}


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

    # Non-admin push guard: allow chat participant pushes and teacher-owned live-class start pushes.
    if not is_admin:
        event_type = str((payload.data or {}).get("type", "")).strip()
        if event_type in {"chat_message", "chat_broadcast"}:
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
        elif event_type == "live_class_started" and requester_role in {"teacher", "admin"}:
            live_class_id = str((payload.data or {}).get("live_class_id", "")).strip()
            if not live_class_id:
                raise HTTPException(status_code=403, detail="Live class push requires class context")
            class_snap = firebase_db.collection("live_classes").document(live_class_id).get()
            if not class_snap.exists:
                raise HTTPException(status_code=404, detail="Live class not found")
            class_data = class_snap.to_dict() or {}
            if class_data.get("teacher_id") != requester_uid and requester_role != "admin":
                raise HTTPException(status_code=403, detail="Not allowed to push for this live class")
            allowed_students = set(class_data.get("student_ids") or [])
            for uid in target_user_ids:
                if uid not in allowed_students:
                    raise HTTPException(status_code=403, detail="Recipient outside live class enrollment")
        else:
            raise HTTPException(status_code=403, detail="Non-admin push is restricted to chat and live-class notifications")

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
