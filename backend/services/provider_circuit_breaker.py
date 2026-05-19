import time


def _key(provider: str) -> str:
    return f"provider:{provider}"


def get_state(firebase_db, provider: str) -> dict:
    if firebase_db is None:
        return {"state": "closed", "failures": 0, "opened_at": 0}
    snap = firebase_db.collection("provider_circuit_breakers").document(_key(provider)).get()
    return snap.to_dict() or {"state": "closed", "failures": 0, "opened_at": 0}


def record_result(firebase_db, logger, provider: str, success: bool, latency_ms: int = 0):
    if firebase_db is None:
        return
    ref = firebase_db.collection("provider_circuit_breakers").document(_key(provider))
    cur = get_state(firebase_db, provider)
    failures = int(cur.get("failures") or 0)
    state = str(cur.get("state") or "closed")
    now_ms = int(time.time() * 1000)
    if success:
        failures = 0 if state != "open" else failures
        if state == "half_open":
            state = "closed"
    else:
        failures += 1
        if failures >= 5 and state == "closed":
            state = "open"
            logger.warning("[circuit_breaker_opened] provider=%s failures=%s", provider, failures)
        elif state == "open" and now_ms - int(cur.get("opened_at") or 0) > 60000:
            state = "half_open"
    ref.set({"provider": provider, "state": state, "failures": failures, "opened_at": now_ms if state == "open" else cur.get("opened_at", 0), "updated_at": now_ms, "last_latency_ms": latency_ms}, merge=True)


def allow_request(firebase_db, provider: str) -> bool:
    cur = get_state(firebase_db, provider)
    state = str(cur.get("state") or "closed")
    if state == "closed":
        return True
    now_ms = int(time.time() * 1000)
    if state == "open":
        opened_at = int(cur.get("opened_at") or 0)
        return now_ms - opened_at > 60000
    return True
