export type ChatMetricEvent = {
  name:
    | 'queue_size'
    | 'flush_started'
    | 'flush_finished'
    | 'flush_error'
    | 'retry_exhausted'
    | 'upload_failed'
    | 'reconcile_conflict'
    | 'duplicate_suppressed'
    | 'delivery_seen_written';
  chat_id?: string;
  value?: number;
  duration_ms?: number;
  meta?: Record<string, string | number | boolean>;
  ts: number;
};

import { trackEvent } from '@/lib/analytics';

const PREFIX = '[ChatTelemetry]';

export function logChatMetric(event: ChatMetricEvent) {
  // Replace with Sentry/Datadog bridge in production runtime.
console.log(PREFIX, JSON.stringify(event));
  trackEvent('custom', { metric: 'chat_metric', ...event }, `chat_metric:${event.name}:${event.chat_id || 'na'}`);
}
