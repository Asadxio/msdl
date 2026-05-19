import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';

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
  logger.warn('error.report', { message, ...context });
  trackEvent('api_error', {
    kind: context.kind,
    message,
    screen: context.screen ?? '',
    code: context.code ?? '',
    retry_count: context.retryCount ?? 0,
    network: context.network ?? 'unknown',
    ...context.extra,
  });
}
