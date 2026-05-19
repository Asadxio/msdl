import hashlib
import time

_CACHE: dict[str, tuple[float, dict]] = {}


def _key(feature: str, payload: dict) -> str:
    raw = f"{feature}|" + "|".join(f"{k}={payload[k]}" for k in sorted(payload.keys()))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def cached_call(feature: str, payload: dict, ttl_sec: int, producer):
    k = _key(feature, payload)
    now = time.time()
    hit = _CACHE.get(k)
    if hit and now - hit[0] <= ttl_sec:
        return {**hit[1], "cache_hit": True}
    out = producer(payload)
    _CACHE[k] = (now, out)
    return {**out, "cache_hit": False}
