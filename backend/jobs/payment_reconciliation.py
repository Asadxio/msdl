import time
from firebase_admin import firestore as admin_firestore
from payments.payment_finalizer import finalize_successful_payment
from security.paymentSecurity import can_transition


def _env_int(name: str, default: int) -> int:
    import os
    try:
        return int(os.environ.get(name, str(default)))
    except Exception:
        return default


def recover_stale_processing_payments(firebase_db, logger) -> dict:
    if firebase_db is None:
        return {"ok": False, "reason": "no_db"}
    stale_minutes = _env_int("PAYMENT_PROCESSING_STALE_MINUTES", 30)
    limit_count = _env_int("PAYMENT_RECONCILIATION_BATCH_LIMIT", 100)
    cutoff = int(time.time() * 1000) - stale_minutes * 60 * 1000
    docs = list(firebase_db.collection("payments").where("state", "==", "processing").limit(limit_count).stream())
    scanned = 0
    recovered = 0
    failed = 0
    for d in docs:
        scanned += 1
        p = d.to_dict() or {}
        updated_ms = int(p.get("updated_at_ms") or p.get("created_at_ms") or 0)
        if updated_ms > cutoff:
            continue
        tx_ref = str(p.get("transaction_ref") or "")
        if tx_ref and tx_ref.lower().startswith("ok_"):
            try:
                finalize_successful_payment(firebase_db, d.id, "reconciliation_worker")
                recovered += 1
            except Exception as exc:
                failed += 1
                logger.warning("reconcile_finalize_failed payment=%s err=%s", d.id, exc)
        else:
            if can_transition("processing", "failed"):
                d.reference.set({"state": "failed", "reconciliation": {"failed_by_worker": True, "updated_at_ms": int(time.time()*1000)}, "updated_at": admin_firestore.SERVER_TIMESTAMP}, merge=True)
                firebase_db.collection("payment_audit_logs").add({"payment_id": d.id, "actor_id": "reconciliation_worker", "action": "mark_failed_stale_processing", "created_at_ms": int(time.time()*1000)})
    return {"ok": True, "scanned": scanned, "recovered": recovered, "failed": failed}


def expire_abandoned_pending_payments(firebase_db, logger) -> dict:
    if firebase_db is None:
        return {"ok": False, "reason": "no_db"}
    exp_minutes = _env_int("PAYMENT_PENDING_EXPIRATION_MINUTES", 60)
    limit_count = _env_int("PAYMENT_RECONCILIATION_BATCH_LIMIT", 100)
    cutoff = int(time.time() * 1000) - exp_minutes * 60 * 1000
    docs = list(firebase_db.collection("payments").where("state", "==", "pending").limit(limit_count).stream())
    scanned = 0
    expired = 0
    for d in docs:
        scanned += 1
        p = d.to_dict() or {}
        created_ms = int(p.get("created_at_ms") or 0)
        if created_ms and created_ms < cutoff and can_transition("pending", "expired"):
            d.reference.set({"state": "expired", "reconciliation": {"expired_by_worker": True, "updated_at_ms": int(time.time()*1000)}, "updated_at": admin_firestore.SERVER_TIMESTAMP}, merge=True)
            firebase_db.collection("payment_audit_logs").add({"payment_id": d.id, "actor_id": "expiration_worker", "action": "expire_pending", "created_at_ms": int(time.time()*1000)})
            expired += 1
    return {"ok": True, "scanned": scanned, "expired": expired}
