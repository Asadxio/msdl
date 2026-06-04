import { trackEvent } from '@/lib/analytics';

const timers = new Map<string, number>();

export function markStart(key: string) {
  timers.set(key, Date.now());
}

export function markEnd(key: string, extra: Record<string, unknown> = {}) {
  const start = timers.get(key);
  if (!start) return;
  const durationMs = Date.now() - start;
  timers.delete(key);
  trackEvent('custom', { metric: key, duration_ms: durationMs, ...extra }, `health:${key}:${Math.floor(durationMs / 100)}`);
}

export function recordRetry(op: string, retryCount: number) {
  trackEvent('custom', { metric: 'network_retry', op, retryCount }, `retry:${op}:${retryCount}`);
}
