import time
import uuid
from queues.job_models import QueueJob
from queues.retry_policy import next_backoff_ms, classify_failure


QUEUE_COLLECTION = "async_jobs"
DLQ_COLLECTION = "dead_letter_jobs"


def enqueue_job(firebase_db, job_type: str, payload: dict, dedupe_key: str = "", priority: int = 5, scheduled_for: int = 0, max_retries: int = 5, correlation_id: str = "") -> dict:
    if firebase_db is None:
        return {"ok": False, "reason": "no_db"}
    if dedupe_key:
        dup = list(firebase_db.collection(QUEUE_COLLECTION).where("dedupe_key", "==", dedupe_key).where("status", "in", ["queued", "scheduled", "processing", "retrying"]).limit(1).stream())
        if dup:
            return {"ok": True, "job_id": dup[0].id, "deduped": True}
    jid = str(uuid.uuid4())
    job = QueueJob(job_id=jid, job_type=job_type, status="scheduled" if scheduled_for else "queued", priority=max(1, min(10, int(priority))), scheduled_for=int(scheduled_for or 0), payload=payload or {}, dedupe_key=dedupe_key, max_retries=max_retries, correlation_id=correlation_id)
    firebase_db.collection(QUEUE_COLLECTION).document(jid).set(job.to_dict(), merge=True)
    return {"ok": True, "job_id": jid, "deduped": False}


def dequeue_job(firebase_db, worker_id: str, lease_ms: int = 60_000) -> dict:
    if firebase_db is None:
        return {"ok": False, "reason": "no_db"}
    now = int(time.time() * 1000)
    docs = list(firebase_db.collection(QUEUE_COLLECTION).where("status", "in", ["queued", "scheduled", "retrying", "processing"]).limit(40).stream())
    candidates = []
    for d in docs:
        j = d.to_dict() or {}
        if j.get("status") == "scheduled" and int(j.get("scheduled_for") or 0) > now:
            continue
        if j.get("status") == "processing" and int(j.get("lock_expiry") or 0) > now:
            continue
        candidates.append((d, j))
    if not candidates:
        return {"ok": True, "job": None}
    candidates.sort(key=lambda x: (-int(x[1].get("priority") or 0), int(x[1].get("created_at") or 0)))
    d, _ = candidates[0]
    d.reference.set({"status": "processing", "locked_by": worker_id, "lock_expiry": now + lease_ms, "started_at": now}, merge=True)
    out = d.reference.get().to_dict() or {}
    return {"ok": True, "job": out}


def acknowledge_job(firebase_db, job_id: str, result: dict | None = None) -> None:
    now = int(time.time() * 1000)
    firebase_db.collection(QUEUE_COLLECTION).document(job_id).set({"status": "completed", "completed_at": now, "locked_by": "", "lock_expiry": 0, "metadata": {"result": result or {}}}, merge=True)


def dead_letter_job(firebase_db, job: dict, error: str) -> None:
    now = int(time.time() * 1000)
    jid = str(job.get("job_id") or "")
    firebase_db.collection(DLQ_COLLECTION).document(jid).set({"job": job, "failure_reason": str(error)[:800], "dead_lettered_at": now}, merge=True)
    firebase_db.collection(QUEUE_COLLECTION).document(jid).set({"status": "dead_lettered", "failure_reason": str(error)[:800], "completed_at": now, "locked_by": "", "lock_expiry": 0}, merge=True)


def retry_job(firebase_db, job: dict, error: str) -> None:
    now = int(time.time() * 1000)
    rc = int(job.get("retry_count") or 0) + 1
    max_retries = int(job.get("max_retries") or 5)
    if rc > max_retries or classify_failure(error) == "permanent":
        dead_letter_job(firebase_db, {**job, "retry_count": rc}, error)
        return
    backoff = next_backoff_ms(rc)
    firebase_db.collection(QUEUE_COLLECTION).document(str(job.get("job_id"))).set({"status": "retrying", "retry_count": rc, "failure_reason": str(error)[:800], "scheduled_for": now + backoff, "locked_by": "", "lock_expiry": 0}, merge=True)
