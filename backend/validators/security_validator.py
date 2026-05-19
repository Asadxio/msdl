import hashlib
import time


def canonical_hash(payload: dict) -> str:
    stable = "|".join(f"{k}={payload[k]}" for k in sorted(payload.keys()))
    return hashlib.sha256(stable.encode("utf-8")).hexdigest()


def validate_transition(current: str, nxt: str, allowed: dict[str, set[str]]) -> bool:
    if current == nxt:
        return True
    return nxt in allowed.get(current, set())


def validate_timestamp_fresh(client_ms: int, max_skew_ms: int = 5 * 60 * 1000) -> bool:
    now_ms = int(time.time() * 1000)
    return abs(now_ms - int(client_ms or 0)) <= max_skew_ms
