import time
from collections import defaultdict, deque
from typing import Any

_events: deque[dict[str, Any]] = deque(maxlen=500)
_traces: dict[str, dict[str, Any]] = {}
_health: dict[str, Any] = {
    "degraded": False,
    "risk_level": "low",
    "reconnect_frequency": 0,
    "queue_pressure": 0,
    "upload_failure_rate": 0,
    "memory_pressure_score": 0,
}
_failure_counts: dict[str, int] = defaultdict(int)


def _now_ms() -> int:
    return int(time.time() * 1000)


def _redact(payload: dict[str, Any]) -> dict[str, Any]:
    redacted: dict[str, Any] = {}
    for k, v in (payload or {}).items():
        if any(x in str(k).lower() for x in ("token", "password", "secret", "authorization", "email", "phone")):
            redacted[k] = "[REDACTED]"
        else:
            redacted[k] = v
    return redacted


def log_structured_event(category: str, subsystem: str, severity: str = "info", correlation_id: str = "", trace_id: str = "", metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    event = {
        "id": f"{subsystem}:{_now_ms()}",
        "at_ms": _now_ms(),
        "category": str(category or "unknown"),
        "subsystem": str(subsystem or "unknown"),
        "severity": str(severity or "info"),
        "correlation_id": str(correlation_id or ""),
        "trace_id": str(trace_id or ""),
        "metadata": _redact(metadata or {}),
    }
    _events.append(event)
    return event


def register_operational_trace(name: str, trace_id: str, context: dict[str, Any] | None = None) -> None:
    _traces[trace_id] = {"name": name, "started_at_ms": _now_ms(), "context": _redact(context or {}), "retries": 0}
    log_structured_event("trace_start", "runtime", "info", trace_id=trace_id, metadata={"name": name})


def track_runtime_health(patch: dict[str, Any]) -> dict[str, Any]:
    _health.update(patch or {})
    score = int(_health.get("reconnect_frequency", 0)) + int(_health.get("queue_pressure", 0)) + int(_health.get("upload_failure_rate", 0)) + int(_health.get("memory_pressure_score", 0))
    _health["risk_level"] = "high" if score >= 16 else ("medium" if score >= 8 else "low")
    _health["degraded"] = _health["risk_level"] != "low"
    return dict(_health)


def create_diagnostic_snapshot(context: str = "runtime") -> dict[str, Any]:
    return {
        "context": context,
        "at_ms": _now_ms(),
        "health": dict(_health),
        "active_traces": len(_traces),
        "event_buffered": len(_events),
        "failure_counts": dict(_failure_counts),
    }


def record_failure_event(category: str, severity: str = "warn", retryable: bool = True, recoverable: bool = True, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    safe_category = str(category or "unknown")
    _failure_counts[safe_category] += 1
    event = log_structured_event("failure", "runtime", severity, metadata={"category": safe_category, "retryable": bool(retryable), "recoverable": bool(recoverable), **(metadata or {})})
    return event


def get_system_health_state() -> dict[str, Any]:
    return dict(_health)


def flush_diagnostic_buffer(firebase_db=None, reason: str = "manual") -> dict[str, Any]:
    snapshot = create_diagnostic_snapshot(reason)
    if firebase_db is not None:
        firebase_db.collection("operational_diagnostics").add({"snapshot": snapshot, "events": list(_events)[-200:], "created_at_ms": _now_ms()})
    return snapshot

