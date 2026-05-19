from typing import Any


def normalize_expo_receipt_status(receipt: dict[str, Any]) -> tuple[str, str, str]:
    """returns (canonical_status, failure_category, provider_error)"""
    status = str(receipt.get("status") or "")
    details = receipt.get("details") or {}
    error = str(details.get("error") or receipt.get("message") or "")
    if status == "ok":
        return "provider_delivered", "", ""
    err_low = error.lower()
    if "devicenotregistered" in err_low:
        return "provider_failed", "invalid_token", error
    if "messagerateexceeded" in err_low or "toomany" in err_low or "throttle" in err_low:
        return "provider_failed", "throttled", error
    if "credentials" in err_low or "auth" in err_low:
        return "provider_failed", "credentials", error
    if "payload" in err_low:
        return "provider_failed", "payload_invalid", error
    if "service unavailable" in err_low or "outage" in err_low:
        return "provider_unknown", "provider_outage", error
    return "provider_unknown", "unknown", error
