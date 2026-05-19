import Constants from 'expo-constants';
import { enforceClientRateLimit } from '@/lib/rateLimit';
import { registerSecurityEvent, validateSecureAction } from '@/lib/securityEngine';
import { logStructuredEvent, recordFailureEvent } from '@/lib/observabilityEngine';

export type SecurityActionInput = {
  action: string;
  actorId: string;
  sessionId: string;
  deviceId: string;
  idempotencyKey?: string;
  rateLimit?: { key: string; limit: number; windowMs: number };
  metadata?: Record<string, unknown>;
};

export async function guardSensitiveAction(input: SecurityActionInput): Promise<{ ok: boolean; reason?: string; retryAfterMs?: number }> {
  const secure = await validateSecureAction({
    action: input.action,
    actorId: input.actorId,
    sessionId: input.sessionId,
    deviceId: input.deviceId,
    idempotencyKey: input.idempotencyKey || `${input.action}:${input.actorId}`,
    metadata: input.metadata,
    timestampMs: Date.now(),
  });
  if (!secure.ok) {
    await registerSecurityEvent('secure_action_denied', { action: input.action, reason: secure.reason || 'unknown' });
    logStructuredEvent({ category: 'security_denied', subsystem: 'security', severity: 'warn', metadata: { action: input.action, reason: secure.reason || 'unknown' } });
    return { ok: false, reason: secure.reason };
  }

  if (input.rateLimit) {
    const rate = enforceClientRateLimit(input.rateLimit.key, input.rateLimit.limit, input.rateLimit.windowMs);
    if (!rate.allowed) {
      await registerSecurityEvent('rate_limit_hit', { action: input.action, retryAfterMs: rate.retryAfterMs });
      recordFailureEvent('realtime', 'warn', { action: input.action, retryAfterMs: rate.retryAfterMs });
      return { ok: false, reason: 'rate_limited', retryAfterMs: rate.retryAfterMs };
    }
  }
  return { ok: true };
}

export function securityDevDiagnostics() {
  if (!__DEV__) return null;
  const appOwnership = (Constants?.appOwnership || 'unknown');
  return { appOwnership, ts: Date.now(), dev: true };
}

