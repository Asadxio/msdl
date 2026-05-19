from collections import defaultdict


def aggregate_quiz_summary(rows: list[dict]) -> dict:
    by_quiz: dict[str, dict] = defaultdict(lambda: {"attempts": 0, "score_sum": 0, "suspicious": 0})
    for row in rows:
        qid = str(row.get("quiz_id") or "unknown")
        by_quiz[qid]["attempts"] += 1
        by_quiz[qid]["score_sum"] += int(row.get("score") or 0)
        by_quiz[qid]["suspicious"] += 1 if row.get("suspicious_timing") else 0
    return {
        qid: {
            **data,
            "avg_score": (data["score_sum"] / data["attempts"]) if data["attempts"] else 0,
        }
        for qid, data in by_quiz.items()
    }
