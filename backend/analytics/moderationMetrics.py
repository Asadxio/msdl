def summarize_moderation(actions: list[dict]) -> dict:
    out = {"reports": 0, "suspensions": 0, "escalations": 0}
    for a in actions:
        t = str(a.get("type") or "")
        if t == "report":
            out["reports"] += 1
        elif t == "suspension":
            out["suspensions"] += 1
        elif t == "escalation":
            out["escalations"] += 1
    return out
