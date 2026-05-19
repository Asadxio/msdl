const timers = new Set<string>();
const asyncOps = new Set<string>();
const mediaRefs = new Set<string>();

export function trackTimer(id: string) { if (__DEV__) timers.add(id); }
export function clearTimerTrack(id: string) { if (__DEV__) timers.delete(id); }
export function trackAsyncOp(id: string) { if (__DEV__) asyncOps.add(id); }
export function clearAsyncOp(id: string) { if (__DEV__) asyncOps.delete(id); }
export function trackMediaRef(id: string) { if (__DEV__) mediaRefs.add(id); }
export function clearMediaRef(id: string) { if (__DEV__) mediaRefs.delete(id); }

export function getLifecycleMetrics() {
  return { active_timers: timers.size, active_async_ops: asyncOps.size, active_media_refs: mediaRefs.size };
}

