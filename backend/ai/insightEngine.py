def summarize_operational_insights(metrics: dict) -> dict:
    quiz_suspicious = int(metrics.get("quiz_suspicious", 0))
    moderation_reports = int(metrics.get("moderation_reports", 0))
    reconnect_spikes = int(metrics.get("reconnect_spikes", 0))

    insights = []
    if quiz_suspicious > 25:
        insights.append("Elevated suspicious quiz attempts; recommend teacher audit.")
    if moderation_reports > 100:
        insights.append("Moderation queue volume is high; prioritize harassment reports.")
    if reconnect_spikes > 40:
        insights.append("Live-class reconnect instability detected; review network quality diagnostics.")

    return {
        "summary": insights or ["No major AI-detected risk signals in the current window."],
        "risk_level": "high" if len(insights) >= 2 else ("medium" if len(insights) == 1 else "low"),
    }
