import { verifyFrontendEnv } from '@/config/environments';
import { logger } from '@/lib/logger';

export type AnalyticsEventName =
  | 'screen_view'
  | 'api_error'
  | 'lms_quiz_submit'
  | 'live_join'
  | 'moderation_action'
  | 'upload_result'
  | 'notification_open'
  | 'custom';

export type AnalyticsEvent = {
  name: AnalyticsEventName;
  ts: number;
  dedupeKey?: string;
  payload?: Record<string, unknown>;
};

const BUFFER_LIMIT = 100;
const FLUSH_MIN_INTERVAL_MS = 3000;
let lastFlushMs = 0;
let queue: AnalyticsEvent[] = [];
let inFlight = false;

function dedupe(events: AnalyticsEvent[]): AnalyticsEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const k = e.dedupeKey ?? `${e.name}:${Math.floor(e.ts / 1000)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function ingestUrl(): string {
  const cfg = verifyFrontendEnv();
  const base = cfg.apiBaseUrl.replace(/\/$/, '');
  return `${base}/analytics/ingest`;
}

export function trackEvent(name: AnalyticsEventName, payload: Record<string, unknown> = {}, dedupeKey?: string) {
  queue.push({ name, ts: Date.now(), payload, dedupeKey });
  if (queue.length > BUFFER_LIMIT) queue = queue.slice(queue.length - BUFFER_LIMIT);
}

export function getAnalyticsQueueSize() {
  return queue.length;
}

export async function flushAnalytics(force = false) {
  if (inFlight) return;
  const now = Date.now();
  if (!force && (now - lastFlushMs < FLUSH_MIN_INTERVAL_MS || queue.length === 0)) return;
  inFlight = true;
  const batch = dedupe(queue.slice(0, 20));
  try {
    if (!batch.length) return;
    const res = await fetch(ingestUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
    });
    if (!res.ok) throw new Error(`Analytics flush failed (${res.status})`);
    queue = queue.slice(batch.length);
    lastFlushMs = now;
  } catch (err) {
    logger.warn('analytics.flush.failed', { error: String((err as any)?.message || err), queued: queue.length });
  } finally {
    inFlight = false;
  }
}
