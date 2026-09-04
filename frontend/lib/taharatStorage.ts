import AsyncStorage from '@react-native-async-storage/async-storage';
import { CycleEntry, UserHabit } from './taharatCalculator';

export const TAHARAT_DATA_STORAGE_KEY = '@msdl_taharat_secure_entries';
export const TAHARAT_HABIT_STORAGE_KEY = '@msdl_taharat_habit_settings';
export const TAHARAT_QADHA_STORAGE_KEY = '@msdl_taharat_qadha_fasts';
export const TAHARAT_PIN_STORAGE_KEY = '@msdl_taharat_security_pin';
export const TAHARAT_GHUSL_REMINDER_KEY = '@msdl_taharat_ghusl_reminder';
export const TAHARAT_NAMAZ_PREFIX = '@msdl_taharat_namaz_';

export interface DailyNamazRecord {
  date: string; // YYYY-MM-DD
  fajr: boolean;
  dhuhr: boolean;
  asr: boolean;
  maghrib: boolean;
  isha: boolean;
}

export type NamazPrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface TaharatStoragePayload {
  entries: CycleEntry[];
  habit: UserHabit;
  qadhaFastsTotal: number;
  qadhaFastsCompleted: number;
  hasPin: boolean;
  ghuslReminderEnabled: boolean;
}

export async function loadTaharatData(): Promise<TaharatStoragePayload> {
  try {
    const [entriesRaw, habitRaw, qadhaRaw, pinRaw, ghuslRaw] = await Promise.all([
      AsyncStorage.getItem(TAHARAT_DATA_STORAGE_KEY),
      AsyncStorage.getItem(TAHARAT_HABIT_STORAGE_KEY),
      AsyncStorage.getItem(TAHARAT_QADHA_STORAGE_KEY),
      AsyncStorage.getItem(TAHARAT_PIN_STORAGE_KEY),
      AsyncStorage.getItem(TAHARAT_GHUSL_REMINDER_KEY),
    ]);

    const entries: CycleEntry[] = entriesRaw ? JSON.parse(entriesRaw) : [];
    const habit: UserHabit = habitRaw ? JSON.parse(habitRaw) : { haizDays: 7, tuhrDays: 21, nifasDays: 40 };
    const qadha = qadhaRaw ? JSON.parse(qadhaRaw) : { total: 0, completed: 0 };
    const ghuslReminderEnabled = ghuslRaw !== null ? JSON.parse(ghuslRaw) : true; // default true

    return {
      entries: Array.isArray(entries) ? entries : [],
      habit,
      qadhaFastsTotal: qadha.total || 0,
      qadhaFastsCompleted: qadha.completed || 0,
      hasPin: !!pinRaw,
      ghuslReminderEnabled: !!ghuslReminderEnabled,
    };
  } catch (err) {
    console.warn('[TaharatStorage] Failed to load secure data:', err);
    return {
      entries: [],
      habit: { haizDays: 7, tuhrDays: 21, nifasDays: 40 },
      qadhaFastsTotal: 0,
      qadhaFastsCompleted: 0,
      hasPin: false,
      ghuslReminderEnabled: true,
    };
  }
}

export async function saveCycleEntry(entry: CycleEntry): Promise<CycleEntry[]> {
  const current = await loadTaharatData();
  const existingIdx = current.entries.findIndex((e) => e.id === entry.id);
  let updated: CycleEntry[];

  if (existingIdx >= 0) {
    updated = [...current.entries];
    updated[existingIdx] = entry;
  } else {
    updated = [entry, ...current.entries];
  }

  await AsyncStorage.setItem(TAHARAT_DATA_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function endActiveCycle(cycleId: string, endDateIso: string): Promise<CycleEntry[]> {
  const current = await loadTaharatData();
  const updated = current.entries.map((e) => {
    if (e.id === cycleId) {
      return { ...e, endDate: endDateIso };
    }
    return e;
  });

  await AsyncStorage.setItem(TAHARAT_DATA_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function deleteCycleEntry(id: string): Promise<CycleEntry[]> {
  const current = await loadTaharatData();
  const updated = current.entries.filter((e) => e.id !== id);
  await AsyncStorage.setItem(TAHARAT_DATA_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function saveTaharatHabit(habit: UserHabit): Promise<void> {
  await AsyncStorage.setItem(TAHARAT_HABIT_STORAGE_KEY, JSON.stringify(habit));
}

export async function updateQadhaFasts(total: number, completed: number): Promise<void> {
  await AsyncStorage.setItem(
    TAHARAT_QADHA_STORAGE_KEY,
    JSON.stringify({ total: Math.max(0, total), completed: Math.max(0, completed) })
  );
}

export async function verifyTaharatPin(pin: string): Promise<boolean> {
  const stored = await AsyncStorage.getItem(TAHARAT_PIN_STORAGE_KEY);
  if (!stored) return true; // no PIN set
  return stored === pin;
}

export async function setTaharatPin(pin: string | null): Promise<void> {
  if (!pin) {
    await AsyncStorage.removeItem(TAHARAT_PIN_STORAGE_KEY);
  } else {
    await AsyncStorage.setItem(TAHARAT_PIN_STORAGE_KEY, pin);
  }
}

export async function setGhuslReminderEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(TAHARAT_GHUSL_REMINDER_KEY, JSON.stringify(enabled));
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function loadTodayNamazRecord(dateStr?: string): Promise<DailyNamazRecord> {
  const targetDate = dateStr || getTodayDateString();
  const key = `${TAHARAT_NAMAZ_PREFIX}${targetDate}`;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[TaharatStorage] Error loading namaz record:', err);
  }
  return {
    date: targetDate,
    fajr: false,
    dhuhr: false,
    asr: false,
    maghrib: false,
    isha: false,
  };
}

export async function toggleNamazPrayer(
  prayer: NamazPrayerKey,
  dateStr?: string
): Promise<DailyNamazRecord> {
  const current = await loadTodayNamazRecord(dateStr);
  const updated: DailyNamazRecord = {
    ...current,
    [prayer]: !current[prayer],
  };
  const key = `${TAHARAT_NAMAZ_PREFIX}${updated.date}`;
  await AsyncStorage.setItem(key, JSON.stringify(updated));
  return updated;
}

