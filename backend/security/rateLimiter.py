import time
from collections import defaultdict, deque

_BUCKETS: dict[str, deque[float]] = defaultdict(deque)


def allow(key: str, limit_count: int, window_sec: int) -> bool:
    now = time.time()
    q = _BUCKETS[key]
    while q and now - q[0] > window_sec:
        q.popleft()
    if len(q) >= limit_count:
        return False
    q.append(now)
    return True
