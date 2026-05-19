import random


def bounded_backoff_ms(attempt: int, base_ms: int = 500, cap_ms: int = 60_000) -> int:
    bounded_attempt = max(0, min(int(attempt), 8))
    exp = min(cap_ms, base_ms * (2 ** bounded_attempt))
    jitter = random.randint(0, max(1, int(exp * 0.2)))
    return min(cap_ms, exp + jitter)


def should_retry(attempt: int, max_attempts: int) -> bool:
    return int(attempt) < int(max_attempts)
