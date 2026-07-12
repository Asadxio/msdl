import random


def _normalized(weights: dict[str, float]) -> dict[str, float]:
    positive = {k: max(0.0, float(v)) for k, v in weights.items()}
    s = sum(positive.values())
    if s <= 0:
        n = max(1, len(positive))
        return {k: 1.0 / n for k in positive}
    return {k: v / s for k, v in positive.items()}


def choose_provider_weighted(weights: dict[str, float], seed_key: str = '') -> str:
    if not weights:
        return ''
    if seed_key:
        rnd = random.Random(abs(hash(seed_key)) % (2**32))
    else:
        rnd = random.Random()
    norm = _normalized(weights)
    if not norm:
        return ''
    # starvation guard floor
    floor = 0.05
    norm = _normalized({k: max(floor, v) for k, v in norm.items()})
    roll = rnd.random()
    acc = 0.0
    chosen = ''
    for provider, w in sorted(norm.items()):
        acc += w
        if roll <= acc:
            chosen = provider
            break
    return chosen or (next(iter(norm.keys())) if norm else '')
