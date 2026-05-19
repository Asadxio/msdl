def detect_thresholds(metrics: dict, thresholds: dict) -> list[dict]:
    alerts = []
    for key, value in metrics.items():
        limit = thresholds.get(key)
        if limit is None:
            continue
        if float(value) >= float(limit):
            alerts.append({"metric": key, "value": value, "threshold": limit, "severity": "warning"})
    return alerts
