import { logger } from '@/lib/logger';

const enabled = __DEV__;

export function perfStart(label: string): number {
  return enabled ? Date.now() : 0;
}

export function perfEnd(label: string, startMs: number, extra?: Record<string, unknown>) {
  if (!enabled) return;
  const dur = Date.now() - startMs;
  if (dur > 300) logger.warn(`[perf] ${label} ${dur}ms`, extra || {});
}
