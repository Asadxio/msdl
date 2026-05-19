from jobs.storageCleanup import mark_orphan_media_for_cleanup


def handle_cleanup(firebase_db, logger, payload: dict) -> dict:
    limit_count = int((payload or {}).get("limit_count") or 100)
    return mark_orphan_media_for_cleanup(firebase_db, limit_count)
