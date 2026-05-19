import time
from services.throughput_fairness import lane_quota

_BUCKETS = {}


def _bucket_key(provider: str, lane: str) -> str:
    return f"{provider}:{lane}"


def should_shape(provider: str, lane: str, requested: int) -> tuple[bool, int]:
    now = time.time()
    key = _bucket_key(provider, lane)
    cap = lane_quota(lane)
    rate = max(5, cap // 5)
    state = _BUCKETS.get(key, {"tokens": float(cap), "last": now})
    elapsed = max(0.0, now - state["last"])
    state["tokens"] = min(float(cap), state["tokens"] + elapsed * rate)
    state["last"] = now
    if requested <= state["tokens"]:
        state["tokens"] -= requested
        _BUCKETS[key] = state
        return False, requested
    allowed = int(max(0.0, state["tokens"]))
    state["tokens"] = 0.0
    _BUCKETS[key] = state
    return True, allowed
