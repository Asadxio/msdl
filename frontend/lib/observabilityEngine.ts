import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackEvent } from '@/lib/analytics';
import { getPerformanceState } from '@/lib/performanceEngine';

export type ObservabilitySeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical';
export type ObservabilitySubsystem =
  | 'chat' | 'uploads' | 'realtime' | 'rtc' | 'live_classes' | 'notifications'
  | 'payments' | 'moderation' | 'admin' | 'sync' | 'security' | 'runtime' | 'unknown';
export type FailureCategory =
  | 'network' | 'auth' | 'validation' | 'timeout' | 'permission' | 'realtime' | 'rtc'
  | 'upload' | 'storage' | 'rendering' | 'memory_pressure' | 'abuse_security' | 'unknown';

type StructuredEvent = {
  id: string;
  atMs: number;
  category: string;
  subsystem: ObservabilitySubsystem;
  severity: ObservabilitySeverity;
  correlationId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
};

type TraceState = { id: string; startedAtMs: number; name: string; retries: number; status: 'running' | 'completed' | 'failed' };
type HealthState = {
  degraded: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  reconnectFrequency: number;
  queuePressure: number;
  uploadFailureRate: number;
  memoryPressureScore: number;
  rtcInstability: number;
};

const BUFFER_KEY = 'obs_engine_buffer_v1';
const MAX_BUFFER = 300;
const BUFFER_TTL_MS = 6 * 60 * 60 * 1000;
const events: StructuredEvent[] = [];
const traces = new Map<string, TraceState>();
const health: HealthState = { degraded: false, riskLevel: 'low', reconnectFrequency: 0, queuePressure: 0, uploadFailureRate: 0, memoryPressureScore: 0, rtcInstability: 0 };

function now() { return Date.now(); }
function redact(metadata: Record<string, unknown> = {}) {
  const redacted: Record<string, unknown> = {};
  Object.entries(metadata).forEach(([k, v]) => {
    if (/(token|password|secret|authorization|email|phone)/i.test(k)) redacted[k] = '[REDACTED]';
    else redacted[k] = v;
  });
  return redacted;
}
function pushEvent(event: StructuredEvent) {
  events.push(event);
  const cutoff = now() - BUFFER_TTL_MS;
  while (events.length > MAX_BUFFER) events.shift();
  while (events.length > 0 && events[0].atMs < cutoff) events.shift();
}

export function logStructuredEvent(input: Omit<StructuredEvent, 'id' | 'atMs'>) {
  const event: StructuredEvent = { ...input, id: `${input.subsystem}_${now()}_${Math.random().toString(16).slice(2, 8)}`, atMs: now(), metadata: redact(input.metadata) };
  pushEvent(event);
}

export function registerOperationalTrace(name: string, traceId: string, retries = 0) {
  traces.set(traceId, { id: traceId, name, retries, startedAtMs: now(), status: 'running' });
  logStructuredEvent({ category: 'trace_start', subsystem: 'runtime', severity: 'info', traceId, metadata: { name, retries } });
  return {
    complete: () => {
      const tr = traces.get(traceId);
      if (!tr) return;
      tr.status = 'completed';
      logStructuredEvent({ category: 'trace_complete', subsystem: 'runtime', severity: 'info', traceId, metadata: { durationMs: now() - tr.startedAtMs, retries: tr.retries } });
      traces.delete(traceId);
    },
    fail: (reason: string) => {
      const tr = traces.get(traceId);
      if (!tr) return;
      tr.status = 'failed';
      recordFailureEvent('unknown', 'warn', { traceId, reason, durationMs: now() - tr.startedAtMs });
      traces.delete(traceId);
    },
  };
}

export function trackRuntimeHealth(patch: Partial<HealthState>) {
  Object.assign(health, patch);
  const score = health.reconnectFrequency + health.queuePressure + health.uploadFailureRate + health.memoryPressureScore + health.rtcInstability;
  health.riskLevel = score >= 16 ? 'high' : score >= 8 ? 'medium' : 'low';
  health.degraded = health.riskLevel !== 'low';
}

export function createDiagnosticSnapshot(context = 'runtime') {
  return {
    context,
    atMs: now(),
    health: { ...health },
    perf: getPerformanceState(),
    tracesActive: traces.size,
    bufferedEvents: events.length,
  };
}

export function recordFailureEvent(category: FailureCategory, severity: Exclude<ObservabilitySeverity, 'debug'>, metadata: Record<string, unknown> = {}) {
  logStructuredEvent({ category: 'failure', subsystem: 'runtime', severity, metadata: { failureCategory: category, ...metadata } });
}

export function getSystemHealthState() {
  return { ...health };
}

export async function flushDiagnosticBuffer(reason = 'manual') {
  const snapshot = createDiagnosticSnapshot(reason);
  await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify({ snapshot, events: events.slice(-MAX_BUFFER) }));
  trackEvent('custom', { metric: 'diagnostic_flush', reason, riskLevel: snapshot.health.riskLevel, events: events.length });
  return snapshot;
}

