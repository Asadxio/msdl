import time
from .retryEngine import bounded_backoff_ms, should_retry


def claim_job(firebase_db, job_id: str, worker_id: str, lease_ms: int = 30_000) -> bool:
    if firebase_db is None:
        return False
    ref = firebase_db.collection("background_jobs").document(job_id)
    snap = ref.get()
    if not snap.exists:
        return False
    data = snap.to_dict() or {}
    now = int(time.time() * 1000)
    if int(data.get("lease_expires_at") or 0) > now and data.get("lease_owner") not in ("", worker_id):
        return False
    ref.set({
        "lease_owner": worker_id,
        "lease_expires_at": now + lease_ms,
        "updated_at_ms": now,
        "status": "running",
    }, merge=True)
    return True


def complete_job(firebase_db, job_id: str, ok: bool, error: str = "") -> None:
    if firebase_db is None:
        return
    now = int(time.time() * 1000)
    firebase_db.collection("background_jobs").document(job_id).set({
        "status": "done" if ok else "failed",
        "error": str(error)[:400],
        "lease_owner": "",
        "lease_expires_at": 0,
        "updated_at_ms": now,
    }, merge=True)


def fail_with_retry(firebase_db, job_id: str, attempt: int, max_attempts: int, error: str) -> dict:
    now = int(time.time() * 1000)
    retry = should_retry(attempt, max_attempts)
    backoff = bounded_backoff_ms(attempt) if retry else 0
    patch = {
        "attempt": int(attempt),
        "max_attempts": int(max_attempts),
        "error": str(error)[:400],
        "status": "queued" if retry else "dead",
        "lease_owner": "",
        "lease_expires_at": 0,
        "updated_at_ms": now,
    }
    if retry:
        patch["scheduled_at_ms"] = now + backoff
    if firebase_db is not None:
        firebase_db.collection("background_jobs").document(job_id).set(patch, merge=True)
    return {"retry": retry, "backoff_ms": backoff}
