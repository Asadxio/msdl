import time
from jobs.jobFramework import claim_job, complete_job, fail_with_retry
from jobs.jobMetrics import record_job_metric
from jobs.storageCleanup import mark_orphan_media_for_cleanup


def run_maintenance_once(firebase_db, logger, worker_id: str = "maintenance-worker") -> dict:
    if firebase_db is None:
        return {"ok": False, "reason": "no_db"}
    now = int(time.time() * 1000)
    docs = list(firebase_db.collection("background_jobs").where("status", "==", "queued").where("scheduled_at_ms", "<=", now).limit(10).stream())
    processed = 0
    for d in docs:
        data = d.to_dict() or {}
        if not claim_job(firebase_db, d.id, worker_id):
            continue
        start = int(time.time() * 1000)
        job_type = str(data.get("job_type") or "")
        attempt = int(data.get("attempt") or 0) + 1
        max_attempts = int(data.get("max_attempts") or 3)
        try:
            if job_type == "storage_cleanup":
                result = mark_orphan_media_for_cleanup(firebase_db, int(data.get("limit_count") or 100))
            else:
                result = {"ok": True, "skipped": True, "job_type": job_type}
            complete_job(firebase_db, d.id, True)
            record_job_metric(firebase_db, job_type or "unknown", "success", int(time.time() * 1000) - start, result)
            processed += 1
        except Exception as exc:
            retry_info = fail_with_retry(firebase_db, d.id, attempt, max_attempts, str(exc))
            record_job_metric(firebase_db, job_type or "unknown", "failed", int(time.time() * 1000) - start, retry_info)
            logger.warning("maintenance_job_failed job_id=%s type=%s err=%s", d.id, job_type, exc)
    return {"ok": True, "processed": processed, "queued_checked": len(docs)}
