import { serverTimestamp, type FieldValue } from 'firebase/firestore';

export type ReconnectPhase = 'idle' | 'reconnecting' | 'rejoining' | 'failed' | 'recovered';

export type ReconnectDiagnostics = {
  phase: ReconnectPhase;
  lastReconnectReason: string;
  lastReconnectAtMs: number;
  reconnectLatencyMs: number;
  reconnectAttemptCount: number;
};

export const RECONNECT_BACKOFF_MS = [1000, 2000, 5000, 10000, 20000] as const;
export const HEARTBEAT_INTERVAL_MS = 25000;
export const STALE_HEARTBEAT_MS = 90000;
export const DELETE_HEARTBEAT_MS = 180000;

export function getReconnectDelayMs(attempt: number): number {
  const base = RECONNECT_BACKOFF_MS[Math.min(RECONNECT_BACKOFF_MS.length - 1, Math.max(0, attempt - 1))];
  const jitter = Math.round(base * (Math.random() * 0.35));
  return base + jitter;
}

export function buildReconnectDiagnostics(
  phase: ReconnectPhase,
  reason: string,
  startedAtMs: number,
  attempt: number,
): ReconnectDiagnostics {
  return {
    phase,
    lastReconnectReason: reason,
    lastReconnectAtMs: Date.now(),
    reconnectLatencyMs: Math.max(0, Date.now() - startedAtMs),
    reconnectAttemptCount: attempt,
  };
}

export function shallowChanged<T extends Record<string, unknown>>(prev: T | null | undefined, next: T): boolean {
  if (!prev) return true;
  const keys = Object.keys(next);
  for (const key of keys) {
    if (prev[key] !== next[key]) return true;
  }
  return false;
}

export function heartbeatPayload(): { heartbeat_at: FieldValue; last_seen_at: FieldValue } {
  return {
    heartbeat_at: serverTimestamp(),
    last_seen_at: serverTimestamp(),
  };
}
