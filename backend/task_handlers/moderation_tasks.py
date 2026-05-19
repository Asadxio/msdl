def handle_moderation_aggregate(firebase_db, logger, payload: dict) -> dict:
    if firebase_db is None:
        return {"ok": False, "reason": "no_db"}
    docs = list(firebase_db.collection("message_reports").limit(300).stream())
    by_user = {}
    for d in docs:
        t = d.to_dict() or {}
        uid = str(t.get("target_user_id") or "unknown")
        by_user[uid] = by_user.get(uid, 0) + 1
    firebase_db.collection("moderation_aggregates").document("repeat_offenders").set({"counts": by_user}, merge=True)
    return {"ok": True, "users": len(by_user), "reports": len(docs)}
