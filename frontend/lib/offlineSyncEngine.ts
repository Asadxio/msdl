import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';

export type OfflineActionType =
  | 'chat_message'
  | 'reaction'
  | 'status_upload'
  | 'assignment_submit'
  | 'profile_update'
  | 'course_action'
  | 'moderation_note'
  | 'analytics';

export type OfflineFailureCategory =
  | 'network_failure'
  | 'auth_expired'
  | 'permission_denied'
  | 'validation_failure'
  | 'server_conflict'
  | 'permanent_rejection'
  | 'timeout'
  | 'cancelled';

export type OfflineAction = {
  id: string;
  dedupeKey: string;
  type: OfflineActionType;
  payload: Record<string, unknown>;
  createdAtMs: number;
  updatedAtMs: number;
  expiresAtMs: number;
  retryCount: number;
  maxRetries: number;
  priority: number;
  state: 'pending' | 'processing' | 'failed' | 'resolved' | 'cancelled';
  optimisticRef?: string;
  failureCategory?: OfflineFailureCategory;
  failureReason?: string;
  correlationId?: string;
};

type SyncState = {
  paused: boolean;
  online: boolean;
  reconnecting: boolean;
  flushing: boolean;
  queueLength: number;
  lastFlushAtMs: number;
  replayCount: number;
};

const STORE_KEY = 'offline_sync_queue_v1';
const STATE_KEY = 'offline_sync_state_v1';
const MAX_QUEUE = 500;
const RECONNECT_DEBOUNCE_MS = 2200;
const FLUSH_COOLDOWN_MS = 1200;
const CONCURRENCY = 2;

let state: SyncState = {
  paused: false,
  online: true,
  reconnecting: false,
  flushing: false,
  queueLength: 0,
  lastFlushAtMs: 0,
  replayCount: 0,
};

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function now() { return Date.now(); }

function sortByPriority(actions: OfflineAction[]) {
  return [...actions].sort((a, b) => (a.priority - b.priority) || (a.createdAtMs - b.createdAtMs));
}

function classifyError(err: any): OfflineFailureCategory {
  const msg = String(err?.message || err || '').toLowerCase();
  if (msg.includes('permission') || msg.includes('forbidden')) return 'permission_denied';
  if (msg.includes('auth') || msg.includes('token')) return 'auth_expired';
  if (msg.includes('validation') || msg.includes('invalid')) return 'validation_failure';
  if (msg.includes('conflict') || msg.includes('already exists')) return 'server_conflict';
  if (msg.includes('cancel')) return 'cancelled';
  if (msg.includes('timeout')) return 'timeout';
  if (msg.includes('network') || msg.includes('offline') || msg.includes('fetch')) return 'network_failure';
  return 'permanent_rejection';
}

async function loadQueue(): Promise<OfflineAction[]> {
  const raw = await AsyncStorage.getItem(STORE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as OfflineAction[]; } catch { return []; }
}

async function persistQueue(queue: OfflineAction[]) {
  const bounded = queue.slice(-MAX_QUEUE);
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(bounded));
  state.queueLength = bounded.length;
}

async function persistState() {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function priorityForType(type: OfflineActionType): number {
  switch (type) {
    case 'chat_message': return 1;
    case 'reaction': return 2;
    case 'status_upload': return 3;
    case 'assignment_submit': return 4;
    case 'profile_update': return 5;
    case 'analytics': return 6;
    default: return 5;
  }
}

async function dispatchAction(action: OfflineAction): Promise<void> {
  // centralized route handler; preserve feature compatibility by delegating to existing APIs
  switch (action.type) {
    case 'analytics':
      await fetch('/api/analytics/ingest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [action.payload] }),
      });
      return;
    default:
      if (typeof action.payload.endpoint === 'string') {
        const method = String(action.payload.method || 'POST');
        const body = action.payload.body;
        const headers = (action.payload.headers || {}) as Record<string, string>;
        const res = await fetch(action.payload.endpoint, {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw new Error(`sync_dispatch_failed_${res.status}`);
        return;
      }
      throw new Error('validation_missing_endpoint');
  }
}

export async function enqueueOfflineAction(input: Omit<OfflineAction, 'createdAtMs' | 'updatedAtMs' | 'retryCount' | 'priority' | 'state'>) {
  const queue = await loadQueue();
  if (queue.some((q) => q.dedupeKey === input.dedupeKey && q.state !== 'resolved')) {
    trackEvent('custom', { metric: 'offline_duplicate_suppressed', type: input.type });
    return { ok: true, deduped: true };
  }
  const action: OfflineAction = {
    ...input,
    createdAtMs: now(),
    updatedAtMs: now(),
    retryCount: 0,
    priority: priorityForType(input.type),
    state: 'pending',
  };
  queue.push(action);
  await persistQueue(sortByPriority(queue));
  trackEvent('custom', { metric: 'offline_enqueued', type: action.type, queue: state.queueLength });
  if (state.online && !state.paused) void flushOfflineQueue();
  return { ok: true, deduped: false };
}

export async function clearResolvedActions() {
  const queue = await loadQueue();
  const next = queue.filter((q) => q.state !== 'resolved' && q.state !== 'cancelled');
  await persistQueue(next);
  return { ok: true, removed: queue.length - next.length };
}

export function pauseSyncEngine() {
  state.paused = true;
  void persistState();
}

export function resumeSyncEngine() {
  state.paused = false;
  void persistState();
  if (state.online) void flushOfflineQueue();
}

export function getSyncQueueState() {
  return { ...state };
}

export async function retryFailedSyncs() {
  const queue = await loadQueue();
  const next = queue.map((q) => q.state === 'failed' ? { ...q, state: 'pending', updatedAtMs: now() } : q);
  await persistQueue(sortByPriority(next));
  if (state.online && !state.paused) void flushOfflineQueue();
}

export async function flushOfflineQueue() {
  if (state.paused || state.flushing || !state.online) return;
  if (now() - state.lastFlushAtMs < FLUSH_COOLDOWN_MS) return;
  state.flushing = true;
  state.lastFlushAtMs = now();
  await persistState();

  try {
    let queue = sortByPriority(await loadQueue()).filter((q) => q.expiresAtMs > now());
    const inflight = queue.filter((q) => q.state === 'pending').slice(0, CONCURRENCY);

    await Promise.all(inflight.map(async (action) => {
      const idx = queue.findIndex((q) => q.id === action.id);
      if (idx < 0) return;
      queue[idx] = { ...queue[idx], state: 'processing', updatedAtMs: now() };
      try {
        await dispatchAction(action);
        queue[idx] = { ...queue[idx], state: 'resolved', updatedAtMs: now(), failureCategory: undefined, failureReason: undefined };
        state.replayCount += 1;
      } catch (err) {
        const cat = classifyError(err);
        const retryCount = queue[idx].retryCount + 1;
        const permanent = ['permission_denied', 'validation_failure', 'server_conflict', 'permanent_rejection'].includes(cat);
        if (permanent || retryCount >= queue[idx].maxRetries) {
          queue[idx] = { ...queue[idx], state: 'failed', retryCount, failureCategory: cat, failureReason: String(err), updatedAtMs: now() };
          logger.warn('offline.action.failed', { id: action.id, type: action.type, category: cat, retry_count: retryCount });
        } else {
          queue[idx] = { ...queue[idx], state: 'pending', retryCount, failureCategory: cat, failureReason: String(err), updatedAtMs: now() };
        }
      }
    }));

    await persistQueue(sortByPriority(queue));
    trackEvent('custom', { metric: 'offline_flush', queue: state.queueLength, replay_count: state.replayCount });
    logger.info('offline.flush.complete', { queue: state.queueLength, replay_count: state.replayCount });
  } finally {
    state.flushing = false;
    await persistState();
  }
}

export async function initOfflineSyncEngine() {
  const raw = await AsyncStorage.getItem(STATE_KEY);
  if (raw) {
    try { state = { ...state, ...(JSON.parse(raw) as Partial<SyncState>) }; } catch { /* ignore */ }
  }

  const handleOnline = () => {
    const wasOnline = state.online;
    state.online = typeof navigator !== 'undefined' ? (navigator as any).onLine !== false : true;
    if (!wasOnline && state.online) {
      state.reconnecting = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        state.reconnecting = false;
        if (!state.paused) void flushOfflineQueue();
      }, RECONNECT_DEBOUNCE_MS);
      trackEvent('custom', { metric: 'offline_reconnect_detected' });
    }
    void persistState();
  };
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOnline);
  }
  handleOnline();
}

