import time
from collections import defaultdict, deque

_abuse: dict[str, int] = defaultdict(int)
_recent: dict[str, deque[float]] = defaultdict(deque)


def validate_secure_action(action: str, actor_id: str, session_id: str, device_id: str, timestamp_ms: int, idempotency_key: str = "") -> tuple[bool, str]:
    if not action or not actor_id or not session_id or not device_id:
        return False, "missing_context"
    now_ms = int(time.time() * 1000)
    if abs(now_ms - int(timestamp_ms or 0)) > 5 * 60 * 1000:
        return False, "stale_action"
    key = idempotency_key or f"{action}:{actor_id}:{timestamp_ms//1000}"
    q = _recent[key]
    while q and time.time() - q[0] > 60:
        q.popleft()
    if q:
        _abuse[actor_id] += 2
        return False, "replay_detected"
    q.append(time.time())
    return True, "ok"


def register_security_event(firebase_db, event: str, payload: dict):
    if firebase_db is None:
        return
    firebase_db.collection("security_audit_logs").add({
        "event": str(event),
        "payload": payload,
        "created_at_ms": int(time.time() * 1000),
    })


def evaluate_abuse_risk(actor_id: str) -> dict:
    score = int(_abuse.get(actor_id, 0))
    risk = "high" if score >= 20 else ("medium" if score >= 10 else "low")
    return {"actor_id": actor_id, "score": score, "risk": risk}


def rotate_security_state(actor_id: str):
    _abuse[actor_id] = max(0, _abuse.get(actor_id, 0) // 2)
