type StartupMeta = Record<string, unknown>;

const STARTUP_LOG_PREFIX = '[startup]';
const startupStartedAt = Date.now();

export function startupLog(event: string, meta: StartupMeta = {}) {
  const payload = {
    event,
    elapsedMs: Date.now() - startupStartedAt,
    ...meta,
  };
  try {
    console.log(`${STARTUP_LOG_PREFIX} ${JSON.stringify(payload)}`);
  } catch {
    console.log(`${STARTUP_LOG_PREFIX} ${event}`);
  }
}

startupLog('App start');
