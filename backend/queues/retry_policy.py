import random


def classify_failure(error: str) -> str:
    e = str(error or "").lower()
    if any(k in e for k in ["invalid", "malformed", "forbidden", "not found", "validation"]):
        return "permanent"
    if any(k in e for k in ["timeout", "throttle", "unavailable", "connection", "temporary"]):
        return "transient"
    return "transient"


def next_backoff_ms(retry_count: int, base_ms: int = 500, cap_ms: int = 120_000) -> int:
    exp = min(cap_ms, base_ms * (2 ** max(0, min(10, int(retry_count)))))
    jitter = random.randint(0, max(1, int(exp * 0.25)))
    return min(cap_ms, exp + jitter)
