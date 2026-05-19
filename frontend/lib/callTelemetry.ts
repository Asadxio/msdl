import { logger } from '@/lib/logger';

export type CallMetricEvent =
  | 'call_setup_latency'
  | 'avg_call_duration'
  | 'reconnect_frequency'
  | 'reconnect_duration'
  | 'token_renewal_failure'
  | 'join_failure'
  | 'cleanup_cause'
  | 'heartbeat_miss'
  | 'delayed_push_open'
  | 'rtc_reconnect_recovered';

export function trackCallMetric(event: CallMetricEvent, callId: string, payload: Record<string, unknown> = {}) {
  logger.info('call_metric', {
    event,
    call_id: callId,
    ts: Date.now(),
    ...payload,
  });
}
