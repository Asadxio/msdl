export type RateLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
};

const windows = new Map<string, number[]>();

export function enforceClientRateLimit(
  key: string,
  limitCount: number,
  windowMs: number,
  nowMs = Date.now(),
): RateLimitResult {
  const bucket = windows.get(key) ?? [];
  const filtered = bucket.filter((ts) => nowMs - ts <= windowMs);
  if (filtered.length >= limitCount) {
    const retryAfterMs = Math.max(0, windowMs - (nowMs - filtered[0]));
    windows.set(key, filtered);
    return { allowed: false, retryAfterMs, remaining: 0 };
  }

  filtered.push(nowMs);
  windows.set(key, filtered);
  return {
    allowed: true,
    retryAfterMs: 0,
    remaining: Math.max(0, limitCount - filtered.length),
  };
}

export function resetClientRateLimit(key?: string) {
  if (!key) {
    windows.clear();
    return;
  }
  windows.delete(key);
}
