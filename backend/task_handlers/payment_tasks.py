from jobs.payment_reconciliation import recover_stale_processing_payments, expire_abandoned_pending_payments


def handle_payment_reconcile(firebase_db, logger, payload: dict) -> dict:
    mode = str((payload or {}).get("mode") or "recover")
    if mode == "expire":
        return expire_abandoned_pending_payments(firebase_db, logger)
    return recover_stale_processing_payments(firebase_db, logger)
