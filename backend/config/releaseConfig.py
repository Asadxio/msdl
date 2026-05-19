import os


def release_channel() -> str:
    return str(os.environ.get("RELEASE_CHANNEL", "internal")).strip().lower()


def feature_flag(name: str, default: bool = False) -> bool:
    raw = str(os.environ.get(f"FLAG_{name.upper()}", str(default))).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def rollout_percentage(name: str, default: int = 0) -> int:
    raw = str(os.environ.get(f"ROLLOUT_{name.upper()}", str(default))).strip()
    try:
        val = int(raw)
    except ValueError:
        val = default
    return max(0, min(100, val))
