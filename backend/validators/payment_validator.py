
def validate_payment_amount(amount: float) -> float:
    val = float(amount)
    if val <= 0 or val > 1_000_000:
        raise ValueError("Invalid payment amount")
    return round(val, 2)


def validate_payment_type(payment_type: str) -> str:
    allowed = {"fees", "sadqa", "zakat", "fitra", "langar", "subscription"}
    p = str(payment_type or "fees").strip().lower()
    if p not in allowed:
        raise ValueError("Invalid payment type")
    return p
