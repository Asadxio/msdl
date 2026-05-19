import os

ALLOWED_ENVS = {"development", "staging", "production"}


def app_env() -> str:
    raw = str(os.environ.get("APP_ENV", "development")).strip().lower()
    return raw if raw in ALLOWED_ENVS else "development"


def require_env(keys: list[str]) -> dict[str, str]:
    missing = [k for k in keys if not str(os.environ.get(k, "")).strip()]
    if missing:
        raise RuntimeError(f"Missing required env vars: {', '.join(missing)}")
    return {k: str(os.environ.get(k, "")).strip() for k in keys}
