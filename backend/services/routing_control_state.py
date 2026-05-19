import time


def get_provider_control(firebase_db, provider: str) -> dict:
    if firebase_db is None:
        return {"provider": provider, "routing_weight": 1.0, "health_score": 1.0, "latency_score": 1.0, "throttling_score": 1.0, "outage_score": 1.0, "queue_pressure_score": 1.0, "traffic_share": 0.0, "last_updated_at": 0, "state_version": 1, "region": "global", "provider_region": "global", "routing_zone": "default", "preferred_region": "global", "fallback_region": "global", "regional_pressure_score": 1.0, "region_health_score": 1.0, "hysteresis_until": 0, "last_degraded_at": 0}
    snap = firebase_db.collection("notification_routing_control").document(provider).get()
    base = {"provider": provider, "routing_weight": 1.0, "health_score": 1.0, "latency_score": 1.0, "throttling_score": 1.0, "outage_score": 1.0, "queue_pressure_score": 1.0, "traffic_share": 0.0, "last_updated_at": 0, "state_version": 1, "region": "global", "provider_region": "global", "routing_zone": "default", "preferred_region": "global", "fallback_region": "global", "regional_pressure_score": 1.0, "region_health_score": 1.0, "hysteresis_until": 0, "last_degraded_at": 0}
    if not snap.exists:
      return base
    return {**base, **(snap.to_dict() or {})}


def update_provider_control(firebase_db, logger, provider: str, patch: dict) -> dict:
    now_ms = int(time.time() * 1000)
    cur = get_provider_control(firebase_db, provider)
    nxt = {**cur, **patch, "last_updated_at": now_ms, "state_version": int(cur.get("state_version") or 1) + 1}
    if firebase_db is not None:
        firebase_db.collection("notification_routing_control").document(provider).set(nxt, merge=True)
    return nxt
