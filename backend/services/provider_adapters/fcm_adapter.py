from services.provider_interface import ProviderSendResult, ProviderReceiptResult

def send_notification(messages: list[dict]) -> ProviderSendResult:
    return ProviderSendResult(provider='fcm', accepted=0, failed=len(messages), tickets=[], failures=[{'error': 'not_implemented'}])

def fetch_receipts(receipt_ids: list[str]) -> list[ProviderReceiptResult]:
    return [ProviderReceiptResult(provider='fcm', receipt_id=rid, status='unknown', failure_category='provider_unavailable', error='not_implemented') for rid in receipt_ids]

def normalize_response(receipt_id: str, receipt: dict) -> ProviderReceiptResult:
    return ProviderReceiptResult(provider='fcm', receipt_id=receipt_id, status='unknown', raw=receipt)

def classify_failure(error: str) -> str:
    return 'unknown'

def health_check() -> dict:
    return {'provider': 'fcm', 'status': 'degraded', 'detail': 'adapter_stub'}
