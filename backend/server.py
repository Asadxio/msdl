import sys
from pathlib import Path

_backend_dir = str(Path(__file__).resolve().parent)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pydantic import BaseModel, Field
from typing import List
from urllib import request as urlrequest
import uuid
from datetime import datetime, timezone
import json
import time
import asyncio
from fastapi import HTTPException, Header, Request
from firebase_admin import app_check as firebase_app_check, auth as firebase_auth, credentials, firestore as admin_firestore, initialize_app, messaging
import firebase_admin
from services.provider_receipt_normalizer import normalize_expo_receipt_status
from services.push_receipt_ingestion import poll_push_receipts
from services.notification_aggregation import aggregate_notification_health
from services.provider_router import route_tokens
from services.token_health_engine import update_token_registry
from services.fanout_worker import process_queue_once
from services.stale_lease_reclaimer import reclaim_stale_leases
from services.worker_scheduler import run_scheduler_tick as run_notification_scheduler_tick
from services.provider_weight_engine import update_provider_weight
from workers.maintenanceWorker import run_maintenance_once
from jobs.storageCleanup import mark_orphan_media_for_cleanup
from monitoring.health import build_health_snapshot
from payments.webhook_verifier import verify_razorpay_signature, is_webhook_timestamp_valid
from payments.payment_finalizer import finalize_successful_payment
from payments.payment_state import payment_state_update
from jobs.payment_reconciliation import recover_stale_processing_payments, expire_abandoned_pending_payments
from queues.queue_manager import enqueue_job
from workers.worker_runtime import run_worker_loop_once
from schedulers.job_scheduler import run_scheduler_tick as run_async_scheduler_tick
from config.env_config import app_env
from config.releaseConfig import release_channel
from security.rateLimiter import allow as allow_rate, abuse_score, temporary_lock
from security.securityLogs import log_security_event
from security.quizSecurity import attempt_key, is_attempt_expired, operation_key, suspicious_timing
from security.paymentSecurity import can_transition, payment_doc_id
from validators.payment_validator import validate_payment_amount, validate_payment_type
from validators.security_validator import validate_timestamp_fresh
from analytics import write_error_event, aggregate_quiz_summary, summarize_moderation, detect_thresholds
from ai import classify_text, summarize_operational_insights, log_ai_metric, cached_call


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME')

client = None
db = None

if mongo_url and db_name:
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
    except Exception as mongo_err:
        logging.warning(f"MongoDB client initialization warning: {mongo_err}")

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
async def create_status_check(input: StatusCheckCreate, request: Request, authorization: str | None = Header(default=None)):
    if db is None:
        raise HTTPException(status_code=500, detail="MongoDB not configured")
    uid, _ = _require_authenticated_request(request, authorization, "status_create", 10, 60)
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.model_dump())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks(request: Request, authorization: str | None = Header(default=None)):
    if db is None:
        raise HTTPException(status_code=500, detail="MongoDB not configured")
    _, _ = _require_capability(request, authorization, {"admin", "super_admin"}, "status_list")
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

def _env_list(name: str, default: str = "") -> list[str]:
    raw = os.environ.get(name, default)
    return [v.strip() for v in str(raw).split(",") if v.strip()]


cors_origins = _env_list("CORS_ALLOW_ORIGINS", "http://localhost:8081,http://localhost:19006")
cors_methods = _env_list("CORS_ALLOW_METHODS", "GET,POST,OPTIONS")
cors_headers = _env_list("CORS_ALLOW_HEADERS", "Authorization,Content-Type,x-action-nonce,x-action-confirm,x-firebase-appcheck")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=cors_methods,
    allow_headers=cors_headers,
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ALLOWED_ADMIN_ORIGINS = set(_env_list("ADMIN_ALLOWED_ORIGINS", ""))
SECURITY_EVENT_RATE: dict[str, list[float]] = {}
NONCE_CACHE: dict[str, float] = {}
REQUIRE_APP_CHECK = os.environ.get("REQUIRE_APP_CHECK", "false").strip().lower() in {"1", "true", "yes"}
if app_env() == "production" and not REQUIRE_APP_CHECK:
    raise RuntimeError("REQUIRE_APP_CHECK=true is required when APP_ENV=production")


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
    # Prune stale keys to prevent unbounded memory growth
    if len(SECURITY_EVENT_RATE) > 5000:
        cutoff = now - 3600
        stale = [k for k, v in SECURITY_EVENT_RATE.items() if not v or v[-1] < cutoff]
        for k in stale:
            del SECURITY_EVENT_RATE[k]


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
    # Prune expired nonces to prevent unbounded memory growth
    if len(NONCE_CACHE) > 10000:
        cutoff = now - 300
        expired = [k for k, v in NONCE_CACHE.items() if v < cutoff]
        for k in expired:
            del NONCE_CACHE[k]


def _verify_app_check(request: Request, required: bool = True) -> None:
    if not required or not REQUIRE_APP_CHECK:
        return
    token = request.headers.get("x-firebase-appcheck", "").strip()
    if not token:
        _log_security_event("app_check_missing", {"ip": _client_ip(request), "path": str(request.url.path)})
        raise HTTPException(status_code=401, detail="App Check token required")
    try:
        firebase_app_check.verify_token(token)
    except Exception:
        _log_security_event("app_check_invalid", {"ip": _client_ip(request), "path": str(request.url.path)})
        raise HTTPException(status_code=401, detail="Invalid App Check token")


def _classify_security_severity(event: str, payload: dict) -> str:
    e = str(event)
    if "mass_delete" in e or "role_escalation" in e:
        return "critical"
    if "denied" in e or "failed" in e:
        return "high"
    if "moderation" in e or "anomaly" in e:
        return "medium"
    return "low"


SENSITIVE_LOG_KEYS = {"token", "password", "secret", "authorization", "key", "id_token", "credit_card", "cvv"}


def _sanitize_log_payload(data: Any) -> Any:
    if isinstance(data, dict):
        clean = {}
        for k, v in data.items():
            if any(s in str(k).lower() for s in SENSITIVE_LOG_KEYS):
                clean[k] = "[REDACTED]"
            else:
                clean[k] = _sanitize_log_payload(v)
        return clean
    elif isinstance(data, list):
        return [_sanitize_log_payload(item) for item in data]
    return data


def _log_security_event(event: str, payload: dict) -> None:
    sanitized = _sanitize_log_payload(payload)
    severity = _classify_security_severity(event, sanitized)
    logger.warning("SECURITY_EVENT %s severity=%s %s", event, severity, json.dumps(sanitized, ensure_ascii=False))
    if firebase_db is not None:
        firebase_db.collection("security_events_immutable").add({
            "event": event,
            "severity": severity,
            "payload": sanitized,
            "created_at": admin_firestore.SERVER_TIMESTAMP,
            "created_at_ms": int(time.time() * 1000),
        })


def _require_capability(request: Request, authorization: str | None, allowed_roles: set[str], action: str, confirm: str | None = None) -> tuple[str, str]:
    # Privileged operations must check token revocation
    uid, role = _verify_firebase_request(authorization, check_revoked=True)
    _verify_app_check(request, required=True)
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


def _require_authenticated_request(request: Request, authorization: str | None, action: str, limit_count: int = 60, window_sec: int = 60) -> tuple[str, str]:
    # Non-privileged authenticated request defaults to no revocation check for performance
    uid, role = _verify_firebase_request(authorization, check_revoked=False)
    _verify_app_check(request, required=True)
    _enforce_rate_limit(f"{uid}:{action}", limit_count, window_sec)
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
    # Server-side grading: send answers dict {question_id: chosen_option_index}
    # Legacy clients that don't send answers will fall back to score/total_questions
    answers: dict | None = None
    # Legacy fields — used only if answers is None (backward-compat fallback)
    score: int | None = None
    total_questions: int | None = None


class AnalyticsEventItem(BaseModel):
    name: str
    ts: int
    dedupeKey: str | None = None
    payload: dict | None = None


class AnalyticsIngestRequest(BaseModel):
    events: list[AnalyticsEventItem]


class AIInferRequest(BaseModel):
    feature: str
    payload: dict


class CertificateGenerateRequest(BaseModel):
    course_id: str



class PaymentInitiateRequest(BaseModel):
    operation_id: str
    payment_type: str
    amount: float
    currency: str = "INR"
    course_id: str | None = None


class PaymentConfirmRequest(BaseModel):
    payment_id: str
    transaction_ref: str
    provider_ref: str | None = None


class PaymentAdminActionRequest(BaseModel):
    payment_id: str
    next_state: str
    note: str
    evidence: dict | None = None


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


def _enrollment_doc_id(uid: str, course_id: str) -> str:
    return f"{str(uid or '').strip()}:{str(course_id or '').strip()}"


def _is_active_enrollment(data: dict, uid: str, course_id: str) -> bool:
    return (
        str(data.get("user_id") or "") == str(uid or "").strip()
        and str(data.get("course_id") or "") == str(course_id or "").strip()
        and str(data.get("status") or "") == "active"
    )



def _verify_firebase_request(authorization: str | None, check_revoked: bool = False) -> tuple[str, str]:
    try:
        token = _bearer_token(authorization)
    except HTTPException as e:
        _log_security_event("auth_token_missing", {"detail": e.detail})
        raise e

    try:
        decoded = firebase_auth.verify_id_token(token, check_revoked=check_revoked)
    except Exception as exc:
        _log_security_event("auth_token_failed", {"error": str(exc)})
        raise HTTPException(status_code=401, detail="Invalid auth token")

    uid = decoded.get("uid", "")
    role = _fetch_user_role(uid)
    if not uid or not role:
        _log_security_event("auth_unapproved_user", {"uid": uid, "email": decoded.get("email", "")})
        raise HTTPException(status_code=403, detail="Approved user required")
        
    if decoded.get("email_verified") is not True:
        if role == "super_admin":
            if firebase_db:
                snap = firebase_db.collection("users").document(uid).get()
                if snap.exists and snap.to_dict().get("founder") is True:
                    return uid, role
        _log_security_event("auth_unverified_email", {"uid": uid, "email": decoded.get("email", "")})
        raise HTTPException(status_code=403, detail="Verified email required")
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


def _allows_legacy_course_access(live_class: dict) -> bool:
    return str(live_class.get("enrollment_source") or "").strip() != "enrollments"


def _is_live_class_member(uid: str, role: str, live_class: dict) -> bool:
    if role == "admin":
        return True
    if role == "teacher" and live_class.get("teacher_id") == uid:
        return True
    course_id = str(live_class.get("course_id") or "").strip()
    if course_id and firebase_db is not None:
        enrollment_id = _enrollment_doc_id(uid, course_id)
        snap = firebase_db.collection("enrollments").document(enrollment_id).get()
        if snap.exists:
            return _is_active_enrollment(snap.to_dict() or {}, uid, course_id)
        return role == "student" and _allows_legacy_course_access(live_class)
    return False


def _is_joinable_live_status(status: str) -> bool:
    return status in {"live", "reconnecting"}


def _require_live_class_access(uid: str, role: str, live_class: dict, require_live: bool = True) -> None:
    if require_live and not _is_joinable_live_status(str(live_class.get("status") or "")):
        raise HTTPException(status_code=409, detail="Live class is not active")
    if not _is_live_class_member(uid, role, live_class):
        raise HTTPException(status_code=403, detail="Not enrolled for this live class")


def _require_teacher_for_live_class(uid: str, role: str, live_class: dict) -> None:
    if role == "admin":
        return
    if role == "teacher" and live_class.get("teacher_id") == uid:
        return
    raise HTTPException(status_code=403, detail="Teacher/admin access required")


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


def _chunked(values: list, size: int):
    for index in range(0, len(values), size):
        yield values[index:index + size]


def _collect_tokens(user_ids: list[str]) -> tuple[list[str], list[str], dict[str, list[str]]]:
    if firebase_db is None or not user_ids:
        return [], [], {}
    fcm_tokens: list[str] = []
    expo_tokens: list[str] = []
    token_owners: dict[str, list[str]] = {}
    for chunk in _chunked(user_ids, 100):
        refs = [firebase_db.collection("users").document(uid) for uid in chunk]
        try:
            snaps = firebase_db.get_all(refs)
        except Exception:
            snaps = [ref.get() for ref in refs]
        for snap in snaps:
            if not snap.exists:
                continue
            uid = snap.id
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





@api_router.post("/call/cleanup")
async def cleanup_call(payload: CallCleanupRequest, request: Request, authorization: str | None = Header(default=None)):
    uid, role = _require_authenticated_request(request, authorization, "call_cleanup", 30, 60)
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




@api_router.post("/push/send")
async def send_push(payload: PushSendRequest, request: Request, authorization: str | None = Header(default=None)):
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Push service not configured")

    uid, role = _require_authenticated_request(request, authorization, "push_send", 30, 60)

    if payload.send_to_all and role not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin required for broadcast push")

    requester_uid = uid

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
    if role not in {"admin", "super_admin"}:
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
            for recipient_uid in target_user_ids:
                if recipient_uid not in participants:
                    raise HTTPException(status_code=403, detail="Recipient outside chat participants")
            muted_by = set(chat_data.get("muted_by") or [])
            if muted_by:
                target_user_ids = [recipient_uid for recipient_uid in target_user_ids if recipient_uid not in muted_by]
        elif event_type == "live_class_started" and role in {"teacher", "admin"}:
            live_class_id = str((payload.data or {}).get("live_class_id", "")).strip()
            if not live_class_id:
                raise HTTPException(status_code=403, detail="Live class push requires class context")
            class_snap = firebase_db.collection("live_classes").document(live_class_id).get()
            if not class_snap.exists:
                raise HTTPException(status_code=404, detail="Live class not found")
            class_data = class_snap.to_dict() or {}
            if class_data.get("teacher_id") != requester_uid and role != "admin":
                raise HTTPException(status_code=403, detail="Not allowed to push for this live class")
            allowed_students = set(class_data.get("student_ids") or [])
            for recipient_uid in target_user_ids:
                if recipient_uid not in allowed_students:
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
        result = await asyncio.to_thread(messaging.send_each_for_multicast, message)
    expo_result = await asyncio.to_thread(_send_expo_push, expo_tokens, payload, token_owners, dedupe_id)
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
async def enqueue_push(payload: QueueEnqueueRequest, request: Request, authorization: str | None = Header(default=None)):
    uid, enqueue_role = _require_authenticated_request(request, authorization, "push_enqueue", 60, 60)
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Push service not configured")
    # Only teachers and above may enqueue push notifications.
    if enqueue_role not in {"admin", "super_admin", "teacher", "moderator"}:
        raise HTTPException(status_code=403, detail="Insufficient privileges to enqueue push notifications")
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
    return run_notification_scheduler_tick(firebase_db, logger)


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
async def cleanup_expired_statuses(request: Request, authorization: str | None = Header(default=None)):
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    uid, role = _require_authenticated_request(request, authorization, "cleanup_expired_status", 20, 60)
    if role not in {"admin", "super_admin"}:
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
async def react_status(payload: StatusReactRequest, request: Request, authorization: str | None = Header(default=None)):
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    uid, _ = _require_authenticated_request(request, authorization, "status_react", 120, 60)
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
    uid, _ = _require_authenticated_request(request, authorization, "quiz_submit", 30, 60)
    now_ms = int(time.time() * 1000)
    client_op = request.headers.get("x-op-id", "").strip() or payload.nonce

    if not allow_rate(f"quiz_submit:{uid}", 8, 60):
        score = abuse_score(f"quiz_submit:{uid}")
        if score > 20:
            temporary_lock(f"quiz_submit:{uid}", 300)
        log_security_event(firebase_db, logger, 'quiz_submit_rate_limited', {'uid': uid, 'abuse_score': score})
        raise HTTPException(status_code=429, detail='Too many quiz submissions')

    if not validate_timestamp_fresh(payload.started_at_ms):
        log_security_event(firebase_db, logger, 'quiz_submit_timestamp_skew', {'uid': uid, 'quiz_id': payload.quiz_id})
        raise HTTPException(status_code=400, detail='Invalid attempt timestamp')

    if is_attempt_expired(payload.started_at_ms):
        raise HTTPException(status_code=409, detail='Quiz attempt expired')

    op_key = operation_key(uid, client_op)
    op_ref = firebase_db.collection('operation_dedupe').document(op_key)
    if op_ref.get().exists:
        raise HTTPException(status_code=409, detail='Duplicate operation detected')

    dedupe = attempt_key(uid, payload.quiz_id, payload.nonce)
    existing = firebase_db.collection('quiz_attempt_locks').document(dedupe).get()
    if existing.exists:
        raise HTTPException(status_code=409, detail='Duplicate attempt submission')

    # ------------------------------------------------------------------
    # Server-side grading (preferred path)
    # ------------------------------------------------------------------
    grading_mode = 'server'
    computed_score: int
    total_questions: int

    if payload.answers is not None:
        # Load quiz questions and correct answers from Firestore
        quiz_snap = firebase_db.collection('quizzes').document(payload.quiz_id).get()
        if not quiz_snap.exists:
            raise HTTPException(status_code=404, detail='Quiz not found')
        quiz_data = quiz_snap.to_dict() or {}
        questions: list = quiz_data.get('questions') or []
        total_questions = len(questions)
        computed_score = 0
        for q in questions:
            q_id = str(q.get('id') or q.get('question_id') or '')
            correct = q.get('correctOptionIndex') if 'correctOptionIndex' in q else q.get('correct_option_index')
            if correct is None:
                correct = q.get('correctAnswer')  # Legacy field name
            if q_id and correct is not None:
                student_answer = payload.answers.get(q_id)
                if student_answer is not None and str(student_answer) == str(correct):
                    computed_score += 1
    else:
        # Legacy fallback: trust client-supplied score (backward compat)
        # This path is flagged so it can be monitored / deprecated
        grading_mode = 'legacy_client_score'
        computed_score = int(payload.score or 0)
        total_questions = int(payload.total_questions or 0)
        log_security_event(firebase_db, logger, 'quiz_submit_legacy_client_score', {
            'uid': uid,
            'quiz_id': payload.quiz_id,
            'client_score': computed_score,
        })

    suspicious = suspicious_timing(payload.started_at_ms, now_ms)
    firebase_db.collection('quiz_attempt_locks').document(dedupe).set({'uid': uid, 'quiz_id': payload.quiz_id, 'created_at_ms': now_ms, 'operation_key': op_key})
    op_ref.set({'uid': uid, 'operation': 'quiz_submit', 'created_at_ms': now_ms, 'ttl_ms': now_ms + 24 * 60 * 60 * 1000})
    firebase_db.collection('quiz_results').add({
        'user_id': uid,
        'quiz_id': payload.quiz_id,
        'score': computed_score,
        'total_questions': total_questions,
        'grading_mode': grading_mode,
        'created_at': admin_firestore.SERVER_TIMESTAMP,
        'attempt_key': dedupe,
        'submitted_at_ms': now_ms,
        'suspicious_timing': suspicious,
    })

    if suspicious:
        log_security_event(firebase_db, logger, 'quiz_submit_suspicious_timing', {'uid': uid, 'quiz_id': payload.quiz_id, 'started_at_ms': payload.started_at_ms, 'submitted_at_ms': now_ms})
    return {'ok': True, 'attempt_key': dedupe, 'score': computed_score, 'total_questions': total_questions, 'grading_mode': grading_mode, 'suspicious_timing': suspicious}


@api_router.post("/jobs/repair-status-reaction-counts")
async def repair_status_reaction_counts(request: Request, authorization: str | None = Header(default=None)):
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    _, role = _require_authenticated_request(request, authorization, "repair_status_reaction_counts", 20, 60)
    if role not in {"admin", "super_admin"}:
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
async def run_status_maintenance(request: Request, authorization: str | None = Header(default=None)):
    _, _ = _require_capability(request, authorization, {"admin", "super_admin"}, "run_status_maintenance")
    cleanup = await cleanup_expired_statuses(request, authorization)
    repair = await repair_status_reaction_counts(request, authorization)
    logger.info("run_status_maintenance cleanup=%s repair=%s", cleanup, repair)
    return {"ok": True, "cleanup": cleanup, "repair": repair}


@api_router.post("/analytics/ingest")
async def analytics_ingest(payload: AnalyticsIngestRequest, request: Request, authorization: str | None = Header(default=None)):
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    uid, _ = _require_authenticated_request(request, authorization, "analytics_ingest", 60, 60)

    now_ms = int(time.time() * 1000)
    accepted = 0
    names: dict[str, int] = {}
    for event in payload.events[:50]:
        name = str(event.name or "custom")[:64]
        names[name] = names.get(name, 0) + 1
        if name == "api_error":
            write_error_event(firebase_db, {**(event.payload or {}), "at_ms": event.ts})
        accepted += 1

    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    summary_ref = firebase_db.collection("analytics_daily_summary").document(day)
    summary_ref.set({
        "updated_at_ms": now_ms,
        "event_count": admin_firestore.Increment(accepted),
        "actors": admin_firestore.Increment(1),
    }, merge=True)
    for k, v in names.items():
        summary_ref.set({f"by_name.{k}": admin_firestore.Increment(v)}, merge=True)
    return {"ok": True, "accepted": accepted}


@api_router.post("/jobs/aggregate-analytics")
async def aggregate_analytics_job(request: Request, authorization: str | None = Header(default=None)):
    _, _ = _require_capability(request, authorization, {"admin", "super_admin", "moderator"}, "aggregate_analytics")
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")

    quiz_rows = [(d.to_dict() or {}) for d in firebase_db.collection("quiz_results").limit(1000).stream()]
    moderation_rows = [(d.to_dict() or {}) for d in firebase_db.collection("moderation_logs").limit(1000).stream()]
    quiz_summary = aggregate_quiz_summary(quiz_rows)
    moderation_summary = summarize_moderation(moderation_rows)

    metrics = {
        "quiz_suspicious": sum(int(v.get("suspicious", 0)) for v in quiz_summary.values()),
        "moderation_reports": int(moderation_summary.get("reports", 0)),
    }
    alerts = detect_thresholds(metrics, {"quiz_suspicious": 30, "moderation_reports": 300})

    stamp = int(time.time() * 1000)
    firebase_db.collection("analytics_dashboards").document("lms").set({"updated_at_ms": stamp, "quiz_summary": quiz_summary}, merge=True)
    firebase_db.collection("analytics_dashboards").document("moderation").set({"updated_at_ms": stamp, "summary": moderation_summary}, merge=True)
    if alerts:
        firebase_db.collection("analytics_alerts").document(str(stamp)).set({"created_at_ms": stamp, "alerts": alerts})

    return {"ok": True, "quiz_count": len(quiz_rows), "moderation_count": len(moderation_rows), "alerts": len(alerts)}


@api_router.post("/jobs/run-maintenance-worker")
async def run_maintenance_worker_job(request: Request, authorization: str | None = Header(default=None)):
    _, _ = _require_capability(request, authorization, {"admin", "super_admin"}, "run_maintenance_worker")
    return run_maintenance_once(firebase_db, logger)


@api_router.post("/jobs/storage-cleanup")
async def run_storage_cleanup_job(request: Request, authorization: str | None = Header(default=None)):
    _, _ = _require_capability(request, authorization, {"admin", "super_admin"}, "storage_cleanup")
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    return mark_orphan_media_for_cleanup(firebase_db, 200)


@api_router.get("/ops/health")
async def ops_health(request: Request, authorization: str | None = Header(default=None)):
    _, _ = _require_capability(request, authorization, {"admin", "super_admin", "moderator"}, "ops_health")
    snap = build_health_snapshot(firebase_db)
    snap["env"] = app_env()
    snap["release_channel"] = release_channel()
    return snap


@api_router.post("/ai/infer")
async def ai_infer(payload: AIInferRequest, request: Request, authorization: str | None = Header(default=None)):
    uid, role = _require_authenticated_request(request, authorization, "ai_infer", 30, 60)

    feature = str(payload.feature or "").strip().lower()
    body = payload.payload or {}

    if feature == "moderation_classify":
        result = cached_call(feature, body, 120, lambda p: classify_text(str(p.get("text") or "")))
    elif feature == "lms_summary":
        text = str(body.get("content") or "")
        summary = text[:280] + ("..." if len(text) > 280 else "")
        result = {"summary": summary or "No content provided.", "assistive_only": True}
    elif feature == "quiz_explain":
        q = str(body.get("question") or "")
        a = str(body.get("answer") or "")
        result = {"explanation": f"Review the core concept in: {q[:120]}. Your selected answer: {a[:120]}.", "assistive_only": True}
    elif feature == "ops_insight":
        if role not in {"admin", "super_admin", "moderator"}:
            raise HTTPException(status_code=403, detail="Insufficient privileges")
        result = summarize_operational_insights(body)
    else:
        raise HTTPException(status_code=400, detail="Unsupported AI feature")

    log_ai_metric(firebase_db, "inference", {"feature": feature, "uid": uid, "cache_hit": bool(result.get("cache_hit")), "result_size": len(str(result))})
    return {"ok": True, "result": result, "cache_hit": bool(result.get("cache_hit", False))}


def _course_requires_payment(course: dict) -> bool:
    return bool(course.get("requires_payment") or course.get("paid") or float(course.get("price") or course.get("fee_amount") or 0) > 0)


def _has_completed_course(uid: str, course_id: str) -> bool:
    """Return True only if the student has a completed lesson_progress record
    for EVERY lesson in the course.

    BUG FIX (Phase 8): the previous implementation used all() over only the
    lesson_progress docs that already existed, meaning a student who opened
    and completed a single lesson in a 10-lesson course was incorrectly
    considered to have completed the whole course.
    """
    if firebase_db is None:
        return False
    # Count all lessons in the course
    course_lessons = list(
        firebase_db.collection("lessons")
        .where("course_id", "==", course_id)
        .limit(500)
        .stream()
    )
    total_lessons = len(course_lessons)
    if total_lessons == 0:
        # No lessons defined → course not completable
        return False
    # Count the student's completed lesson_progress records for this course
    completed_progress = list(
        firebase_db.collection("lesson_progress")
        .where("user_id", "==", uid)
        .where("course_id", "==", course_id)
        .where("completed", "==", True)
        .limit(500)
        .stream()
    )
    return len(completed_progress) >= total_lessons


def _has_successful_course_payment(uid: str, course_id: str) -> bool:
    if firebase_db is None:
        return False
    payment_docs = list(
        firebase_db.collection("payments")
        .where("user_id", "==", uid)
        .where("course_id", "==", course_id)
        .limit(10)
        .stream()
    )
    for doc in payment_docs:
        data = doc.to_dict() or {}
        if str(data.get("state") or data.get("status") or "").strip().lower() == "succeeded":
            return True
    return False


@api_router.post("/certificates/generate")
async def generate_certificate(payload: CertificateGenerateRequest, request: Request, authorization: str | None = Header(default=None)):
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    uid, _ = _require_authenticated_request(request, authorization, "certificate_generate", 5, 300)

    course_id = str(payload.course_id or "").strip()
    if not course_id or len(course_id) > 128 or "/" in course_id:
        raise HTTPException(status_code=400, detail="Invalid course_id")

    course_snap = firebase_db.collection("courses").document(course_id).get()
    if not course_snap.exists:
        raise HTTPException(status_code=404, detail="Course not found")
    course = course_snap.to_dict() or {}

    enrollment_id = _enrollment_doc_id(uid, course_id)
    enrollment_snap = firebase_db.collection("enrollments").document(enrollment_id).get()
    if not enrollment_snap.exists or not _is_active_enrollment(enrollment_snap.to_dict() or {}, uid, course_id):
        raise HTTPException(status_code=403, detail="Active enrollment required")

    if not _has_completed_course(uid, course_id):
        raise HTTPException(status_code=409, detail="Course completion required")

    if _course_requires_payment(course) and not _has_successful_course_payment(uid, course_id):
        raise HTTPException(status_code=402, detail="Successful payment required")

    # ------------------------------------------------------------------
    # Certificate eligibility: enforce quiz attempts + attendance thresholds
    # (Phase 8 fix: backend must mirror frontend's quizAttempts > 0 &&
    # attendancePct >= 75 checks so the API cannot be called directly to
    # bypass these requirements)
    # ------------------------------------------------------------------
    quiz_attempts = list(
        firebase_db.collection('quiz_results')
        .where('user_id', '==', uid)
        .limit(1)
        .stream()
    )
    if not quiz_attempts:
        raise HTTPException(status_code=409, detail="At least one quiz attempt required for certificate")

    attendance_docs = list(
        firebase_db.collection('attendance')
        .where('user_id', '==', uid)
        .where('course_id', '==', course_id)
        .limit(500)
        .stream()
    )
    if attendance_docs:
        attended = sum(1 for d in attendance_docs if (d.to_dict() or {}).get('present') is True)
        attendance_pct = (attended / len(attendance_docs)) * 100
        if attendance_pct < 75:
            raise HTTPException(
                status_code=409,
                detail=f"Minimum 75% attendance required (current: {attendance_pct:.1f}%)"
            )

    user_snap = firebase_db.collection("users").document(uid).get()
    user_doc = user_snap.to_dict() or {}
    cert_id = f"{uid}:{course_id}"
    completion_date = datetime.now(timezone.utc).date().isoformat()
    cert_ref = firebase_db.collection("certificates").document(cert_id)
    cert_ref.set({
        "user_id": uid,
        "course_id": course_id,
        "user_name": str(user_doc.get("name") or "User")[:160],
        "course_name": str(course.get("name") or course_id)[:200],
        "completion_date": completion_date,
        "source": "server",
        "enrollment_id": enrollment_id,
        "created_at": admin_firestore.SERVER_TIMESTAMP,
        "updated_at": admin_firestore.SERVER_TIMESTAMP,
    }, merge=True)
    return {"ok": True, "certificate_id": cert_id, "completion_date": completion_date}


@api_router.post("/payments/initiate")
async def payments_initiate(payload: PaymentInitiateRequest, request: Request, authorization: str | None = Header(default=None)):
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    uid, _ = _require_authenticated_request(request, authorization, "payments_initiate", 20, 60)

    amount = validate_payment_amount(payload.amount)
    ptype = validate_payment_type(payload.payment_type)
    op_id = str(payload.operation_id or "").strip()
    course_id = str(payload.course_id or "").strip()
    if len(op_id) < 6:
        raise HTTPException(status_code=400, detail="operation_id too short")
    if ptype == "fees":
        if not course_id or len(course_id) > 128 or "/" in course_id:
            raise HTTPException(status_code=400, detail="course_id is required for fee payments")
        if not firebase_db.collection("courses").document(course_id).get().exists:
            raise HTTPException(status_code=404, detail="Course not found")

    pid = payment_doc_id(uid, op_id)
    ref = firebase_db.collection("payments").document(pid)
    snap = ref.get()
    now_ms = int(time.time() * 1000)
    if snap.exists:
        data = snap.to_dict() or {}
        state = data.get("state") or data.get("status") or "pending"
        return {"ok": True, "payment_id": pid, "state": state, "status": state, "idempotent": True}

    ref.set(payment_state_update(
        "pending",
        payment_id=pid,
        user_id=uid,
        amount=amount,
        currency=str(payload.currency or "INR"),
        type=ptype,
        **({"course_id": course_id} if ptype == "fees" else {}),
        provider="razorpay",
        review_mode="manual",
        operation_id=op_id,
        created_at=admin_firestore.SERVER_TIMESTAMP,
        created_at_ms=now_ms,
        updated_at=admin_firestore.SERVER_TIMESTAMP,
        updated_at_ms=now_ms,
    ), merge=True)
    firebase_db.collection("payment_audit_logs").add({"payment_id": pid, "actor_id": uid, "action": "initiate", "state": "pending", "created_at_ms": now_ms})
    return {"ok": True, "payment_id": pid, "state": "pending", "status": "pending", "idempotent": False}


@api_router.post("/payments/confirm")
async def payments_confirm(payload: PaymentConfirmRequest, request: Request, authorization: str | None = Header(default=None)):
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    uid, _ = _require_authenticated_request(request, authorization, "payments_confirm", 20, 60)
    pid = str(payload.payment_id or "").strip()
    ref = firebase_db.collection("payments").document(pid)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Payment not found")
    data = snap.to_dict() or {}
    if data.get("user_id") != uid:
        raise HTTPException(status_code=403, detail="Not owner")
    cur = str(data.get("state") or data.get("status") or "pending")
    if not can_transition(cur, "processing") and cur != "processing":
        raise HTTPException(status_code=409, detail="Invalid payment state transition")
    now_ms = int(time.time() * 1000)
    ref.set(payment_state_update(
        "processing",
        transaction_ref=str(payload.transaction_ref or "")[:120],
        provider_ref=str(payload.provider_ref or "")[:120],
        submitted_at=admin_firestore.SERVER_TIMESTAMP,
        updated_at=admin_firestore.SERVER_TIMESTAMP,
        updated_at_ms=now_ms,
    ), merge=True)
    firebase_db.collection("payment_verification_queue").document(pid).set({"payment_id": pid, "status": "queued", "attempt": 0, "scheduled_at_ms": now_ms, "created_at_ms": now_ms}, merge=True)
    firebase_db.collection("payment_audit_logs").add({"payment_id": pid, "actor_id": uid, "action": "confirm", "state": "processing", "created_at_ms": now_ms})
    return {"ok": True, "payment_id": pid, "state": "processing", "status": "processing"}


@api_router.post("/payments/admin/action")
async def payments_admin_action(payload: PaymentAdminActionRequest, request: Request, authorization: str | None = Header(default=None)):
    admin_uid, admin_role = _require_capability(request, authorization, {"admin", "super_admin"}, "payments_admin_action")
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")

    pid = str(payload.payment_id or "").strip()
    nxt = str(payload.next_state or "").strip().lower()
    reason = str(payload.note or "").strip()
    log_context = {"payment_id": pid, "admin_uid": admin_uid, "admin_role": admin_role, "next_state": nxt}
    logger.info("Admin payment action requested %s", json.dumps(log_context, ensure_ascii=False))

    if not pid or "/" in pid:
        logger.warning("Admin payment action invalid payment id %s", json.dumps(log_context, ensure_ascii=False))
        raise HTTPException(status_code=400, detail="Invalid payment id")
    if len(reason) < 4:
        raise HTTPException(status_code=400, detail="Admin reason is required")

    ref = firebase_db.collection("payments").document(pid)
    try:
        snap = ref.get()
        logger.info("Admin payment action Firestore get %s", json.dumps({**log_context, "exists": snap.exists}, ensure_ascii=False))
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Payment not found")

        data = snap.to_dict() or {}
        cur = str(data.get("state") or data.get("status") or "pending")
        log_context = {**log_context, "current_state": cur, "payment_user_id": str(data.get("user_id") or "")}
        if cur == nxt:
            logger.warning("Admin payment action duplicate transition %s", json.dumps(log_context, ensure_ascii=False))
            raise HTTPException(status_code=409, detail=f"Transition {cur} -> {nxt} is a no-op")
        if not can_transition(cur, nxt):
            logger.warning("Admin payment action invalid transition %s", json.dumps(log_context, ensure_ascii=False))
            raise HTTPException(status_code=409, detail=f"Transition {cur} -> {nxt} not allowed")

        now_ms = int(time.time() * 1000)
        review_update = {
            "reviewed_by": admin_uid,
            "review_note": reason[:500],
            "review_evidence": payload.evidence or {},
            "reviewed_at": admin_firestore.SERVER_TIMESTAMP,
            "updated_at": admin_firestore.SERVER_TIMESTAMP,
            "updated_at_ms": now_ms,
        }
        if nxt == "succeeded":
            finalize_result = finalize_successful_payment(firebase_db, pid, admin_uid, source_event_id="admin_action", extra_update=review_update)
            logger.info("Admin payment finalize result %s", json.dumps({**log_context, "finalize_result": finalize_result}, ensure_ascii=False))
        else:
            ref.set(payment_state_update(nxt, **review_update), merge=True)
            logger.info("Admin payment state update wrote %s", json.dumps(log_context, ensure_ascii=False))

        firebase_db.collection("payment_audit_logs").add({"payment_id": pid, "actor_id": admin_uid, "actor_role": admin_role, "action": "state_change", "from": cur, "to": nxt, "reason": reason[:500], "evidence": payload.evidence or {}, "created_at_ms": now_ms})
        return {"ok": True, "payment_id": pid, "from": cur, "to": nxt}
    except HTTPException:
        raise
    except PermissionError as exc:
        logger.exception("Admin payment action permission denied %s", json.dumps(log_context, ensure_ascii=False))
        raise HTTPException(status_code=403, detail=f"Permission denied updating payment: {exc}")
    except ValueError as exc:
        logger.exception("Admin payment action validation failed %s", json.dumps(log_context, ensure_ascii=False))
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        logger.exception("Admin payment action failed %s", json.dumps(log_context, ensure_ascii=False))
        raise HTTPException(status_code=500, detail=f"Payment update failed: {exc}")


@api_router.post("/payments/webhook")
async def payments_webhook(request: Request):
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")

    body = await request.body()
    sig = request.headers.get("x-razorpay-signature", "")
    ts = request.headers.get("x-webhook-timestamp", "")
    import os, json, hashlib, time
    secret = str(os.environ.get("WEBHOOK_SECRET", "")).strip()
    replay_window = int(os.environ.get("PAYMENT_REPLAY_WINDOW_SECONDS", "300") or 300)

    ok_sig, sig_reason = verify_razorpay_signature(body, sig, secret)
    ok_ts, ts_reason = is_webhook_timestamp_valid(ts, replay_window_seconds=replay_window)
    recv_ms = int(time.time() * 1000)
    payload_hash = hashlib.sha256(body or b"").hexdigest()

    try:
        data = json.loads(body.decode("utf-8")) if body else {}
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed webhook payload")

    event_id = str(data.get("event_id") or data.get("id") or "").strip()
    if not event_id:
        raise HTTPException(status_code=400, detail="Missing event id")
    payment_id = str((data.get("payload") or {}).get("payment_id") or data.get("payment_id") or "").strip()
    event_type = str(data.get("event") or data.get("event_type") or "unknown").strip()

    ev_ref = firebase_db.collection("payment_gateway_events").document(event_id)
    existing = ev_ref.get()
    if existing.exists:
        firebase_db.collection("payment_processor_audit_logs").add({"processor": "razorpay", "event_type": event_type, "event_id": event_id, "payment_id": payment_id, "verification_result": "duplicate", "replay_detected": True, "transition_applied": "none", "reconciliation_action": "skip_duplicate", "processing_latency_ms": 0, "failure_reason": "duplicate_event", "actor": "webhook", "processed_at": recv_ms})
        return {"ok": True, "duplicate": True}

    verified = ok_sig and ok_ts
    ev_ref.set({"event_id": event_id, "event_type": event_type, "payment_id": payment_id, "payload_hash": payload_hash, "received_at": recv_ms, "verified": verified, "processor": "razorpay", "processing_status": "received", "replay_detected": False, "reconciliation_status": "queued", "timestamp_reason": ts_reason, "signature_reason": sig_reason, "raw": data})
    if not verified:
        firebase_db.collection("payment_processor_audit_logs").add({"processor": "razorpay", "event_type": event_type, "event_id": event_id, "payment_id": payment_id, "verification_result": "failed", "replay_detected": False, "transition_applied": "none", "reconciliation_action": "reject", "processing_latency_ms": 0, "failure_reason": f"sig={sig_reason};ts={ts_reason}", "actor": "webhook", "processed_at": recv_ms})
        raise HTTPException(status_code=401, detail="Webhook verification failed")

    transition = "none"
    rec_action = "queued"
    fail_reason = ""
    try:
        if payment_id:
            if event_type in {"payment.captured", "order.paid", "payment.authorized"}:
                finalize_successful_payment(firebase_db, payment_id, "webhook", source_event_id=event_id)
                transition = "succeeded"
                rec_action = "finalized"
            elif event_type in {"payment.failed"}:
                firebase_db.collection("payments").document(payment_id).set(payment_state_update("failed", updated_at_ms=recv_ms), merge=True)
                transition = "failed"
                rec_action = "state_update"
            elif event_type in {"payment.refunded"}:
                firebase_db.collection("payments").document(payment_id).set(payment_state_update("refunded", updated_at_ms=recv_ms), merge=True)
                transition = "refunded"
                rec_action = "state_update"
        ev_ref.set({"processing_status": "processed", "reconciliation_status": rec_action}, merge=True)
    except Exception as exc:
        fail_reason = str(exc)
        ev_ref.set({"processing_status": "failed", "reconciliation_status": "retry_needed"}, merge=True)

    firebase_db.collection("payment_processor_audit_logs").add({"processor": "razorpay", "event_type": event_type, "event_id": event_id, "payment_id": payment_id, "verification_result": "verified", "replay_detected": False, "transition_applied": transition, "reconciliation_action": rec_action, "processing_latency_ms": max(0, int(time.time()*1000)-recv_ms), "failure_reason": fail_reason, "actor": "webhook", "processed_at": int(time.time()*1000)})
    return {"ok": True, "event_id": event_id, "transition": transition}


@api_router.post("/jobs/payments/recover-stale-processing")
async def payments_recover_stale_processing_job(request: Request, authorization: str | None = Header(default=None)):
    _, _ = _require_capability(request, authorization, {"admin", "super_admin"}, "payments_recover_stale_processing")
    return recover_stale_processing_payments(firebase_db, logger)


@api_router.post("/jobs/payments/expire-pending")
async def payments_expire_pending_job(request: Request, authorization: str | None = Header(default=None)):
    _, _ = _require_capability(request, authorization, {"admin", "super_admin"}, "payments_expire_pending")
    return expire_abandoned_pending_payments(firebase_db, logger)


class EnqueueAsyncJobRequest(BaseModel):
    job_type: str
    payload: dict = {}
    dedupe_key: str = ""
    priority: int = 5
    scheduled_for_ms: int = 0
    max_retries: int = 5


@api_router.post("/jobs/async/enqueue")
async def enqueue_async_job(payload: EnqueueAsyncJobRequest, request: Request, authorization: str | None = Header(default=None)):
    uid, _ = _require_capability(request, authorization, {"admin", "super_admin", "moderator"}, "enqueue_async_job")
    return enqueue_job(firebase_db, job_type=payload.job_type, payload=payload.payload or {}, dedupe_key=payload.dedupe_key, priority=payload.priority, scheduled_for=payload.scheduled_for_ms, max_retries=payload.max_retries, correlation_id=uid)


@api_router.post("/jobs/async/worker-tick")
async def async_worker_tick(request: Request, authorization: str | None = Header(default=None)):
    uid, _ = _require_capability(request, authorization, {"admin", "super_admin"}, "async_worker_tick")
    return run_worker_loop_once(firebase_db, logger, worker_id=f"worker:{uid}")


@api_router.post("/jobs/async/scheduler-tick")
async def async_scheduler_tick(request: Request, authorization: str | None = Header(default=None)):
    uid, _ = _require_capability(request, authorization, {"admin", "super_admin"}, "async_scheduler_tick")
    return run_async_scheduler_tick(firebase_db, logger, owner=f"scheduler:{uid}")


@api_router.get("/jobs/async/metrics")
async def async_metrics(request: Request, authorization: str | None = Header(default=None)):
    _, _ = _require_capability(request, authorization, {"admin", "super_admin", "moderator"}, "async_metrics")
    if firebase_db is None:
        raise HTTPException(status_code=500, detail="Firebase service not configured")
    queued = len(list(firebase_db.collection("async_jobs").where("status", "in", ["queued", "scheduled", "retrying"]).limit(500).stream()))
    dead = len(list(firebase_db.collection("dead_letter_jobs").limit(500).stream()))
    failed_recent = len(list(firebase_db.collection("worker_metrics").where("status", "==", "failed").limit(200).stream()))
    return {"ok": True, "queue_depth": queued, "dead_letter": dead, "failed_recent": failed_recent}


# Include routes after every endpoint has been attached to the router.
app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        client.close()
