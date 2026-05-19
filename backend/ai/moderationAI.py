import re

TOXIC_PATTERNS = [r"\bidiot\b", r"\bhate\b", r"\bkill\b", r"\bstupid\b"]
SPAM_PATTERNS = [r"http[s]?://", r"\bbuy now\b", r"\bfree money\b"]


def classify_text(text: str) -> dict:
    t = str(text or "").lower()
    toxic_hits = sum(1 for p in TOXIC_PATTERNS if re.search(p, t))
    spam_hits = sum(1 for p in SPAM_PATTERNS if re.search(p, t))
    toxicity = min(1.0, toxic_hits * 0.35)
    spam = min(1.0, spam_hits * 0.4)
    harassment = min(1.0, 0.5 * toxicity + (0.5 if "you are" in t and toxic_hits > 0 else 0))
    priority = "high" if max(toxicity, spam, harassment) >= 0.75 else ("medium" if max(toxicity, spam, harassment) >= 0.4 else "low")
    return {
        "toxicity": toxicity,
        "spam": spam,
        "harassment": harassment,
        "priority": priority,
        "recommended_action": "human_review",
        "explain": {
            "toxic_hits": toxic_hits,
            "spam_hits": spam_hits,
        },
    }
