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
from fastapi import HTTPException, Header, Request
from firebase_admin import auth as firebase_auth, credentials, firestore as admin_firestore, initialize_app, messaging
import firebase_admin
from agora_token_builder import RtcTokenBuilder
from services.provider_receipt_normalizer import normalize_expo_receipt_status
from services.push_receipt_ingestion import poll_push_receipts
from services.notification_aggregation import aggregate_notification_health
from services.provider_router import route_tokens
from services.token_health_engine import update_token_registry
from services.fanout_worker import process_queue_once
from services.stale_lease_reclaimer import reclaim_stale_leases
from services.worker_scheduler import run_scheduler_tick
from services.provider_weight_engine import update_provider_weight
from security.rateLimiter import allow as allow_rate
from security.securityLogs import log_security_event
from security.quizSecurity import attempt_key, is_attempt_expired


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
@app.get("/health")
async def health():
    return {"status": "ok"}

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

ALLOWED_ADMIN_ORIGINS = set(_env_list("ADMIN_ALLOWED_ORIGINS", ""))
SECURITY_EVENT_RATE: dict[str, list[float]] = {}
NONCE_CACHE: dict[str, float] = {}


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return fwd or (request.client.host if request.client else "unknown")


def _validate_admin_origin(request: Request) -> None:
    if not ALLOWED_ADMIN_ORIGINS:
        return
    origin = request.headers.get("origin", "")
    if origin and origin not in ALLOWED_ADMIN_ORIGINS:
        _log_security_event("admin_origin_blocked", {"origin": origin, "ip": _client_ip(request)})
        raise HTTPException(status_code=403, detail="Forbidden origin")


def _enforce_rate_limit(key: str, limit_count: int, window_sec: int) -> None:
    now = time.time()
    bucket = [t for t in SECURITY_EVENT_RATE.get(key, []) if now - t <= window_sec]
    if len(bucket) >= limit_count:
        _log_security_event("failed_admin_rate_limit", {"key": key, "window_sec": window_sec, "count": len(bucket)})
        raise HTTPException(status_code=429, detail="Too many privileged requests")
    bucket.append(now)
    SECURITY_EVENT_RATE[key] = bucket


def _enforce_nonce(request: Request, uid: str) -> None:
    nonce = request.headers.get("x-action-nonce", "").strip()
    if not nonce:
        raise HTTPException(status_code=400, detail="Missing action nonce")
    key = f"{uid}:{nonce}"
    now = time.time()
    last = NONCE_CACHE.get(key, 0)
    if now - last < 300:
        raise HTTPException(status_code=409, detail="Replay detected")
    NONCE_CACHE[key] = now


def _classify_security_severity(event: str, payload: dict) -> str:
    e = str(event)
    if "mass_delete" in e or "role_escalation" in e:
        return "critical"
    if "denied" in e or "failed" in e:
        return "high"
    if "moderation" in e or "anomaly" in e:
        return "medium"
    return "low"


def _log_security_event(event: str, payload: dict) -> None:
    severity = _classify_security_severity(event, payload)
    logger.warning("SECURITY_EVENT %s severity=%s %s", event, severity, json.dumps(payload, ensure_ascii=False))
    if firebase_db is not None:
        firebase_db.collection("security_events_immutable").add({
            "event": event,
            "severity": severity,
            "payload": payload,
            "created_at": admin_firestore.SERVER_TIMESTAMP,
            "created_at_ms": int(time.time() * 1000),
        })


def _require_capability(request: Request, authorization: str | None, allowed_roles: set[str], action: str, confirm: str | None = None) -> tuple[str, str]:
    uid, role = _verify_firebase_request(authorization)
    _validate_admin_origin(request)
    _enforce_rate_limit(f"{uid}:{action}", 30, 60)
    _enforce_nonce(request, uid)
    if confirm and request.headers.get("x-action-confirm", "") != confirm:
        raise HTTPException(status_code=400, detail="Action confirmation required")
    if role not in allowed_roles:
        _log_security_event("capability_denied", {"uid": uid, "role": role, "action": action, "ip": _client_ip(request)})
        raise HTTPException(status_code=403, detail="Insufficient privileges")
    _log_security_event("capability_granted", {"uid": uid, "role": role, "action": action, "ip": _client_ip(request), "ua": request.headers.get("user-agent", "")[:120]})
    return uid, role



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
    priority: int = 5


class LiveClassTokenRequest(BaseModel):
    live_class_id: str


class LiveClassRecordingRequest(BaseModel):
    live_class_id: str

class CallTokenRequest(BaseModel):
    call_id: str


class QueueEnqueueRequest(BaseModel):
    dedupe_id: str
    event: str
    channel: str
    payload: dict
    recipients: list[str] = []
    priority: int = 5
    max_attempts: int = 5
    scheduled_at: int | None = None
    region: str = "global"
    routing_zone: str = "default"
    canary_percentage: int = 0
    experiment_id: str = ""
class CallCleanupRequest(BaseModel):
    call_id: str
    cleanup_reason: str = "scheduler_stale_timeout"


class StatusReactRequest(BaseModel):
    status_id: str
    reaction: str


class StatusCommentRequest(BaseModel):
    status_id: str
    text: str


class QuizSubmitRequest(BaseModel):
    quiz_id: str
    nonce: str
    started_at_ms: int
    score: int
    total_questions: int


class LiveOpsEventRequest(BaseModel):
    event: str
    class_id: str = ""
    user_role: str = "unknown"
    participant_count: int = 0
    reconnect_phase: str = ""
    device_tier: str = ""
    error: str | None = None
    attempt: int | None = None
    latency_ms: int | None = None
    timestamp_ms: int | None = None


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


def _is_call_finalized(status: str) -> bool:
    return status in {"ended", "declined", "missed", "failed"}


def _normalize_cleanup_reason(reason: str) -> str:
    cleaned = str(reason or "").strip().lower().replace(" ", "_")
    return cleaned[:64] if cleaned else "scheduler_stale_timeout"


@api_router.post("/live-ops/event")
async def ingest_live_ops_event(payload: LiveOpsEventRequest):
    data = payload.dict()
    data["received_at"] = int(time.time() * 1000)
    logger.info("LIVE_OPS_EVENT %s", json.dumps(data, ensure_ascii=False))
    return {"ok": True}


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



APP_ROLES = {"super_admin", "admin", "moderator", "teacher", "assistant_teacher", "student"}
ROLE_RANK = {"student": 10, "assistant_teacher": 30, "teacher": 40, "moderator": 60, "admin": 80, "super_admin": 100}


def _normalize_role(value: str | None) -> str:
    role = str(value or "").strip().lower()
    if role in APP_ROLES:
        return role
    _log_security_event("invalid_role_payload", {"role": str(value or "")[:64]})
    return "student"


def _can_assign_role(actor_role: str, current_target_role: str, next_role: str, actor_uid: str = "", target_uid: str = "") -> bool:
    actor = _normalize_role(actor_role)
    current = _normalize_role(current_target_role)
    nxt = _normalize_role(next_role)
    if actor_uid and target_uid and actor_uid == target_uid:
        return False
    if actor == "super_admin":
        return True
    if actor == "admin":
        return nxt in {"student", "teacher"} and current not in {"admin", "super_admin"}
    return False

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


def _token_platform(token: str) -> str:
    t = str(token or "")
    if t.startswith("ExponentPushToken[") or t.startswith("ExpoPushToken["):
        return "expo"
    if ":" in t and len(t) > 80:
        return "android"
    return "ios"


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


def _send_expo_push(tokens: list[str], payload: PushSendRequest, token_owners: dict[str, list[str]], dedupe_id: str = "") -> dict:
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
                if firebase_db is not None and dedupe_id:
                    owners = token_owners.get(message["to"], [])
                    for owner_uid in owners:
                        firebase_db.collection("notification_provider_receipts").document(f"{ticket['id']}:{owner_uid}").set({
                            "provider": "expo",
                            "provider_ticket_id": ticket["id"],
                            "dedupe_id": dedupe_id,
                            "recipient_id": owner_uid,
                            "resolved": False,
                            "sent_at_ms": int(time.time() * 1000),
                            "created_at": admin_firestore.SERVER_TIMESTAMP,
                        }, merge=True)
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


@api_router.post("/call/token")
async def issue_call_token(payload: CallTokenRequest, authorization: str | None = Header(default=None)):
    uid, role = _verify_firebase_request(authorization)
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    call_id = str(payload.call_id or "").strip()
    call_ref = firebase_db.collection("calls").document(call_id)
    call_snap = call_ref.get()
    if not call_snap.exists:
        raise HTTPException(status_code=404, detail="Call not found")
    call_data = call_snap.to_dict() or {}
    status = str(call_data.get("status") or "")
    if _is_call_finalized(status):
        raise HTTPException(status_code=409, detail="Call already finalized")
    caller_id = str(call_data.get("caller_id") or "")
    callee_id = str(call_data.get("callee_id") or "")
    if uid not in {caller_id, callee_id} and role != "admin":
        raise HTTPException(status_code=403, detail="No call access")
    channel_name = str(call_data.get("channel_name") or "").strip()
    if not channel_name:
        raise HTTPException(status_code=409, detail="Call channel is missing")
    agora_uid = _agora_uid(uid)
    expire_at = int(time.time()) + max(60, min(600, AGORA_RTC_TOKEN_TTL_SECONDS))
    rtc_role = getattr(RtcTokenBuilder, "Role_Publisher", 1)
    token = RtcTokenBuilder.buildTokenWithUid(AGORA_APP_ID, AGORA_APP_CERTIFICATE, channel_name, agora_uid, rtc_role, expire_at)
    return {
        "ok": True,
        "app_id": AGORA_APP_ID,
        "rtc_token": token,
        "expires_at_epoch": expire_at,
        "agora_uid": agora_uid,
        "channel_name": channel_name,
    }


@api_router.post("/call/cleanup")
async def cleanup_call(payload: CallCleanupRequest, authorization: str | None = Header(default=None)):
    uid, role = _verify_firebase_request(authorization)
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    if role not in {"admin", "teacher"}:
        raise HTTPException(status_code=403, detail="Admin/teacher access required")
    call_id = str(payload.call_id or "").strip()
    if not call_id:
        raise HTTPException(status_code=400, detail="call_id is required")
    reason = _normalize_cleanup_reason(payload.cleanup_reason)
    call_ref = firebase_db.collection("calls").document(call_id)
    tx = firebase_db.transaction()

    @admin_firestore.transactional
    def _apply(transaction):
        snap = call_ref.get(transaction=transaction)
        if not snap.exists:
            return {"ok": True, "changed": False, "state": "missing"}
        data = snap.to_dict() or {}
        status = str(data.get("status") or "")
        if data.get("finalized_at") or _is_call_finalized(status):
            return {"ok": True, "changed": False, "state": status or "finalized"}
        next_state = "missed" if status in {"ringing", "initiating", "connecting"} else "ended"
        transaction.update(call_ref, {
            "status": next_state,
            "finalized_at": admin_firestore.SERVER_TIMESTAMP,
            "updated_at": admin_firestore.SERVER_TIMESTAMP,
            "termination_reason": "heartbeat_timeout" if "heartbeat" in reason else "network_failure",
            "cleanup_reason": reason,
            "cleanup_source": "backend_scheduler",
            "cleanup_by": uid,
        })
        return {"ok": True, "changed": True, "state": next_state}
    result = _apply(tx)
    logger.info("CALL_CLEANUP %s", json.dumps({"call_id": call_id, "result": result, "reason": reason}, ensure_ascii=False))
    return result


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

    dedupe_id = str((payload.data or {}).get("push_dedupe_id", "")).strip()
    if dedupe_id:
        dedupe_ref = firebase_db.collection("push_dedupe").document(dedupe_id)
        dedupe_snap = dedupe_ref.get()
        if dedupe_snap.exists:
            return {"ok": True, "sent": 0, "deduped": True}
        dedupe_ref.set({
            "created_at": admin_firestore.SERVER_TIMESTAMP,
            "requester_uid": requester_uid,
            "event_type": str((payload.data or {}).get("type", "")),
            "target_count": len(target_user_ids),
        }, merge=True)

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
            muted_by = set(chat_data.get("muted_by") or [])
            if muted_by:
                target_user_ids = [uid for uid in target_user_ids if uid not in muted_by]
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
    grouped = route_tokens(tokens + expo_tokens)
    if grouped.get("unknown"):
        logger.warning("[provider_health_warning] unknown_token_format=%s", len(grouped.get("unknown") or []))
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
    expo_result = _send_expo_push(expo_tokens, payload, token_owners, dedupe_id)
    stale_codes = {
        "messaging/registration-token-not-registered",
        "messaging/invalid-registration-token",
    }
    stale_tokens: list[str] = []
    if result:
        for idx, response in enumerate(result.responses):
            if response.success:
                if idx < len(tokens):
                    token = tokens[idx]
                    update_token_registry(firebase_db, logger, token, "fcm", _token_platform(token), True)
                continue
            code = getattr(response.exception, "code", "") or ""
            if idx < len(tokens):
                token = tokens[idx]
                update_token_registry(firebase_db, logger, token, "fcm", _token_platform(token), False, code)
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


@api_router.post("/push/enqueue")
async def enqueue_push(payload: QueueEnqueueRequest, authorization: str | None = Header(default=None)):
    uid, _ = _verify_firebase_request(authorization)
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Push service not configured")
    now_ms = int(time.time() * 1000)
    queue_id = str(uuid.uuid4())
    firebase_db.collection("notification_dispatch_queue").document(queue_id).set({
        "queue_id": queue_id,
        "dedupe_id": str(payload.dedupe_id or "").strip(),
        "event": str(payload.event or "").strip(),
        "channel": str(payload.channel or "").strip(),
        "payload": payload.payload or {},
        "recipients": list(dict.fromkeys(payload.recipients or [])),
        "provider_targets": {},
        "status": "queued",
        "priority": max(1, min(10, int(payload.priority or 5))),
        "attempts": 0,
        "max_attempts": max(1, min(12, int(payload.max_attempts or 5))),
        "created_at": now_ms,
        "scheduled_at": int(payload.scheduled_at or now_ms),
        "processing_started_at": 0,
        "completed_at": 0,
        "failed_at": 0,
        "lease_owner": "",
        "lease_expires_at": 0,
        "backoff_until": 0,
        "requested_by": uid,
        "region": str(payload.region or "global"),
        "routing_zone": str(payload.routing_zone or "default"),
        "canary_percentage": max(0, min(100, int(payload.canary_percentage or 0))),
        "experiment_id": str(payload.experiment_id or ""),
    }, merge=True)
    logger.info("[queue_job_enqueued] queue_id=%s event=%s channel=%s recipients=%s priority=%s", queue_id, payload.event, payload.channel, len(payload.recipients or []), payload.priority)
    return {"ok": True, "queue_id": queue_id}


@api_router.post("/jobs/token-health-maintenance")
async def token_health_maintenance_job(request: Request, authorization: str | None = Header(default=None)):
    _, _ = _require_capability(request, authorization, {"admin", "super_admin"}, "token_health_maintenance", confirm="token_health_maintenance")
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    now_ms = int(time.time() * 1000)
    docs = list(firebase_db.collection("notification_token_registry").limit(2000).stream())
    updated = 0
    for d in docs:
        data = d.to_dict() or {}
        last_seen = int(data.get("last_seen_at") or 0)
        status = str(data.get("token_status") or "active")
        if status in {"invalid", "reactivated"}:
            continue
        age_days = (now_ms - last_seen) / (24 * 3600 * 1000) if last_seen else 999
        if age_days > 45:
            d.reference.set({"token_status": "stale", "invalidated_at": now_ms}, merge=True)
            updated += 1
    return {"ok": True, "updated": updated, "checked": len(docs)}


@api_router.post("/jobs/poll-push-receipts")
async def poll_push_receipts_job(request: Request, authorization: str | None = Header(default=None)):
    _, _ = _require_capability(request, authorization, {"admin", "super_admin"}, "poll_push_receipts")
    return poll_push_receipts(firebase_db, logger, normalize_expo_receipt_status)


@api_router.post("/jobs/aggregate-notification-health")
async def aggregate_notification_health_job(request: Request, authorization: str | None = Header(default=None)):
    _, _ = _require_capability(request, authorization, {"admin", "super_admin", "moderator"}, "aggregate_notification_health")
    return aggregate_notification_health(firebase_db, logger)


@api_router.post("/jobs/process-notification-queue")
async def process_notification_queue_job(request: Request, authorization: str | None = Header(default=None)):
    _, _ = _require_capability(request, authorization, {"admin", "super_admin"}, "process_notification_queue")
    return process_queue_once(firebase_db, logger)


@api_router.post("/jobs/reclaim-stale-leases")
async def reclaim_stale_leases_job(request: Request, authorization: str | None = Header(default=None)):
    _, _ = _require_capability(request, authorization, {"admin", "super_admin"}, "reclaim_stale_leases")
    return reclaim_stale_leases(firebase_db, logger)


@api_router.post("/jobs/run-worker-scheduler")
async def run_worker_scheduler_job(request: Request, authorization: str | None = Header(default=None)):
    _, _ = _require_capability(request, authorization, {"admin", "super_admin"}, "run_worker_scheduler")
    return run_scheduler_tick(firebase_db, logger)


@api_router.post("/jobs/update-routing-weights")
async def update_routing_weights_job(request: Request, authorization: str | None = Header(default=None)):
    _, _ = _require_capability(request, authorization, {"admin", "super_admin"}, "update_routing_weights")
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    providers = ["expo", "fcm", "apns"]
    out = {}
    for p in providers:
        breaker = firebase_db.collection("provider_circuit_breakers").document(f"provider:{p}").get().to_dict() or {}
        state = str(breaker.get("state") or "closed")
        latency = int(breaker.get("last_latency_ms") or 0)
        metrics = {
            "health_score": 0.4 if state == "open" else 0.7 if state == "half_open" else 1.0,
            "latency_score": 0.5 if latency > 2500 else 0.8 if latency > 1200 else 1.0,
            "throttling_score": 0.8,
            "outage_score": 0.4 if state == "open" else 1.0,
            "queue_pressure_score": 0.9,
        }
        out[p] = update_provider_weight(firebase_db, logger, p, metrics)
    return {"ok": True, "providers": out}


@api_router.post("/jobs/cleanup-expired-status")
async def cleanup_expired_statuses(authorization: str | None = Header(default=None)):
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    uid, role = _verify_firebase_request(authorization)
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    now_ms = int(time.time() * 1000)
    expired = firebase_db.collection("status_updates").where("expires_at_ms", "<=", now_ms).limit(200).stream()
    deleted = 0
    for snap in expired:
        ref = snap.reference
        for sub_name in ("views", "comments", "reactions"):
            docs = ref.collection(sub_name).limit(500).stream()
            for d in docs:
                d.reference.delete()
        ref.delete()
        deleted += 1
    logger.info("cleanup_expired_statuses by %s deleted=%s", uid, deleted)
    return {"ok": True, "deleted": deleted, "ts": now_ms}


@api_router.post("/status/react")
async def react_status(payload: StatusReactRequest, authorization: str | None = Header(default=None)):
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    uid, _ = _verify_firebase_request(authorization)
    if payload.reaction not in {"❤️", "🔥", "👏"}:
        raise HTTPException(status_code=400, detail="Unsupported reaction")
    now_ms = int(time.time() * 1000)
    rate_ref = firebase_db.collection("status_rate_limits").document(f"react:{uid}")
    rate_snap = rate_ref.get()
    last_ms = int((rate_snap.to_dict() or {}).get("last_ms", 0)) if rate_snap.exists else 0
    if now_ms - last_ms < 800:
        raise HTTPException(status_code=429, detail="Reaction throttled")
    rate_ref.set({"last_ms": now_ms, "updated_at": admin_firestore.SERVER_TIMESTAMP}, merge=True)
    status_ref = firebase_db.collection("status_updates").document(str(payload.status_id).strip())
    snap = status_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Status not found")
    data = snap.to_dict() or {}
    owner_id = str(data.get("user_id") or "")
    reaction_ref = status_ref.collection("reactions").document(uid)
    prev = reaction_ref.get()
    prev_reaction = ""
    if prev.exists:
        prev_reaction = str((prev.to_dict() or {}).get("reaction") or "")
    updates = {}
    if prev_reaction and prev_reaction != payload.reaction:
        updates[f"reaction_counts.{prev_reaction}"] = admin_firestore.Increment(-1)
    if prev_reaction != payload.reaction:
        updates[f"reaction_counts.{payload.reaction}"] = admin_firestore.Increment(1)
    reaction_ref.set({"reaction": payload.reaction, "user_id": uid, "updated_at": admin_firestore.SERVER_TIMESTAMP}, merge=True)
    if updates:
        status_ref.update(updates)
    if owner_id and owner_id != uid:
        dedupe_id = f"status_react:{payload.status_id}:{uid}:{payload.reaction}"
        firebase_db.collection("notifications").document(dedupe_id).set({
            "type": "status_reaction",
            "owner_id": owner_id,
            "actor_id": uid,
            "status_id": payload.status_id,
            "reaction": payload.reaction,
            "read": False,
            "created_at": admin_firestore.SERVER_TIMESTAMP,
            "created_at_ms": int(time.time() * 1000),
            "dedupe_id": dedupe_id,
        }, merge=True)
    return {"ok": True}


@api_router.post("/lms/quiz/submit")
async def submit_quiz_authoritative(payload: QuizSubmitRequest, request: Request, authorization: str | None = Header(default=None)):
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    uid, _ = _verify_firebase_request(authorization)
    if not allow_rate(f"quiz_submit:{uid}", 8, 60):
        log_security_event(firebase_db, logger, 'quiz_submit_rate_limited', {'uid': uid})
        raise HTTPException(status_code=429, detail='Too many quiz submissions')
    if is_attempt_expired(payload.started_at_ms):
        raise HTTPException(status_code=409, detail='Quiz attempt expired')
    dedupe = attempt_key(uid, payload.quiz_id, payload.nonce)
    existing = firebase_db.collection('quiz_attempt_locks').document(dedupe).get()
    if existing.exists:
        raise HTTPException(status_code=409, detail='Duplicate attempt submission')
    firebase_db.collection('quiz_attempt_locks').document(dedupe).set({'uid': uid, 'quiz_id': payload.quiz_id, 'created_at_ms': int(time.time()*1000)})
    firebase_db.collection('quiz_results').add({'user_id': uid, 'quiz_id': payload.quiz_id, 'score': int(payload.score), 'total_questions': int(payload.total_questions), 'created_at': admin_firestore.SERVER_TIMESTAMP, 'attempt_key': dedupe})
    return {'ok': True, 'attempt_key': dedupe}


@api_router.post("/jobs/repair-status-reaction-counts")
async def repair_status_reaction_counts(authorization: str | None = Header(default=None)):
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    _, role = _verify_firebase_request(authorization)
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    repaired = 0
    scanned = 0
    docs = firebase_db.collection("status_updates").limit(200).stream()
    for snap in docs:
        scanned += 1
        counts = {"❤️": 0, "🔥": 0, "👏": 0}
        for r in snap.reference.collection("reactions").limit(2000).stream():
            reaction = str((r.to_dict() or {}).get("reaction") or "")
            if reaction in counts:
                counts[reaction] += 1
        current = (snap.to_dict() or {}).get("reaction_counts") or {}
        if any(int(current.get(k, 0)) != v for k, v in counts.items()):
            snap.reference.update({"reaction_counts": counts, "reaction_repaired_at": admin_firestore.SERVER_TIMESTAMP})
            repaired += 1
    logger.info("repair_status_reaction_counts scanned=%s repaired=%s", scanned, repaired)
    return {"ok": True, "scanned": scanned, "repaired": repaired}


@api_router.post("/jobs/run-status-maintenance")
async def run_status_maintenance(authorization: str | None = Header(default=None)):
    cleanup = await cleanup_expired_statuses(authorization)
    repair = await repair_status_reaction_counts(authorization)
    logger.info("run_status_maintenance cleanup=%s repair=%s", cleanup, repair)
    return {"ok": True, "cleanup": cleanup, "repair": repair}


# Include routes after every endpoint has been attached to the router.
app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
