import time
from services.provider_circuit_breaker import get_state
from services.provider_router import route_tokens


def _adaptive_batch_size(firebase_db, provider: str, default_size: int) -> int:
    state = get_state(firebase_db, provider) if firebase_db is not None else {"state": "closed", "last_latency_ms": 0}
    st = str(state.get("state") or "closed")
    lat = int(state.get("last_latency_ms") or 0)
    if st == "open":
        return max(10, default_size // 4)
    if st == "half_open" or lat > 2500:
        return max(20, default_size // 2)
    if lat < 800:
        return min(default_size + 20, 200)
    return default_size


def partition_job(job: dict, tokens_by_user: dict[str, list[str]], batch_size: int = 100, firebase_db=None, logger=None) -> list[dict]:
    recipients = job.get("recipients") or []
    token_map: dict[str, list[str]] = {}
    for uid in recipients:
        for tok in tokens_by_user.get(uid, []):
            token_map.setdefault(uid, []).append(tok)
    all_tokens = [t for arr in token_map.values() for t in arr]
    grouped = route_tokens(all_tokens)
    out: list[dict] = []
    for provider, tokens in grouped.items():
        if not tokens:
            continue
        dynamic_size = _adaptive_batch_size(firebase_db, provider, batch_size)
        if logger and dynamic_size != batch_size:
            logger.info("[adaptive_batch_resized] provider=%s from=%s to=%s", provider, batch_size, dynamic_size)
        for i in range(0, len(tokens), dynamic_size):
            out.append({
                "provider": provider,
                "tokens": tokens[i:i + dynamic_size],
                "priority": int(job.get("priority") or 5),
                "queue_id": job.get("queue_id"),
                "dedupe_id": job.get("dedupe_id"),
                "created_at": int(time.time() * 1000),
            })
    return out


def next_backoff(attempts: int) -> int:
    base = min(300000, 1000 * (2 ** max(1, attempts)))
    jitter = int(base * (0.1 + min(0.4, attempts * 0.03)))
    return base + jitter
