import time


def reclaim_stale_leases(firebase_db, logger, limit: int = 200) -> dict:
    if firebase_db is None:
        return {"ok": False, "error": "firebase_unavailable"}
    now_ms = int(time.time() * 1000)
    docs = list(firebase_db.collection("notification_dispatch_queue")\
        .where("status", "==", "processing")\
        .where("lease_expires_at", "<", now_ms)\
        .limit(limit).stream())
    reclaimed = 0
    for d in docs:
        data = d.to_dict() or {}
        attempts = int(data.get("attempts") or 0)
        d.reference.set({
            "status": "retrying",
            "lease_owner": "",
            "lease_expires_at": 0,
            "scheduled_at": now_ms + 1000,
            "backoff_until": now_ms + 1000,
            "lease_recovery_count": int(data.get("lease_recovery_count") or 0) + 1,
        }, merge=True)
        reclaimed += 1
        logger.warning("[stale_lease_reclaimed] queue_id=%s attempts=%s", d.id, attempts)
    return {"ok": True, "reclaimed": reclaimed, "scanned": len(docs)}
