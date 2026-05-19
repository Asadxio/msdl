import time

PAYMENT_STATES = {
    "pending", "processing", "succeeded", "failed", "cancelled", "refunded", "disputed", "expired"
}

ALLOWED_TRANSITIONS = {
    "pending": {"processing", "cancelled", "expired", "failed"},
    "processing": {"succeeded", "failed", "cancelled", "disputed", "expired"},
    "succeeded": {"refunded", "disputed"},
    "failed": set(),
    "cancelled": set(),
    "refunded": set(),
    "disputed": {"refunded"},
    "expired": set(),
}


def can_transition(current: str, nxt: str) -> bool:
    c = str(current or "pending")
    n = str(nxt or "")
    if n not in PAYMENT_STATES:
        return False
    if c == n:
        return True
    return n in ALLOWED_TRANSITIONS.get(c, set())


def payment_doc_id(user_id: str, operation_id: str) -> str:
    return f"{user_id}:{operation_id}"[:180]


def is_recent(created_at_ms: int, ttl_ms: int = 30 * 60 * 1000) -> bool:
    return int(time.time() * 1000) - int(created_at_ms or 0) <= ttl_ms
