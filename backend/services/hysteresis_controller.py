def apply_hysteresis(current_state: str, target_state: str, last_changed_at: int, now_ms: int, cooldown_ms: int = 60000) -> tuple[str, bool]:
    if current_state == target_state:
        return current_state, False
    if now_ms - int(last_changed_at or 0) < cooldown_ms:
        return current_state, True
    return target_state, False


def should_restore_traffic(last_degraded_at: int, now_ms: int, recovery_window_ms: int = 120000) -> bool:
    return now_ms - int(last_degraded_at or 0) >= recovery_window_ms
