import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MuhasabahHabit {
  id: string;
  labelEn: string;
  labelUr: string;
  category: 'Ibadah' | 'Character' | 'Quran';
}

export interface DailyMuhasabahLog {
  dateKey: string; // YYYY-MM-DD
  completedHabitIds: string[];
  reflectionNote: string;
  updatedAt: number;
}

export interface SadaqahEntry {
  id: string;
  amount: number;
  currency: string;
  recipientCategory: 'Poor & Needy' | 'Masjid / Madrasa' | 'Family / Neighbors' | 'Water / Relief' | 'General Sadaqah';
  intentionNote: string;
  dateIso: string;
}

export const MUHASABAH_HABITS: readonly MuhasabahHabit[] = [
  { id: 'fard_on_time', labelEn: 'All 5 Fard Prayers on Time', labelUr: 'پانچوں نمازیں وقت پر ادائیگی', category: 'Ibadah' },
  { id: 'daily_quran', labelEn: 'Daily Quran Tilawat (Even 1 Ruku)', labelUr: 'روزانہ تلاوتِ قرآن مجید', category: 'Quran' },
  { id: 'morning_evening_azkar', labelEn: 'Morning & Evening Masnoon Azkar', labelUr: 'صبح و شام کے مسنون اذکار', category: 'Ibadah' },
  { id: 'durood_istighfar', labelEn: 'Durood Shareef & 100x Istighfar', labelUr: 'درود شریف و استغفار کی کثرت', category: 'Ibadah' },
  { id: 'parents_kindness', labelEn: 'Respect Parents & Uplift Family', labelUr: 'والدین اور اہلِ خانہ سے حسنِ سلوک', category: 'Character' },
  { id: 'tongue_guard', labelEn: 'Protected Tongue from Ghibah & Anger', labelUr: 'زبان کی حفاظت (غیبت و غصے سے بچاؤ)', category: 'Character' },
  { id: 'sadaqah_or_smile', labelEn: 'Sadaqah, Help or Kind Word Given Today', labelUr: 'آج صدقہ یا کسی کی مدد و خیر خواہی', category: 'Character' },
  { id: 'night_muhasabah', labelEn: 'Repented & Forgave Before Sleeping', labelUr: 'سونے سے پہلے توبہ اور دل صاف کرنا', category: 'Character' },
];

const MUHASABAH_LOGS_KEY = '@suffah_muhasabah_logs_v1';
const SADAQAH_ENTRIES_KEY = '@suffah_sadaqah_journal_v1';

export function getTodayDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function loadAllMuhasabahLogs(): Promise<Record<string, DailyMuhasabahLog>> {
  try {
    const raw = await AsyncStorage.getItem(MUHASABAH_LOGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveDailyMuhasabahLog(log: DailyMuhasabahLog): Promise<Record<string, DailyMuhasabahLog>> {
  const all = await loadAllMuhasabahLogs();
  const next = { ...all, [log.dateKey]: log };
  try {
    await AsyncStorage.setItem(MUHASABAH_LOGS_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function calculateMuhasabahStreak(
  logs: Record<string, DailyMuhasabahLog>,
  referenceNow: Date = new Date()
): number {
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(referenceNow.getFullYear(), referenceNow.getMonth(), referenceNow.getDate() - i);
    const key = getTodayDateKey(d);
    const entry = logs[key];
    if (entry && entry.completedHabitIds.length > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

export async function loadSadaqahEntries(): Promise<SadaqahEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(SADAQAH_ENTRIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addSadaqahEntry(
  entry: Omit<SadaqahEntry, 'id' | 'dateIso'>
): Promise<SadaqahEntry[]> {
  const existing = await loadSadaqahEntries();
  const created: SadaqahEntry = {
    ...entry,
    id: `sad_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    dateIso: new Date().toISOString(),
  };
  const next = [created, ...existing];
  try {
    await AsyncStorage.setItem(SADAQAH_ENTRIES_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export async function deleteSadaqahEntry(id: string): Promise<SadaqahEntry[]> {
  const existing = await loadSadaqahEntries();
  const next = existing.filter((e) => e.id !== id);
  try {
    await AsyncStorage.setItem(SADAQAH_ENTRIES_KEY, JSON.stringify(next));
  } catch {}
  return next;
}
