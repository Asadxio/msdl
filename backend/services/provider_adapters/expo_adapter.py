import json
from urllib import request as urlrequest
from services.provider_interface import ProviderSendResult, ProviderReceiptResult


def _post_expo_json(url: str, payload: dict | list) -> dict:
    req = urlrequest.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json', 'Accept': 'application/json'}, method='POST')
    with urlrequest.urlopen(req, timeout=15) as response:
        return json.loads(response.read().decode('utf-8') or '{}')


def send_notification(messages: list[dict]) -> ProviderSendResult:
    response = _post_expo_json('https://exp.host/--/api/v2/push/send', messages)
    tickets = response.get('data') or []
    accepted = sum(1 for t in tickets if t.get('status') == 'ok' and t.get('id'))
    failed = len(tickets) - accepted
    return ProviderSendResult(provider='expo', accepted=accepted, failed=failed, tickets=tickets, failures=[])


def fetch_receipts(receipt_ids: list[str]) -> list[ProviderReceiptResult]:
    response = _post_expo_json('https://exp.host/--/api/v2/push/getReceipts', {'ids': receipt_ids})
    data = response.get('data') or {}
    out: list[ProviderReceiptResult] = []
    for rid, rec in data.items():
        out.append(normalize_response(rid, rec or {}))
    return out


def normalize_response(receipt_id: str, receipt: dict) -> ProviderReceiptResult:
    status = str(receipt.get('status') or '')
    details = receipt.get('details') or {}
    err = str(details.get('error') or '')
    if status == 'ok':
        return ProviderReceiptResult(provider='expo', receipt_id=receipt_id, status='delivered', raw=receipt)
    e = err.lower()
    if 'devicenotregistered' in e:
        return ProviderReceiptResult(provider='expo', receipt_id=receipt_id, status='invalid_token', failure_category='invalid_token', error=err, raw=receipt)
    if 'rate' in e or 'toomany' in e:
        return ProviderReceiptResult(provider='expo', receipt_id=receipt_id, status='throttled', failure_category='throttled', error=err, raw=receipt)
    return ProviderReceiptResult(provider='expo', receipt_id=receipt_id, status='failed', failure_category='unknown', error=err, raw=receipt)


def classify_failure(error: str) -> str:
    e = str(error or '').lower()
    if 'devicenotregistered' in e: return 'invalid_token'
    if 'rate' in e: return 'throttled'
    return 'unknown'


def health_check() -> dict:
    return {'provider': 'expo', 'status': 'ok'}
