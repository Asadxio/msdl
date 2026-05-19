import time
from queues.queue_manager import enqueue_job


def run_scheduler_tick(firebase_db, logger, owner: str = "scheduler") -> dict:
    if firebase_db is None:
        return {"ok": False, "reason": "no_db"}
    now = int(time.time() * 1000)
    lock_ref = firebase_db.collection("scheduler_leases").document("global")
    lease = (lock_ref.get().to_dict() or {})
    if int(lease.get("lease_expires_at") or 0) > now and lease.get("owner") not in ("", owner):
        return {"ok": True, "skipped": "lease_taken"}
    lock_ref.set({"owner": owner, "lease_expires_at": now + 30_000, "updated_at_ms": now}, merge=True)

    jobs = [
        ("payment_reconciliation", {"mode": "recover"}, "sched:pay:recover", 9),
        ("payment_reconciliation", {"mode": "expire"}, "sched:pay:expire", 8),
        ("notification_delivery", {}, "sched:notif", 7),
        ("cleanup", {"limit_count": 100}, "sched:cleanup", 5),
        ("moderation_aggregate", {}, "sched:mod", 4),
    ]
    queued = 0
    for job_type, payload, dedupe, priority in jobs:
        res = enqueue_job(firebase_db, job_type=job_type, payload=payload, dedupe_key=f"{dedupe}:{now//60000}", priority=priority, scheduled_for=now)
        if res.get("ok"):
            queued += 1
    return {"ok": True, "queued": queued}
