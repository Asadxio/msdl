import time
from queues.queue_manager import dequeue_job, acknowledge_job, retry_job
from task_handlers.payment_tasks import handle_payment_reconcile
from task_handlers.notification_tasks import handle_notification_delivery
from task_handlers.cleanup_tasks import handle_cleanup
from task_handlers.moderation_tasks import handle_moderation_aggregate

HANDLERS = {
    "payment_reconciliation": handle_payment_reconcile,
    "notification_delivery": handle_notification_delivery,
    "cleanup": handle_cleanup,
    "moderation_aggregate": handle_moderation_aggregate,
}


def run_worker_loop_once(firebase_db, logger, worker_id: str = "worker-runtime", lease_ms: int = 60000) -> dict:
    if firebase_db is None:
        return {"ok": False, "reason": "no_db"}
    claim = dequeue_job(firebase_db, worker_id=worker_id, lease_ms=lease_ms)
    job = claim.get("job")
    if not job:
        return {"ok": True, "processed": 0}
    jtype = str(job.get("job_type") or "")
    handler = HANDLERS.get(jtype)
    started = int(time.time() * 1000)
    if not handler:
        retry_job(firebase_db, job, f"unknown_job_type:{jtype}")
        return {"ok": True, "processed": 1, "status": "retried_unknown"}
    try:
        out = handler(firebase_db, logger, job.get("payload") or {})
        acknowledge_job(firebase_db, str(job.get("job_id")), out)
        firebase_db.collection("worker_metrics").add({"worker_id": worker_id, "job_id": job.get("job_id"), "job_type": jtype, "status": "completed", "duration_ms": int(time.time()*1000)-started, "created_at_ms": int(time.time()*1000)})
        return {"ok": True, "processed": 1, "job_type": jtype}
    except Exception as exc:
        retry_job(firebase_db, job, str(exc))
        firebase_db.collection("worker_metrics").add({"worker_id": worker_id, "job_id": job.get("job_id"), "job_type": jtype, "status": "failed", "error": str(exc)[:400], "duration_ms": int(time.time()*1000)-started, "created_at_ms": int(time.time()*1000)})
        return {"ok": True, "processed": 1, "job_type": jtype, "retried": True}
