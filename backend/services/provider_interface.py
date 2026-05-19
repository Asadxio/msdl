from dataclasses import dataclass
from typing import Any

ProviderFailureCategory = str
ProviderHealthStatus = str

@dataclass
class ProviderSendResult:
    provider: str
    accepted: int
    failed: int
    tickets: list[dict[str, Any]]
    failures: list[dict[str, Any]]

@dataclass
class ProviderReceiptResult:
    provider: str
    receipt_id: str
    status: str  # accepted|delivered|failed|throttled|invalid_token|provider_unavailable|unknown
    failure_category: ProviderFailureCategory = ""
    error: str = ""
    raw: dict[str, Any] | None = None
