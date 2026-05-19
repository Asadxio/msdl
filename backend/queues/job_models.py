from dataclasses import dataclass, field
from typing import Any
import time

JOB_STATES = {
    "queued", "scheduled", "processing", "completed", "failed", "retrying", "dead_lettered", "cancelled"
}


@dataclass
class QueueJob:
    job_id: str
    job_type: str
    status: str = "queued"
    priority: int = 5
    created_at: int = field(default_factory=lambda: int(time.time() * 1000))
    scheduled_for: int = 0
    started_at: int = 0
    completed_at: int = 0
    retry_count: int = 0
    max_retries: int = 5
    failure_reason: str = ""
    dedupe_key: str = ""
    locked_by: str = ""
    lock_expiry: int = 0
    payload: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    correlation_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        return self.__dict__.copy()
