from services.routing_control_state import get_provider_control, update_provider_control
from services.hysteresis_controller import apply_hysteresis, should_restore_traffic


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def compute_weight(current: float, health: float, latency: float, throttling: float, outage: float, queue_pressure: float) -> float:
    target = _clamp(health * 0.35 + latency * 0.2 + throttling * 0.15 + outage * 0.2 + queue_pressure * 0.1, 0.05, 1.0)
    # smooth bounded transition (no sharp swings)
    delta = _clamp(target - current, -0.12, 0.12)
    return _clamp(current + delta, 0.05, 1.0)


def update_provider_weight(firebase_db, logger, provider: str, metrics: dict) -> dict:
    cur = get_provider_control(firebase_db, provider)
    now_ms = int(metrics.get("now_ms") or 0) or __import__("time").time_ns() // 1_000_000
    state = str(cur.get("provider_state") or "healthy")
    target_state = "degraded" if float(metrics.get("outage_score") or 1.0) < 0.6 else "healthy"
    next_state, blocked = apply_hysteresis(state, target_state, int(cur.get("last_updated_at") or 0), now_ms, cooldown_ms=90000)
    if blocked:
        logger.info("[hysteresis_window_active] provider=%s current=%s target=%s", provider, state, target_state)
    if state != target_state and blocked:
        logger.info("[routing_flap_prevented] provider=%s current=%s target=%s", provider, state, target_state)
    if next_state == "healthy" and not should_restore_traffic(int(cur.get("last_degraded_at") or 0), now_ms, recovery_window_ms=120000):
        next_state = "degraded"
    new_weight = compute_weight(
        float(cur.get("routing_weight") or 1.0),
        float(metrics.get("health_score") or cur.get("health_score") or 1.0),
        float(metrics.get("latency_score") or cur.get("latency_score") or 1.0),
        float(metrics.get("throttling_score") or cur.get("throttling_score") or 1.0),
        float(metrics.get("outage_score") or cur.get("outage_score") or 1.0),
        float(metrics.get("queue_pressure_score") or cur.get("queue_pressure_score") or 1.0),
    )
    nxt = update_provider_control(firebase_db, logger, provider, {**metrics, "routing_weight": new_weight, "provider_state": next_state, "last_degraded_at": now_ms if next_state == "degraded" else int(cur.get("last_degraded_at") or 0)})
    logger.info("[routing_weight_updated] provider=%s old=%.3f new=%.3f", provider, float(cur.get("routing_weight") or 1.0), new_weight)
    return nxt
