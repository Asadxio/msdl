import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { reportTelemetryError, TelemetryCategory } from '@/lib/telemetry';

export type ErrorContext = {
  kind: 'api' | 'realtime' | 'upload' | 'rtc' | 'ui' | 'unknown';
  screen?: string;
  code?: string;
  retryCount?: number;
  network?: string;
  extra?: Record<string, unknown>;
};

export function reportError(error: unknown, context: ErrorContext) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.warn('error.report', { message, ...context });
  trackEvent('custom', { metric: 'operational_event', category: 'error', kind: context.kind, code: context.code || '', screen: context.screen || '' }, `ops:error:${context.kind}:${context.code || 'na'}`);
  trackEvent('api_error', {
    kind: context.kind,
    message,
    screen: context.screen ?? '',
    code: context.code ?? '',
    retry_count: context.retryCount ?? 0,
    network: context.network ?? 'unknown',
    ...context.extra,
  });

  const categoryMap: Record<string, TelemetryCategory> = {
    rtc: 'live_class',
    upload: 'general',
    api: 'network',
    realtime: 'network',
    ui: 'ui',
  };

  void reportTelemetryError({
    category: categoryMap[context.kind] || 'general',
    message,
    stack,
    screenRoute: context.screen,
  });
}
