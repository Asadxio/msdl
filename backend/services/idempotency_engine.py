import time
from firebase_admin import firestore as admin_firestore


def _doc_key(queue_id: str, provider: str, dedupe_id: str, token: str) -> str:
    return f"{queue_id}:{provider}:{dedupe_id}:{abs(hash(token))}"


def acquire_send_permit(firebase_db, queue_id: str, provider: str, dedupe_id: str, token: str) -> bool:
    ref = firebase_db.collection("notification_idempotency_keys").document(_doc_key(queue_id, provider, dedupe_id, token))
    tx = firebase_db.transaction()

    @admin_firestore.transactional
    def _run(transaction):
        snap = ref.get(transaction=transaction)
        now_ms = int(time.time() * 1000)
        if snap.exists:
            st = str((snap.to_dict() or {}).get("execution_status") or "")
            if st in {"pending", "completed", "rejected_duplicate"}:
                transaction.set(ref, {"last_seen_at": now_ms, "execution_status": "rejected_duplicate"}, merge=True)
                return False
        transaction.set(ref, {
            "idempotency_key": ref.id,
            "dedupe_id": dedupe_id,
            "queue_id": queue_id,
            "provider": provider,
            "first_seen_at": now_ms,
            "last_seen_at": now_ms,
            "execution_status": "pending",
        }, merge=True)
        return True
    return bool(_run(tx))


def mark_send_completed(firebase_db, queue_id: str, provider: str, dedupe_id: str, token: str) -> None:
    ref = firebase_db.collection("notification_idempotency_keys").document(_doc_key(queue_id, provider, dedupe_id, token))
    ref.set({"execution_status": "completed", "last_seen_at": int(time.time() * 1000)}, merge=True)
