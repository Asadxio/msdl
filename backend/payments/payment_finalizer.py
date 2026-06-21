import time
from firebase_admin import firestore as admin_firestore
from security.paymentSecurity import can_transition
from payments.payment_state import payment_state_update


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
        state = str(p.get("state") or p.get("status") or "pending")
        now_ms = int(time.time() * 1000)

        already_finalized = state == "succeeded" and p.get("entitlement_granted") is True
        if already_finalized:
            return {"ok": True, "idempotent": True, "state": state, "entitlement_granted": True}
        if state not in {"pending", "processing", "succeeded"} and not can_transition(state, "succeeded"):
            raise ValueError(f"invalid_transition:{state}->succeeded")

        uid = str(p.get("user_id") or "").strip()
        payment_type = str(p.get("type") or "fees").strip().lower()
        course_id = str(p.get("course_id") or "").strip()
        grants_subscription = payment_type == "fees"
        grants_course_access = grants_subscription and bool(course_id)

        tx.set(p_ref, payment_state_update(
            "succeeded",
            entitlement_granted=grants_subscription,
            finalized_at=admin_firestore.SERVER_TIMESTAMP,
            finalized_at_ms=now_ms,
            reconciliation={"finalized": True, "source_event_id": source_event_id, "updated_at_ms": now_ms},
            updated_at=admin_firestore.SERVER_TIMESTAMP,
            updated_at_ms=now_ms,
        ), merge=True)

        if grants_subscription:
            s_ref = firebase_db.collection("subscriptions").document(uid)
            tx.set(s_ref, {
                "user_id": uid,
                "status": "active",
                "last_payment_id": payment_id,
                "updated_at": admin_firestore.SERVER_TIMESTAMP,
            }, merge=True)

        if grants_course_access:
            enroll_id = f"{uid}:{course_id}"
            e_ref = firebase_db.collection("enrollments").document(enroll_id)
            tx.set(e_ref, {
                "user_id": uid,
                "course_id": course_id,
                "status": "active",
                "source": "payment",
                "payment_id": payment_id,
                "created_at": admin_firestore.SERVER_TIMESTAMP,
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
        return {"ok": True, "idempotent": state == "succeeded", "state": "succeeded", "entitlement_granted": grants_subscription, "course_access_granted": grants_course_access}

    return _tx(firebase_db.transaction())
