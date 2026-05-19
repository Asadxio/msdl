import hashlib
import time


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()[:20]


def compute_health_score(consecutive_failures: int, last_success_age_ms: int, invalid_signals: int, retry_rate: float) -> int:
    score = 100
    score -= min(60, consecutive_failures * 10)
    score -= min(20, int(last_success_age_ms / (7 * 24 * 3600 * 1000)) * 5)
    score -= min(15, invalid_signals * 5)
    score -= min(15, int(retry_rate * 10))
    return max(0, score)


def derive_status(score: int, consecutive_failures: int, invalid_signals: int) -> str:
    if invalid_signals >= 3 or consecutive_failures >= 8:
        return 'invalid'
    if score < 35:
        return 'stale'
    if score < 65:
        return 'degraded'
    return 'active'


def update_token_registry(firebase_db, logger, token: str, provider: str, platform: str, success: bool, reason: str = '', device_id: str = '', app_version: str = '') -> None:
    if firebase_db is None or not token:
        return
    now_ms = int(time.time() * 1000)
    key = token_hash(token)
    ref = firebase_db.collection('notification_token_registry').document(key)
    snap = ref.get()
    cur = snap.to_dict() or {}
    failures = int(cur.get('failure_count') or 0)
    cons = int(cur.get('consecutive_failures') or 0)
    invalid_signals = int(cur.get('invalid_signals') or 0)
    if success:
        cons = 0
    else:
        failures += 1
        cons += 1
        if 'invalid' in reason.lower() or 'unregistered' in reason.lower():
            invalid_signals += 1
    last_success_ms = int(cur.get('last_success_at') or now_ms)
    age_ms = 0 if success else max(0, now_ms - last_success_ms)
    score = compute_health_score(cons, age_ms, invalid_signals, 0.0)
    status = derive_status(score, cons, invalid_signals)
    payload = {
        'token': token,
        'provider': provider,
        'platform': platform,
        'device_id': device_id,
        'app_version': app_version,
        'last_seen_at': now_ms,
        'failure_count': failures,
        'consecutive_failures': cons,
        'invalid_signals': invalid_signals,
        'token_health_score': score,
        'token_status': status,
        'last_failure_at': now_ms if not success else cur.get('last_failure_at', 0),
        'last_success_at': now_ms if success else cur.get('last_success_at', 0),
    }
    if status in {'degraded', 'stale', 'invalid'} and cur.get('token_status') != status:
        payload['invalidated_at'] = now_ms
        logger.warning('[token_soft_invalidated] token=%s provider=%s platform=%s status=%s', key, provider, platform, status)
    if success and cur.get('token_status') in {'degraded', 'stale', 'invalid'}:
        payload['reactivated_at'] = now_ms
        payload['token_status'] = 'reactivated'
        logger.info('[token_reactivated] token=%s provider=%s platform=%s', key, provider, platform)
    ref.set(payload, merge=True)
    logger.info('[token_health_updated] token=%s provider=%s platform=%s score=%s failures=%s', key, provider, platform, score, failures)
