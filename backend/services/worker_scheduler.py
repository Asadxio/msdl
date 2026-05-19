import time
from services.fanout_worker import process_queue_once


def run_scheduler_tick(firebase_db, logger, worker_id_prefix: str = "auto", max_workers: int = 4) -> dict:
    if firebase_db is None:
        return {"ok": False, "error": "firebase_unavailable"}
    queue_depth = len(list(firebase_db.collection("notification_dispatch_queue").where("status", "in", ["queued", "retrying"]).limit(1000).stream()))
    workers = min(max_workers, max(1, queue_depth // 50 + 1))
    logger.info("[worker_autoscaled] queue_depth=%s workers=%s", queue_depth, workers)
    processed = 0
    deadlettered = 0
    for idx in range(workers):
        res = process_queue_once(firebase_db, logger, worker_id=f"{worker_id_prefix}-{idx}", limit=20)
        processed += int(res.get("processed") or 0)
        deadlettered += int(res.get("deadlettered") or 0)
        if queue_depth > 800:
            logger.warning("[partition_pressure_detected] queue_depth=%s worker=%s", queue_depth, idx)
    return {"ok": True, "queue_depth": queue_depth, "workers": workers, "processed": processed, "deadlettered": deadlettered, "ts": int(time.time() * 1000)}
