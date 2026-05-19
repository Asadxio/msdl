import hashlib
import time

def attempt_key(uid: str, quiz_id: str, nonce: str) -> str:
    raw = f"{uid}:{quiz_id}:{nonce}".encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


def is_attempt_expired(started_at_ms: int, ttl_ms: int = 25 * 60 * 1000) -> bool:
    return int(time.time() * 1000) - int(started_at_ms or 0) > ttl_ms
