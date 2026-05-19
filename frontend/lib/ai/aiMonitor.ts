import { trackEvent } from '@/lib/analytics';

export function trackAiMetric(feature: string, ok: boolean, latencyMs: number, meta: Record<string, unknown> = {}) {
  trackEvent('custom', {
    metric: 'ai_inference',
    feature,
    ok,
    latency_ms: latencyMs,
    ...meta,
  }, `ai:${feature}:${ok}:${Math.floor(latencyMs / 200)}`);
}
