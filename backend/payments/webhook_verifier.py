import hmac
import hashlib
import time


def verify_razorpay_signature(payload: bytes, signature: str, secret: str) -> tuple[bool, str]:
    if not payload or not isinstance(payload, (bytes, bytearray)):
        return False, "malformed_payload"
    if not signature or not isinstance(signature, str):
        return False, "missing_signature"
    if not secret or not isinstance(secret, str):
        return False, "missing_secret"
    try:
        digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    except Exception:
        return False, "signature_compute_failed"
    if not hmac.compare_digest(digest, signature.strip()):
        return False, "signature_mismatch"
    return True, "ok"


def is_webhook_timestamp_valid(ts_header: str, replay_window_seconds: int = 300, future_skew_seconds: int = 60) -> tuple[bool, str]:
    if not ts_header:
        return False, "missing_timestamp"
    try:
        ts = int(str(ts_header).strip())
    except (TypeError, ValueError):
        return False, "malformed_timestamp"
    now = int(time.time())
    if ts > now + int(future_skew_seconds):
        return False, "future_skew"
    if now - ts > int(replay_window_seconds):
        return False, "stale"
    return True, "ok"
