import { trackEvent } from '@/lib/analytics';

export function trackHealthPing(target: string, ok: boolean, latencyMs: number) {
  trackEvent('custom', { metric: 'health_ping', target, ok, latency_ms: latencyMs }, `health:${target}:${ok}:${Math.floor(latencyMs / 200)}`);
}
