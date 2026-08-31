/**
 * tasbeehStorage.ts — Phase 44 & 46
 * High-performance non-blocking persistence for Digital Smart Tasbeeh.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const TASBEEH_STORAGE_KEY = 'mslb_tasbeeh_stats_v2';

export interface TasbeehStats {
  todayCount: number;
  lifetimeCount: number;
  lastActiveDate: string; // YYYY-MM-DD
  streakDays: number;
  lapsCompleted: number;
}

const getTodayDateStr = () => new Date().toISOString().slice(0, 10);

let memoryStatsCache: TasbeehStats | null = null;
let saveDebounceTimer: any = null;
let pendingDelta = 0;

export async function loadTasbeehStats(): Promise<TasbeehStats> {
  const today = getTodayDateStr();
  try {
    const raw = await AsyncStorage.getItem(TASBEEH_STORAGE_KEY);
    if (!raw) {
      memoryStatsCache = {
        todayCount: 0,
        lifetimeCount: 0,
        lastActiveDate: today,
        streakDays: 1,
        lapsCompleted: 0,
      };
      return memoryStatsCache;
    }
    const parsed: TasbeehStats = JSON.parse(raw);

    // If day has changed, reset todayCount and update streak
    if (parsed.lastActiveDate !== today) {
      const lastDate = new Date(parsed.lastActiveDate);
      const currentDate = new Date(today);
      const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

      memoryStatsCache = {
        todayCount: 0,
        lifetimeCount: parsed.lifetimeCount || 0,
        lastActiveDate: today,
        streakDays: diffDays === 1 ? (parsed.streakDays || 0) + 1 : 1,
        lapsCompleted: 0,
      };
      await saveTasbeehStats(memoryStatsCache);
      return memoryStatsCache;
    }

    memoryStatsCache = parsed;
    return parsed;
  } catch {
    memoryStatsCache = {
      todayCount: 0,
      lifetimeCount: 0,
      lastActiveDate: today,
      streakDays: 1,
      lapsCompleted: 0,
    };
    return memoryStatsCache;
  }
}

export async function saveTasbeehStats(stats: TasbeehStats): Promise<void> {
  memoryStatsCache = stats;
  try {
    await AsyncStorage.setItem(TASBEEH_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // ignore
  }
}

/**
 * Non-blocking buffered increment: Instant synchronous in-memory update,
 * debounced disk write to support 50+ rapid taps/second with zero lag.
 */
export function queueTasbeehTap(amount: number = 1): TasbeehStats {
  const today = getTodayDateStr();
  if (!memoryStatsCache) {
    memoryStatsCache = {
      todayCount: amount,
      lifetimeCount: amount,
      lastActiveDate: today,
      streakDays: 1,
      lapsCompleted: 0,
    };
  } else {
    memoryStatsCache.todayCount += amount;
    memoryStatsCache.lifetimeCount += amount;
    memoryStatsCache.lastActiveDate = today;
  }

  pendingDelta += amount;

  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  saveDebounceTimer = setTimeout(() => {
    if (memoryStatsCache) {
      saveTasbeehStats(memoryStatsCache);
      pendingDelta = 0;
    }
  }, 400);

  return { ...memoryStatsCache };
}

export async function recordTasbeehTap(amount: number = 1): Promise<TasbeehStats> {
  return queueTasbeehTap(amount);
}

export async function recordTasbeehLap(): Promise<TasbeehStats> {
  const current = memoryStatsCache || (await loadTasbeehStats());
  const next: TasbeehStats = {
    ...current,
    lapsCompleted: (current.lapsCompleted || 0) + 1,
  };
  await saveTasbeehStats(next);
  return next;
}

export async function resetDailyTasbeeh(): Promise<TasbeehStats> {
  const current = memoryStatsCache || (await loadTasbeehStats());
  const next: TasbeehStats = {
    ...current,
    todayCount: 0,
    lapsCompleted: 0,
  };
  await saveTasbeehStats(next);
  return next;
}
