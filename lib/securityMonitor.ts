import { logger } from '@/lib/logger';

export function trackSecurity(name: string, payload: Record<string, unknown> = {}) {
  const safe = { ...payload, at_ms: Date.now() };
  if (__DEV__) logger.warn(`[security] ${name}`, safe);
}
