import { trackEvent } from '@/lib/analytics';
import { recordFailureEvent, trackRuntimeHealth } from '@/lib/observabilityEngine';

export function trackRetryExhausted(kind: string, id: string, attempts: number) {
  trackEvent('custom', { metric: 'retry_exhausted', kind, id, attempts }, `retry_exhausted:${kind}:${id}`);
  recordFailureEvent('unknown', attempts >= 5 ? 'error' : 'warn', { kind, id, attempts, source: 'reliabilityMonitor' });
  trackRuntimeHealth({ queuePressure: attempts >= 5 ? 4 : 2 });
}

export function trackQueueHealth(kind: string, depth: number) {
  trackEvent('custom', { metric: 'queue_depth', kind, depth }, `queue_depth:${kind}:${Math.floor(depth / 10)}`);
  trackRuntimeHealth({ queuePressure: Math.min(10, Math.floor(depth / 25)) });
}

export function trackCleanupResult(kind: string, scanned: number, cleaned: number) {
  trackEvent('custom', { metric: 'cleanup_result', kind, scanned, cleaned }, `cleanup:${kind}:${cleaned}`);
}
