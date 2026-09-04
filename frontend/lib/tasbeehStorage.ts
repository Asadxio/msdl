/**
 * tasbeehStorage.ts — Phase 44 & 46
 * High-performance non-blocking persistence for Digital Smart Tasbeeh.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const TASBEEH_STORAGE_KEY = 'mslb_tasbeeh_stats_v2';
export const CUSTOM_DHIKR_STORAGE_KEY = '@msdl_custom_dhikr_presets';

export interface TasbeehStats {
  todayCount: number;
  lifetimeCount: number;
  lastActiveDate: string; // YYYY-MM-DD
  streakDays: number;
  lapsCompleted: number;
  dailyHistory: Record<string, number>; // Date string (YYYY-MM-DD) -> recitation count
}

export interface CustomDhikrItem {
  id: string;
  arabic: string;
  transliteration: string;
  meaning: string;
  target: number;
  virtue?: string;
  createdAt?: number;
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
        dailyHistory: { [today]: 0 },
      };
      return memoryStatsCache;
    }
    const parsed: TasbeehStats = JSON.parse(raw);
    if (!parsed.dailyHistory) {
      parsed.dailyHistory = { [today]: parsed.todayCount || 0 };
    }

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
        dailyHistory: {
          ...(parsed.dailyHistory || {}),
          [today]: 0,
        },
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
      dailyHistory: { [today]: 0 },
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
      dailyHistory: { [today]: amount },
    };
  } else {
    memoryStatsCache.todayCount += amount;
    memoryStatsCache.lifetimeCount += amount;
    memoryStatsCache.lastActiveDate = today;
    if (!memoryStatsCache.dailyHistory) {
      memoryStatsCache.dailyHistory = {};
    }
    memoryStatsCache.dailyHistory[today] = (memoryStatsCache.dailyHistory[today] || 0) + amount;
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

// ─── 9.3 Custom Dhikr Presets Persistence ───
export async function loadCustomDhikrs(): Promise<CustomDhikrItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_DHIKR_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[TasbeehStorage] Failed to load custom dhikrs:', err);
    return [];
  }
}

export async function saveCustomDhikrs(items: CustomDhikrItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CUSTOM_DHIKR_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('[TasbeehStorage] Failed to save custom dhikrs:', err);
  }
}

export async function addCustomDhikr(item: Omit<CustomDhikrItem, 'id' | 'createdAt'>): Promise<CustomDhikrItem[]> {
  const existing = await loadCustomDhikrs();
  const newItem: CustomDhikrItem = {
    ...item,
    id: `custom_dhikr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const updated = [newItem, ...existing];
  await saveCustomDhikrs(updated);
  return updated;
}

export async function deleteCustomDhikr(id: string): Promise<CustomDhikrItem[]> {
  const existing = await loadCustomDhikrs();
  const updated = existing.filter((d) => d.id !== id);
  await saveCustomDhikrs(updated);
  return updated;
}
