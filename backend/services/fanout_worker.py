import time
from services.queue_router import partition_job, next_backoff
from services.provider_adapters import expo_adapter, fcm_adapter, apns_adapter
from services.provider_circuit_breaker import allow_request, record_result
from services.idempotency_engine import acquire_send_permit, mark_send_completed
from firebase_admin import firestore as admin_firestore
from services.routing_control_state import get_provider_control
from services.provider_router import weighted_provider_order
from services.throughput_fairness import lane_from_priority, allow_dispatch_in_lane
from services.traffic_shaper import should_shape
from services.probabilistic_router import choose_provider_weighted
from services.routing_experiments import get_experiment, apply_experiment_weights

PROVIDER_MAP = {"expo": expo_adapter, "fcm": fcm_adapter, "apns": apns_adapter}


def _lease_doc(worker_id: str) -> str:
    return f"worker:{worker_id}"


def acquire_lease(firebase_db, worker_id: str, lease_ms: int = 30000) -> bool:
    now_ms = int(time.time() * 1000)
    lease_ref = firebase_db.collection("notification_worker_leases").document(_lease_doc(worker_id))
    lease_ref.set({"worker_id": worker_id, "lease_expires_at": now_ms + lease_ms, "updated_at": now_ms}, merge=True)
    return True


def acquire_queue_lease_atomic(firebase_db, queue_ref, worker_id: str, lease_ms: int = 30000) -> bool:
    tx = firebase_db.transaction()
    now_ms = int(time.time() * 1000)

    @admin_firestore.transactional
    def _run(transaction):
        snap = queue_ref.get(transaction=transaction)
        if not snap.exists:
            return False
        data = snap.to_dict() or {}
        status = str(data.get("status") or "")
        lease_expires = int(data.get("lease_expires_at") or 0)
        lease_owner = str(data.get("lease_owner") or "")
        can_claim = status in {"queued", "retrying"} or (status == "processing" and lease_expires < now_ms)
        if not can_claim:
            return False
        transaction.set(queue_ref, {
            "status": "processing",
            "lease_owner": worker_id,
            "lease_expires_at": now_ms + lease_ms,
            "processing_started_at": now_ms,
            "previous_lease_owner": lease_owner,
        }, merge=True)
        return True
    return bool(_run(tx))


def process_queue_once(firebase_db, logger, worker_id: str = "worker-default", limit: int = 20) -> dict:
    if firebase_db is None:
        return {"ok": False, "error": "firebase_unavailable"}
    acquire_lease(firebase_db, worker_id)
    now_ms = int(time.time() * 1000)
    docs = list(firebase_db.collection("notification_dispatch_queue").where("status", "in", ["queued", "retrying", "processing"]).where("scheduled_at", "<=", now_ms).limit(limit).stream())
    processed = 0
    deadlettered = 0
    for d in docs:
        data = d.to_dict() or {}
        attempts = int(data.get("attempts") or 0)
        max_attempts = int(data.get("max_attempts") or 5)
        if not acquire_queue_lease_atomic(firebase_db, d.reference, worker_id):
            continue
        logger.info("[atomic_lease_acquired] queue_id=%s worker=%s", d.id, worker_id)
        logger.info("[queue_job_leased] queue_id=%s worker=%s", d.id, worker_id)
        recipients = data.get("recipients") or []
        tokens_by_user = {}
        for uid in recipients:
            us = firebase_db.collection("users").document(uid).get()
            ud = us.to_dict() or {}
            tokens_by_user[uid] = [*(ud.get("expo_push_tokens") or []), *(ud.get("fcm_tokens") or [])]
        batches = partition_job({**data, "queue_id": d.id}, tokens_by_user, firebase_db=firebase_db, logger=logger)
        lane = lane_from_priority(int(data.get("priority") or 5))
        logger.info("[priority_lane_pressure] queue_id=%s lane=%s recipients=%s", d.id, lane, len(recipients))
        ok = True
        duplicate_rejections = 0
        by_provider = {}
        for b in batches:
            by_provider.setdefault(b["provider"], []).append(b)
        control = {p: get_provider_control(firebase_db, p) for p in by_provider.keys()}
        weights = {p: float((c or {}).get("routing_weight") or 0.0) for p, c in control.items()}
        exp = get_experiment(firebase_db, str(data.get("experiment_id") or ""))
        weights = apply_experiment_weights(weights, exp)
        if exp.get("enabled") is True:
            logger.info("[traffic_experiment_started] queue_id=%s experiment_id=%s", d.id, str(exp.get("id") or data.get("experiment_id") or ""))
        if float(data.get("canary_percentage") or 0) > 0:
            logger.info("[canary_lane_activated] queue_id=%s canary_percentage=%s", d.id, data.get("canary_percentage"))
        picked = choose_provider_weighted(weights, seed_key=f"{d.id}:{data.get('dedupe_id')}")
        ordered_providers = [picked] + [p for p in weighted_provider_order(control) if p != picked]
        if ordered_providers:
            logger.info("[provider_traffic_shifted] queue_id=%s provider_order=%s", d.id, ",".join(ordered_providers))
            logger.info("[probabilistic_route_selected] queue_id=%s provider=%s region=%s zone=%s weight=%.3f", d.id, picked, str(data.get("region") or "global"), str(data.get("routing_zone") or "default"), float(weights.get(picked) or 0.0))
        for provider in ordered_providers:
            provider_batches = by_provider.get(provider, [])
            if not provider_batches:
                continue
            if not allow_dispatch_in_lane(lane, len(provider_batches)):
                logger.warning("[throughput_quota_applied] queue_id=%s provider=%s lane=%s", d.id, provider, lane)
                ok = False
                continue
            for batch in provider_batches:
                if provider not in PROVIDER_MAP:
                    continue
                if not allow_request(firebase_db, provider):
                    logger.warning("[queue_backpressure_warning] provider=%s queue_id=%s", provider, d.id)
                    ok = False
                    if str(data.get("routing_zone") or "default") != "default":
                        logger.warning("[zone_failover_prepared] queue_id=%s provider=%s zone=%s", d.id, provider, str(data.get("routing_zone") or "default"))
                    continue
                adapter = PROVIDER_MAP[provider]
                send_started = int(time.time() * 1000)
                messages = []
                for t in batch["tokens"]:
                    if not acquire_send_permit(firebase_db, d.id, provider, str(data.get("dedupe_id") or ""), t):
                        duplicate_rejections += 1
                        logger.info("[duplicate_send_rejected] queue_id=%s provider=%s", d.id, provider)
                        continue
                    messages.append({"to": t, "title": data.get("title"), "body": data.get("body"), "data": data.get("payload") or {}})
                if not messages:
                    continue
                shaped, allowed = should_shape(provider, lane, len(messages))
                if shaped:
                    logger.warning("[traffic_shaping_applied] queue_id=%s provider=%s lane=%s requested=%s allowed=%s", d.id, provider, lane, len(messages), allowed)
                    messages = messages[:allowed]
                    if lane == "bulk" and allowed == 0:
                        logger.warning("[graceful_degradation_activated] queue_id=%s provider=%s lane=%s", d.id, provider, lane)
                        logger.warning("[regional_isolation_activated] queue_id=%s provider=%s region=%s", d.id, provider, str(data.get("region") or "global"))
                        ok = False
                        continue
                logger.info("[fanout_batch_started] queue_id=%s provider=%s batch_size=%s", d.id, provider, len(messages))
                try:
                    res = adapter.send_notification(messages)
                    latency = int(time.time() * 1000) - send_started
                    record_result(firebase_db, logger, provider, res.failed == 0, latency)
                    logger.info("[fanout_batch_completed] queue_id=%s provider=%s accepted=%s failed=%s latency=%s", d.id, provider, res.accepted, res.failed, latency)
                    for m in messages:
                        mark_send_completed(firebase_db, d.id, provider, str(data.get("dedupe_id") or ""), str(m.get("to") or ""))
                    if res.failed > 0:
                        ok = False
                except Exception:
                    record_result(firebase_db, logger, provider, False, int(time.time() * 1000) - send_started)
                    ok = False
        attempts += 1
        if ok:
            d.reference.set({"status": "completed", "completed_at": int(time.time() * 1000), "attempts": attempts}, merge=True)
            processed += 1
        else:
            if attempts >= max_attempts:
                firebase_db.collection("notification_dispatch_deadletter").document(d.id).set({**data, "status": "deadletter", "failed_at": int(time.time() * 1000), "attempts": attempts}, merge=True)
                d.reference.set({"status": "deadletter", "failed_at": int(time.time() * 1000), "attempts": attempts}, merge=True)
                logger.warning("[queue_job_deadlettered] queue_id=%s attempts=%s", d.id, attempts)
                deadlettered += 1
            else:
                backoff = next_backoff(attempts)
                d.reference.set({"status": "retrying", "attempts": attempts, "scheduled_at": int(time.time() * 1000) + backoff, "backoff_until": int(time.time() * 1000) + backoff}, merge=True)
                logger.info("[queue_retry_scheduled] queue_id=%s attempts=%s backoff_ms=%s", d.id, attempts, backoff)
        if attempts > 4 and len(docs) > 200:
            logger.warning("[retry_storm_prevented] queue_id=%s attempts=%s scanned=%s", d.id, attempts, len(docs))
    return {"ok": True, "processed": processed, "deadlettered": deadlettered, "scanned": len(docs), "duplicate_rejections": duplicate_rejections if 'duplicate_rejections' in locals() else 0}
