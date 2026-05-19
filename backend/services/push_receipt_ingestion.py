import json
import time
from urllib import request as urlrequest


def _post_expo_json(url: str, payload: dict | list) -> dict:
    req = urlrequest.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    with urlrequest.urlopen(req, timeout=15) as response:
        return json.loads(response.read().decode("utf-8") or "{}")


def poll_push_receipts(firebase_db, logger, normalize_expo_receipt_status, limit: int = 300) -> dict:
    if firebase_db is None:
        return {"ok": False, "error": "firebase_unavailable"}
    pending_docs = list(firebase_db.collection("notification_provider_receipts")\
        .where("provider", "==", "expo")\
        .where("resolved", "==", False)\
        .limit(limit).stream())
    if not pending_docs:
        return {"ok": True, "checked": 0, "updated": 0}

    ticket_to_doc = {}
    ticket_ids = []
    for d in pending_docs:
        data = d.to_dict() or {}
        tid = str(data.get("provider_ticket_id") or "")
        if not tid:
            continue
        ticket_to_doc[tid] = (d.reference, data)
        ticket_ids.append(tid)

    updated = 0
    now_ms = int(time.time() * 1000)
    for i in range(0, len(ticket_ids), 300):
        chunk = ticket_ids[i:i + 300]
        try:
            res = _post_expo_json("https://exp.host/--/api/v2/push/getReceipts", {"ids": chunk})
        except Exception as exc:
            logger.warning("[provider_receipt_received] polling failed: %s", exc)
            logger.warning("[provider_outage_detected] provider=expo error=%s", exc)
            continue
        receipts = res.get("data") or {}
        for ticket_id, receipt in receipts.items():
            info = ticket_to_doc.get(ticket_id)
            if not info:
                continue
            ref, meta = info
            canonical_status, failure_category, provider_error = normalize_expo_receipt_status(receipt or {})
            dedupe_id = str(meta.get("dedupe_id") or "")
            recipient_id = str(meta.get("recipient_id") or "")
            key = f"{dedupe_id}:{recipient_id or 'broadcast'}"
            log_ref = firebase_db.collection("notification_delivery_logs").document(key)
            log_ref.set({
                "provider_receipt_id": ticket_id,
                "provider_status": canonical_status,
                "provider_error": provider_error,
                "provider_response": receipt,
                "receipt_checked_at": now_ms,
                "updated_at": now_ms,
                "status": canonical_status,
                "failure_category": failure_category,
                "receipt_latency_ms": max(0, now_ms - int(meta.get("sent_at_ms") or now_ms)),
            }, merge=True)
            ref.set({"resolved": canonical_status in {"provider_delivered", "provider_failed"}, "receipt_checked_at": now_ms, "provider_status": canonical_status}, merge=True)
            updated += 1
            if canonical_status == "provider_delivered":
                logger.info("[provider_delivery_confirmed] dedupe=%s receipt=%s", dedupe_id, ticket_id)
            elif canonical_status == "provider_failed":
                logger.warning("[provider_delivery_failed] dedupe=%s receipt=%s category=%s", dedupe_id, ticket_id, failure_category)
    return {"ok": True, "checked": len(ticket_ids), "updated": updated}
