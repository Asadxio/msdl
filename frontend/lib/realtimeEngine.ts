import { AppState, AppStateStatus } from 'react-native';
import { trackEvent } from '@/lib/analytics';
import { cleanupInactiveResources, registerPerformanceSurface, throttleRealtimeUpdates, trackPerformanceMetric } from '@/lib/performanceEngine';

type PresenceState = 'active' | 'idle' | 'background' | 'offline';

type RealtimeSubscription = {
  key: string;
  refs: number;
  createdAtMs: number;
  updatedAtMs: number;
  unsubscribe: () => void;
  paused: boolean;
};

type PendingEvent = {
  id: string;
  ts: number;
  apply: () => void;
};

type HealthState = {
  paused: boolean;
  presence: PresenceState;
  activeSubscriptions: number;
  reconnectAttempts: number;
  dedupedEvents: number;
  droppedStaleEvents: number;
  lastHeartbeatMs: number;
};

const registry = new Map<string, RealtimeSubscription>();
const seenEvents = new Map<string, number>();
const eventQueue: PendingEvent[] = [];

const EVENT_TTL_MS = 60_000;
const MAX_SEEN = 5000;
const MAX_QUEUE_BATCH = 25;
const HEARTBEAT_ACTIVE_MS = 25_000;
const HEARTBEAT_IDLE_MS = 55_000;
const RECONNECT_BASE_MS = 700;
const RECONNECT_MAX_MS = 20_000;
const RECONNECT_MAX_ATTEMPTS = 8;

let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let appState: AppStateStatus = 'active';
let health: HealthState = {
  paused: false,
  presence: 'active',
  activeSubscriptions: 0,
  reconnectAttempts: 0,
  dedupedEvents: 0,
  droppedStaleEvents: 0,
  lastHeartbeatMs: 0,
};
const realtimePerfSurface = registerPerformanceSurface({ surface: 'realtime_engine', cleanupIntervalMs: 90000, lowEndSafe: true });

function now() { return Date.now(); }

function pruneSeen() {
  const t = now();
  for (const [k, v] of seenEvents.entries()) {
    if (t - v > EVENT_TTL_MS) seenEvents.delete(k);
  }
  if (seenEvents.size > MAX_SEEN) {
    const sorted = [...seenEvents.entries()].sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < sorted.length - MAX_SEEN; i += 1) seenEvents.delete(sorted[i][0]);
  }
}

function scheduleFlush() {
  if (flushTimer || health.paused) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const batch = eventQueue.splice(0, MAX_QUEUE_BATCH);
    throttleRealtimeUpdates<PendingEvent>('realtime_event_flush', batch, (events) => {
      events.forEach((ev) => ev.apply());
      trackPerformanceMetric('realtime_batch_applied', events.length);
    });
    if (eventQueue.length > 0) scheduleFlush();
  }, 50);
}

function enqueueEvent(eventId: string, timestampMs: number, apply: () => void) {
  pruneSeen();
  const t = now();
  if (!eventId || typeof eventId !== 'string') {
    eventQueue.push({ id: `anon_${t}_${Math.random()}`, ts: t, apply });
    scheduleFlush();
    return;
  }
  if (seenEvents.has(eventId)) {
    health.dedupedEvents += 1;
    return;
  }
  if (t - timestampMs > EVENT_TTL_MS) {
    health.droppedStaleEvents += 1;
    return;
  }
  seenEvents.set(eventId, t);
  eventQueue.push({ id: eventId, ts: timestampMs, apply });
  scheduleFlush();
}

function heartbeatInterval() {
  if (health.presence === 'active') return HEARTBEAT_ACTIVE_MS;
  if (health.presence === 'idle') return HEARTBEAT_IDLE_MS;
  return HEARTBEAT_IDLE_MS;
}

function scheduleHeartbeat() {
  if (heartbeatTimer) clearTimeout(heartbeatTimer);
  if (health.paused || health.presence === 'offline') return;
  heartbeatTimer = setTimeout(() => {
    health.lastHeartbeatMs = now();
    trackEvent('custom', { metric: 'realtime_heartbeat', presence: health.presence, subscriptions: health.activeSubscriptions });
    scheduleHeartbeat();
  }, heartbeatInterval());
}

function setPresence(state: PresenceState) {
  health.presence = state;
  scheduleHeartbeat();
}

export function updatePresenceState(state: PresenceState) {
  setPresence(state);
}

export function registerRealtimeSubscription(key: string, subscribeFactory: () => () => void) {
  const existing = registry.get(key);
  if (existing) {
    existing.refs += 1;
    existing.updatedAtMs = now();
    return () => unregisterRealtimeSubscription(key);
  }
  const unsubscribe = subscribeFactory();
  registry.set(key, { key, refs: 1, createdAtMs: now(), updatedAtMs: now(), unsubscribe, paused: false });
  health.activeSubscriptions = registry.size;
  trackEvent('custom', { metric: 'realtime_subscription_add', key, active: health.activeSubscriptions });
  return () => unregisterRealtimeSubscription(key);
}

export function unregisterRealtimeSubscription(key: string) {
  const existing = registry.get(key);
  if (!existing) return;
  existing.refs -= 1;
  existing.updatedAtMs = now();
  if (existing.refs <= 0) {
    try { existing.unsubscribe(); } catch { /* noop */ }
    registry.delete(key);
    health.activeSubscriptions = registry.size;
    trackEvent('custom', { metric: 'realtime_subscription_remove', key, active: health.activeSubscriptions });
  }
}

export function pauseRealtimeEngine() {
  health.paused = true;
  setPresence(appState === 'background' ? 'background' : 'idle');
  cleanupInactiveResources(30_000);
}

export function resumeRealtimeEngine() {
  health.paused = false;
  setPresence(appState === 'active' ? 'active' : 'idle');
  reconnectRealtimeEngine();
}

export function reconnectRealtimeEngine() {
  if (reconnectTimer || health.paused) return;
  const attempt = Math.min(RECONNECT_MAX_ATTEMPTS, health.reconnectAttempts + 1);
  health.reconnectAttempts = attempt;
  const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * (2 ** attempt) + Math.floor(Math.random() * 400));
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    for (const sub of registry.values()) {
      if (sub.paused) continue;
      // soft-touch reconnect by toggling paused flag; concrete listeners keep own SDK reconnect
      sub.updatedAtMs = now();
    }
    health.reconnectAttempts = 0;
    trackEvent('custom', { metric: 'realtime_reconnect', subscriptions: registry.size });
    scheduleHeartbeat();
  }, delay);
}

export function getRealtimeHealthState(): HealthState {
  return { ...health };
}

export function applyRealtimeEvent(eventId: string, timestampMs: number, apply: () => void) {
  enqueueEvent(eventId, timestampMs, apply);
}

export function initRealtimeEngine() {
  realtimePerfSurface.touch();
  AppState.addEventListener('change', (next) => {
    appState = next;
    if (next === 'active') {
      setPresence('active');
      reconnectRealtimeEngine();
    } else if (next === 'background') {
      setPresence('background');
      cleanupInactiveResources(45_000);
    } else {
      setPresence('idle');
    }
  });
  setPresence('active');
}
