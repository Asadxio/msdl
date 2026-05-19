import time
from collections import defaultdict, deque

_BUCKETS: dict[str, deque[float]] = defaultdict(deque)
_LOCKED_UNTIL: dict[str, float] = {}


def allow(key: str, limit_count: int, window_sec: int) -> bool:
    now = time.time()
    if _LOCKED_UNTIL.get(key, 0) > now:
        return False

    q = _BUCKETS[key]
    while q and now - q[0] > window_sec:
        q.popleft()
    if len(q) >= limit_count:
        return False
    q.append(now)
    return True


def abuse_score(key: str, window_sec: int = 300) -> int:
    now = time.time()
    q = _BUCKETS[key]
    while q and now - q[0] > window_sec:
        q.popleft()
    return len(q)


def temporary_lock(key: str, lock_seconds: int = 300) -> None:
    _LOCKED_UNTIL[key] = time.time() + max(1, lock_seconds)
