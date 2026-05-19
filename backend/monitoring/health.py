import time
from observability import create_diagnostic_snapshot, get_system_health_state


def build_health_snapshot(firebase_db) -> dict:
    obs_health = get_system_health_state()
    return {
        "ok": True,
        "time_ms": int(time.time() * 1000),
        "firebase": firebase_db is not None,
        "observability": obs_health,
        "diagnostic": create_diagnostic_snapshot("health_endpoint"),
    }
