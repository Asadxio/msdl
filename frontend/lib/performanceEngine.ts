import { AppState, InteractionManager, Platform } from 'react-native';

export type PerformanceSurfaceOptions = {
  surface: string;
  maxRendersPerMinute?: number;
  cleanupIntervalMs?: number;
  lowEndSafe?: boolean;
};

type CleanupHandler = () => void;

type SurfaceState = {
  options: PerformanceSurfaceOptions;
  cleanupHandlers: Set<CleanupHandler>;
  lastActiveAtMs: number;
  renderCount: number;
};

type MetricEvent = {
  name: string;
  atMs: number;
  value?: number;
  tags?: Record<string, string | number | boolean>;
};

export type PerformanceState = {
  lowEndMode: boolean;
  memoryPressure: 'low' | 'medium' | 'high';
  batterySaver: boolean;
  networkConstrained: boolean;
  registeredSurfaces: string[];
  metricsBuffered: number;
  cleanupRuns: number;
};

const surfaces = new Map<string, SurfaceState>();
const metrics: MetricEvent[] = [];
const realtimeBuckets = new Map<string, { queue: unknown[]; timer: ReturnType<typeof setTimeout> | null }>();

let cleanupRuns = 0;
let memoryPressure: PerformanceState['memoryPressure'] = 'low';
let batterySaver = false;
let networkConstrained = Platform.OS === 'android';

const MAX_METRICS = 300;
const LOW_PRIORITY_DELAY_MS = 24;
const DEFAULT_REALTIME_THROTTLE_MS = 120;
const LOW_END_REALTIME_THROTTLE_MS = 260;

function now() {
  return Date.now();
}

function getLowEndMode() {
  return Platform.OS === 'android' && (memoryPressure !== 'low' || batterySaver || networkConstrained);
}

function pushMetric(event: MetricEvent) {
  metrics.push(event);
  if (metrics.length > MAX_METRICS) metrics.splice(0, metrics.length - MAX_METRICS);
}

export function registerPerformanceSurface(options: PerformanceSurfaceOptions) {
  const existing = surfaces.get(options.surface);
  if (existing) {
    existing.options = { ...existing.options, ...options };
    existing.lastActiveAtMs = now();
  } else {
    surfaces.set(options.surface, {
      options,
      cleanupHandlers: new Set(),
      lastActiveAtMs: now(),
      renderCount: 0,
    });
  }
  pushMetric({ name: 'surface_registered', atMs: now(), tags: { surface: options.surface } });

  return {
    touch: () => {
      const current = surfaces.get(options.surface);
      if (current) current.lastActiveAtMs = now();
    },
    onCleanup: (handler: CleanupHandler) => {
      const current = surfaces.get(options.surface);
      if (!current) return () => {};
      current.cleanupHandlers.add(handler);
      return () => current.cleanupHandlers.delete(handler);
    },
    unregister: () => {
      surfaces.delete(options.surface);
      pushMetric({ name: 'surface_unregistered', atMs: now(), tags: { surface: options.surface } });
    },
  };
}

export function trackPerformanceMetric(name: string, value?: number, tags?: MetricEvent['tags']) {
  pushMetric({ name, value, tags, atMs: now() });
}

export function scheduleLowPriorityTask(task: () => void, delayMs = LOW_PRIORITY_DELAY_MS) {
  const timeout = setTimeout(() => {
    InteractionManager.runAfterInteractions(() => {
      try {
        task();
      } catch {
        // no-op
      }
    });
  }, Math.max(0, delayMs));
  return () => clearTimeout(timeout);
}

export function throttleRealtimeUpdates<T>(channel: string, events: T[], apply: (events: T[]) => void, throttleMs?: number) {
  const effectiveMs = throttleMs || (getLowEndMode() ? LOW_END_REALTIME_THROTTLE_MS : DEFAULT_REALTIME_THROTTLE_MS);
  const bucket = realtimeBuckets.get(channel) || { queue: [], timer: null };
  bucket.queue.push(...events);
  if (bucket.timer) {
    realtimeBuckets.set(channel, bucket);
    return;
  }
  bucket.timer = setTimeout(() => {
    const payload = bucket.queue.slice();
    bucket.queue = [];
    bucket.timer = null;
    realtimeBuckets.set(channel, bucket);
    apply(payload as T[]);
    pushMetric({ name: 'realtime_batch_flushed', atMs: now(), value: payload.length, tags: { channel, effectiveMs } });
  }, effectiveMs);
  realtimeBuckets.set(channel, bucket);
}

export function detectMemoryPressure(signal: 'low' | 'medium' | 'high', reason = 'runtime') {
  memoryPressure = signal;
  pushMetric({ name: 'memory_pressure', atMs: now(), tags: { signal, reason } });
}

export function cleanupInactiveResources(maxIdleMs = 3 * 60 * 1000) {
  const cutoff = now() - maxIdleMs;
  surfaces.forEach((surface, key) => {
    if (surface.lastActiveAtMs > cutoff) return;
    surface.cleanupHandlers.forEach((handler) => {
      try { handler(); } catch {}
    });
    cleanupRuns += 1;
    pushMetric({ name: 'surface_cleanup', atMs: now(), tags: { surface: key } });
  });
}

export function getPerformanceState(): PerformanceState {
  return {
    lowEndMode: getLowEndMode(),
    memoryPressure,
    batterySaver,
    networkConstrained,
    registeredSurfaces: Array.from(surfaces.keys()),
    metricsBuffered: metrics.length,
    cleanupRuns,
  };
}

AppState.addEventListener('change', (next) => {
  if (next === 'background') {
    cleanupInactiveResources(45_000);
    trackPerformanceMetric('app_background_cleanup');
  }
});

export function setBatterySaverMode(enabled: boolean) {
  batterySaver = !!enabled;
}

export function setNetworkConstrainedMode(enabled: boolean) {
  networkConstrained = !!enabled;
}
