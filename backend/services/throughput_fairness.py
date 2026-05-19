
def lane_from_priority(priority: int) -> str:
    if priority >= 9: return 'critical'
    if priority >= 7: return 'high'
    if priority >= 5: return 'normal'
    if priority >= 3: return 'low'
    return 'bulk'


def lane_quota(lane: str) -> int:
    return {
        'critical': 300,
        'high': 220,
        'normal': 140,
        'low': 80,
        'bulk': 30,
    }.get(lane, 80)


def allow_dispatch_in_lane(lane: str, current_inflight: int) -> bool:
    return current_inflight < lane_quota(lane)
