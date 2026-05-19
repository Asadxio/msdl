def provider_for_token(token: str) -> str:
    t = str(token or '')
    if t.startswith('ExponentPushToken[') or t.startswith('ExpoPushToken['):
        return 'expo'
    if ':' in t and len(t) > 80:
        return 'fcm'
    if len(t) > 40:
        return 'apns'
    return 'unknown'


def route_tokens(tokens: list[str]) -> dict[str, list[str]]:
    out = {'expo': [], 'fcm': [], 'apns': [], 'unknown': []}
    for token in tokens:
        out.setdefault(provider_for_token(token), []).append(token)
    return out


def weighted_provider_order(control: dict[str, dict]) -> list[str]:
    ranked = sorted(control.items(), key=lambda kv: float((kv[1] or {}).get("routing_weight") or 0.0), reverse=True)
    return [k for k, _ in ranked]
