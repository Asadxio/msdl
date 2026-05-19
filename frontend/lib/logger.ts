import { ENV } from '@/config/environments';

type Level = 'info' | 'warn' | 'error';

const PROD_INFO_ENABLED = false;
const MAX_LOGS_PER_MINUTE = 120;
let windowStart = Date.now();
let emittedInWindow = 0;

function shouldEmit(level: Level) {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    emittedInWindow = 0;
  }
  const allowLevel = ENV !== 'production' || level !== 'info' || PROD_INFO_ENABLED;
  if (!allowLevel) return false;
  if (emittedInWindow >= MAX_LOGS_PER_MINUTE && level === 'info') return false;
  emittedInWindow += 1;
  return true;
}

function emit(level: Level, message: string, meta?: unknown) {
  if (!shouldEmit(level)) return;
  const payload = {
    ts: new Date().toISOString(),
    env: ENV,
    level,
    message,
    meta: meta ?? null,
  };
  const line = `[app:${level}] ${JSON.stringify(payload)}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, meta?: unknown) => emit('info', message, meta),
  warn: (message: string, meta?: unknown) => emit('warn', message, meta),
  error: (message: string, meta?: unknown) => emit('error', message, meta),
};
