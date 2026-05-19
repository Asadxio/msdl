import time


def _hour_key(ts_ms: int) -> str:
    t = time.gmtime(ts_ms / 1000)
    return f"{t.tm_year:04d}-{t.tm_mon:02d}-{t.tm_mday:02d}-{t.tm_hour:02d}"


def _day_key(ts_ms: int) -> str:
    t = time.gmtime(ts_ms / 1000)
    return f"{t.tm_year:04d}-{t.tm_mon:02d}-{t.tm_mday:02d}"


def aggregate_notification_health(firebase_db, logger, lookback_ms: int = 3600_000) -> dict:
    if firebase_db is None:
        return {"ok": False, "error": "firebase_unavailable"}
    now_ms = int(time.time() * 1000)
    cutoff = now_ms - lookback_ms
    docs = list(firebase_db.collection("notification_delivery_logs").where("updated_at", ">=", cutoff).limit(2000).stream())
    if not docs:
        return {"ok": True, "processed": 0}
    hourly = {}
    daily = {}
    for d in docs:
        x = d.to_dict() or {}
        ts = int(x.get("updated_at") or now_ms)
        channel = str(x.get("channel") or "unknown")
        provider = str(x.get("transport") or "unknown")
        hkey = f"{_hour_key(ts)}:{channel}:{provider}"
        dkey = f"{_day_key(ts)}:{channel}:{provider}"
        for bag, key in ((hourly, hkey), (daily, dkey)):
            if key not in bag:
                bag[key] = {"total_sent": 0, "provider_accepted": 0, "provider_delivered": 0, "opened": 0, "failed": 0, "retries": 0, "open_latency_sum": 0, "open_latency_count": 0, "receipt_latency_sum": 0, "receipt_latency_count": 0, "channel": channel, "provider": provider}
            row = bag[key]
            status = str(x.get("status") or "")
            row["total_sent"] += 1
            if status == "provider_accepted": row["provider_accepted"] += 1
            if status == "provider_delivered": row["provider_delivered"] += 1
            if status == "opened": row["opened"] += 1
            if status in {"failed", "provider_failed"}: row["failed"] += 1
            row["retries"] += int(x.get("retry_count") or 0)
            if isinstance(x.get("latency_ms"), (int, float)):
                row["open_latency_sum"] += int(x.get("latency_ms") or 0); row["open_latency_count"] += 1
            if isinstance(x.get("receipt_latency_ms"), (int, float)):
                row["receipt_latency_sum"] += int(x.get("receipt_latency_ms") or 0); row["receipt_latency_count"] += 1
    for coll, bag in (("notification_health_hourly", hourly), ("notification_health_daily", daily)):
        for key, row in bag.items():
            total = max(1, row["total_sent"])
            payload = {
                **row,
                "open_rate": row["opened"] / total,
                "delivery_success_rate": row["provider_delivered"] / total,
                "provider_failure_rate": row["failed"] / total,
                "average_open_latency": (row["open_latency_sum"] / row["open_latency_count"]) if row["open_latency_count"] else 0,
                "average_receipt_latency": (row["receipt_latency_sum"] / row["receipt_latency_count"]) if row["receipt_latency_count"] else 0,
                "updated_at": now_ms,
            }
            firebase_db.collection(coll).document(key).set(payload, merge=True)
            logger.info("[notification_aggregate_updated] %s %s", coll, key)
            if payload["delivery_success_rate"] < 0.85 or payload["provider_failure_rate"] > 0.1:
                logger.warning("[notification_slo_warning] key=%s delivery=%.3f failure=%.3f", key, payload["delivery_success_rate"], payload["provider_failure_rate"])
    queue_depth = len(list(firebase_db.collection("notification_dispatch_queue").where("status", "in", ["queued", "retrying", "processing"]).limit(5000).stream()))
    deadletter_depth = len(list(firebase_db.collection("notification_dispatch_deadletter").limit(5000).stream()))
    routing_docs = list(firebase_db.collection("notification_routing_control").limit(100).stream())
    total_weight = 0.0
    provider_share = {}
    for d in routing_docs:
        data = d.to_dict() or {}
        w = float(data.get("routing_weight") or 0.0)
        total_weight += w
        provider_share[d.id] = w
    if total_weight > 0:
        provider_share = {k: (v / total_weight) for k, v in provider_share.items()}
    hysteresis_active = 0
    degraded_zones = 0
    regional_pressure = {}
    for d in routing_docs:
        data = d.to_dict() or {}
        if int(data.get("hysteresis_until") or 0) > now_ms:
            hysteresis_active += 1
        if str(data.get("provider_state") or "") == "degraded":
            degraded_zones += 1
        regional_pressure[d.id] = float(data.get("regional_pressure_score") or 1.0)
    firebase_db.collection("notification_queue_health").document("current").set({
        "queue_depth": queue_depth,
        "deadletter_depth": deadletter_depth,
        "provider_traffic_share": provider_share,
        "fairness_ratio": (1.0 / max(1, len(provider_share))) if provider_share else 1.0,
        "hysteresis_activation_count": hysteresis_active,
        "zone_degradation_count": degraded_zones,
        "regional_pressure_trends": regional_pressure,
        "updated_at": now_ms,
    }, merge=True)
    return {"ok": True, "processed": len(docs), "hourly": len(hourly), "daily": len(daily), "queue_depth": queue_depth, "deadletter_depth": deadletter_depth, "provider_traffic_share": provider_share, "hysteresis_activation_count": hysteresis_active, "zone_degradation_count": degraded_zones}
