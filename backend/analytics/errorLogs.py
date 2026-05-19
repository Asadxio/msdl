import time


def compact_error(payload: dict) -> dict:
    return {
        "kind": str(payload.get("kind") or "unknown")[:64],
        "message": str(payload.get("message") or "")[:500],
        "code": str(payload.get("code") or "")[:80],
        "screen": str(payload.get("screen") or "")[:120],
        "network": str(payload.get("network") or "")[:32],
        "retry_count": int(payload.get("retry_count") or 0),
        "at_ms": int(payload.get("at_ms") or int(time.time() * 1000)),
    }


def write_error_event(firebase_db, payload: dict) -> None:
    if firebase_db is None:
        return
    firebase_db.collection("analytics_error_events").add(compact_error(payload))
