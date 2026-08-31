/**
 * tasbeehStorage.ts — Phase 44
 * Manages persistence for Digital Smart Tasbeeh daily and lifetime counts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const TASBEEH_STORAGE_KEY = 'mslb_tasbeeh_stats_v1';

export interface TasbeehStats {
  todayCount: number;
  lifetimeCount: number;
  lastActiveDate: string; // YYYY-MM-DD
  streakDays: number;
  lapsCompleted: number;
}

const getTodayDateStr = () => new Date().toISOString().slice(0, 10);

export async function loadTasbeehStats(): Promise<TasbeehStats> {
  const today = getTodayDateStr();
  try {
    const raw = await AsyncStorage.getItem(TASBEEH_STORAGE_KEY);
    if (!raw) {
      return {
        todayCount: 0,
        lifetimeCount: 0,
        lastActiveDate: today,
        streakDays: 1,
        lapsCompleted: 0,
      };
    }
    const parsed: TasbeehStats = JSON.parse(raw);

    // If day has changed, reset todayCount and update streak
    if (parsed.lastActiveDate !== today) {
      const lastDate = new Date(parsed.lastActiveDate);
      const currentDate = new Date(today);
      const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

      return {
        todayCount: 0,
        lifetimeCount: parsed.lifetimeCount || 0,
        lastActiveDate: today,
        streakDays: diffDays === 1 ? (parsed.streakDays || 0) + 1 : 1,
        lapsCompleted: 0,
      };
    }

    return parsed;
  } catch {
    return {
      todayCount: 0,
      lifetimeCount: 0,
      lastActiveDate: today,
      streakDays: 1,
      lapsCompleted: 0,
    };
  }
}

export async function saveTasbeehStats(stats: TasbeehStats): Promise<void> {
  try {
    await AsyncStorage.setItem(TASBEEH_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // ignore
  }
}

export async function recordTasbeehTap(amount: number = 1): Promise<TasbeehStats> {
  const current = await loadTasbeehStats();
  const next: TasbeehStats = {
    ...current,
    todayCount: current.todayCount + amount,
    lifetimeCount: current.lifetimeCount + amount,
    lastActiveDate: getTodayDateStr(),
  };
  await saveTasbeehStats(next);
  return next;
}

export async function recordTasbeehLap(): Promise<TasbeehStats> {
  const current = await loadTasbeehStats();
  const next: TasbeehStats = {
    ...current,
    lapsCompleted: (current.lapsCompleted || 0) + 1,
  };
  await saveTasbeehStats(next);
  return next;
}

export async function resetDailyTasbeeh(): Promise<TasbeehStats> {
  const current = await loadTasbeehStats();
  const next: TasbeehStats = {
    ...current,
    todayCount: 0,
    lapsCompleted: 0,
  };
  await saveTasbeehStats(next);
  return next;
}
