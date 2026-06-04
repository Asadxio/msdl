import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackEvent } from '@/lib/analytics';

export type SecureAction = {
  action: string;
  actorId: string;
  sessionId: string;
  deviceId: string;
  idempotencyKey?: string;
  timestampMs?: number;
  metadata?: Record<string, unknown>;
};

export type SecurityRiskState = {
  abuseScore: number;
  cooldownUntilMs: number;
  forcedLogout: boolean;
  suspiciousCount: number;
};

const STATE_KEY = 'security_engine_state_v1';
const NONCE_KEY = 'security_engine_nonce_v1';
const ACTION_WINDOW_MS = 60_000;

let state: SecurityRiskState = {
  abuseScore: 0,
  cooldownUntilMs: 0,
  forcedLogout: false,
  suspiciousCount: 0,
};

const recentActions = new Map<string, number>();

function now() { return Date.now(); }

function pruneRecent() {
  const t = now();
  for (const [k, v] of recentActions.entries()) if (t - v > ACTION_WINDOW_MS) recentActions.delete(k);
}

async function persistState() {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export async function initSecurityEngine() {
  const raw = await AsyncStorage.getItem(STATE_KEY);
  if (raw) {
    try { state = { ...state, ...(JSON.parse(raw) as Partial<SecurityRiskState>) }; } catch { /* noop */ }
  }
}

export async function validateSecureAction(input: SecureAction): Promise<{ ok: boolean; reason?: string }> {
  const ts = Number(input.timestampMs || now());
  if (Math.abs(now() - ts) > 5 * 60 * 1000) return { ok: false, reason: 'stale_action' };
  if (!input.actorId || !input.sessionId || !input.deviceId) return { ok: false, reason: 'missing_security_context' };
  if (state.forcedLogout) return { ok: false, reason: 'session_invalidated' };
  if (state.cooldownUntilMs > now()) return { ok: false, reason: 'cooldown_active' };

  pruneRecent();
  const replayKey = input.idempotencyKey || `${input.action}:${input.actorId}:${Math.floor(ts / 1000)}`;
  if (recentActions.has(replayKey)) {
    state.abuseScore += 2;
    state.suspiciousCount += 1;
    await persistState();
    return { ok: false, reason: 'duplicate_action' };
  }
  recentActions.set(replayKey, now());
  return { ok: true };
}

export async function registerSecurityEvent(name: string, payload: Record<string, unknown> = {}) {
  const suspicious = name.includes('abuse') || name.includes('replay') || name.includes('denied');
  if (suspicious) {
    state.abuseScore += 1;
    state.suspiciousCount += 1;
    if (state.abuseScore >= 12) state.cooldownUntilMs = now() + 2 * 60 * 1000;
    if (state.abuseScore >= 25) state.forcedLogout = true;
    await persistState();
  }
  trackEvent('custom', { metric: 'security_event', name, suspicious, ...payload });
}

export async function evaluateAbuseRisk(action: string, retryCount = 0) {
  const score = state.abuseScore + retryCount + (action.includes('upload') ? 1 : 0);
  const risk = score >= 20 ? 'high' : score >= 10 ? 'medium' : 'low';
  if (risk !== 'low') await registerSecurityEvent('abuse_risk_eval', { action, risk, score });
  return { risk, score };
}

export function getSecurityRiskState() {
  return { ...state };
}

export async function invalidateSession(reason: string) {
  state.forcedLogout = true;
  await persistState();
  await registerSecurityEvent('session_invalidated', { reason });
}

export async function rotateSecurityState() {
  state.abuseScore = Math.max(0, Math.floor(state.abuseScore / 2));
  state.suspiciousCount = Math.max(0, Math.floor(state.suspiciousCount / 2));
  state.cooldownUntilMs = 0;
  await persistState();
}

export function createAuditEvent(action: string, actorId: string, metadata: Record<string, unknown> = {}) {
  return {
    action,
    actor_id: actorId,
    metadata,
    created_at_ms: now(),
  };
}
