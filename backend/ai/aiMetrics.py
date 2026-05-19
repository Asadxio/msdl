import time


def log_ai_metric(firebase_db, kind: str, payload: dict) -> None:
    if firebase_db is None:
        return
    firebase_db.collection("ai_metrics").add({
        "kind": str(kind)[:64],
        "payload": payload,
        "created_at_ms": int(time.time() * 1000),
    })
