import time
from firebase_admin import firestore as admin_firestore
from security.paymentSecurity import can_transition


def finalize_successful_payment(firebase_db, payment_id: str, actor: str, source_event_id: str = "") -> dict:
    if firebase_db is None:
        return {"ok": False, "reason": "no_db"}

    p_ref = firebase_db.collection("payments").document(payment_id)

    @admin_firestore.transactional
    def _tx(tx):
        snap = p_ref.get(transaction=tx)
        if not snap.exists:
            raise ValueError("payment_not_found")
        p = snap.to_dict() or {}
        state = str(p.get("state") or "pending")
        now_ms = int(time.time() * 1000)

        if state == "succeeded":
            return {"ok": True, "idempotent": True, "state": state}
        if not can_transition(state, "succeeded"):
            raise ValueError(f"invalid_transition:{state}->succeeded")

        uid = str(p.get("user_id") or "")
        pay_type = str(p.get("type") or "fees")
        enroll_id = f"{uid}:{pay_type}"[:180]
        s_ref = firebase_db.collection("subscriptions").document(uid)
        e_ref = firebase_db.collection("enrollments").document(enroll_id)

        tx.set(p_ref, {
            "state": "succeeded",
            "entitlement_granted": True,
            "finalized_at": admin_firestore.SERVER_TIMESTAMP,
            "finalized_at_ms": now_ms,
            "reconciliation": {"finalized": True, "source_event_id": source_event_id, "updated_at_ms": now_ms},
            "updated_at": admin_firestore.SERVER_TIMESTAMP,
            "updated_at_ms": now_ms,
        }, merge=True)

        tx.set(e_ref, {
            "user_id": uid,
            "course_id": p.get("course_id", "general"),
            "status": "active",
            "source": "payment",
            "payment_id": payment_id,
            "created_at": admin_firestore.SERVER_TIMESTAMP,
            "updated_at": admin_firestore.SERVER_TIMESTAMP,
        }, merge=True)
        tx.set(s_ref, {
            "user_id": uid,
            "status": "active",
            "last_payment_id": payment_id,
            "updated_at": admin_firestore.SERVER_TIMESTAMP,
        }, merge=True)
        tx.set(firebase_db.collection("payment_audit_logs").document(), {
            "payment_id": payment_id,
            "actor_id": actor,
            "action": "finalize_success",
            "from": state,
            "to": "succeeded",
            "created_at_ms": now_ms,
            "source_event_id": source_event_id,
        })
        return {"ok": True, "idempotent": False, "state": "succeeded"}

    return _tx(admin_firestore.transaction())
