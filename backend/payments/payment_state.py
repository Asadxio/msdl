"""Payment state/status compatibility helpers."""


def payment_state_update(next_state: str, **extra) -> dict:
    """Return an update that keeps canonical state and legacy status in sync."""
    state = str(next_state or "").strip().lower()
    return {**extra, "state": state, "status": state}
