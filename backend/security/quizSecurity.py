import hashlib
import time


def attempt_key(uid: str, quiz_id: str, nonce: str) -> str:
    raw = f"{uid}:{quiz_id}:{nonce}".encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


def operation_key(uid: str, op_id: str) -> str:
    return hashlib.sha256(f"{uid}:{op_id}".encode("utf-8")).hexdigest()


def is_attempt_expired(started_at_ms: int, ttl_ms: int = 25 * 60 * 1000) -> bool:
    return int(time.time() * 1000) - int(started_at_ms or 0) > ttl_ms


def suspicious_timing(started_at_ms: int, answered_at_ms: int, min_duration_ms: int = 4000) -> bool:
    return max(0, int(answered_at_ms) - int(started_at_ms)) < min_duration_ms
