import time


def mark_orphan_media_for_cleanup(firebase_db, limit_count: int = 100) -> dict:
    if firebase_db is None:
        return {"ok": False, "reason": "no_db"}
    now = int(time.time() * 1000)
    scanned = 0
    marked = 0
    docs = firebase_db.collection("media_uploads").where("status", "==", "orphan").limit(limit_count).stream()
    for d in docs:
      scanned += 1
      data = d.to_dict() or {}
      if data.get("cleanup_marked_at_ms"):
          continue
      d.reference.set({
          "cleanup_marked": True,
          "cleanup_marked_at_ms": now,
          "cleanup_reason": "orphan_detected",
      }, merge=True)
      marked += 1
    return {"ok": True, "scanned": scanned, "marked": marked}
