import time


def record_job_metric(firebase_db, job_name: str, status: str, duration_ms: int, extra: dict | None = None) -> None:
    if firebase_db is None:
        return
    payload = {
        "job_name": str(job_name),
        "status": str(status),
        "duration_ms": int(duration_ms),
        "created_at_ms": int(time.time() * 1000),
        "extra": extra or {},
    }
    firebase_db.collection("job_execution_metrics").add(payload)
