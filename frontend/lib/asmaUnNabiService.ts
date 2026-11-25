import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ASMA_UN_NABI,
  SEERAH_TIMELINE,
  type ProphetName,
  type SeerahMilestone,
} from '@/constants/asmaUnNabiData';

const PROPHET_FAV_KEY = '@suffah_asma_un_nabi_favs_v1';

export function getAllProphetNames(): ProphetName[] {
  return ASMA_UN_NABI;
}

export function getDailyProphetName(referenceDate: Date = new Date()): ProphetName {
  const start = new Date(referenceDate.getFullYear(), 0, 0);
  const diff = referenceDate.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const idx = Math.abs(dayOfYear) % ASMA_UN_NABI.length;
  return ASMA_UN_NABI[idx] || ASMA_UN_NABI[0];
}

export function searchProphetNames(query: string): ProphetName[] {
  const q = query.trim().toLowerCase();
  if (!q) return ASMA_UN_NABI;
  return ASMA_UN_NABI.filter(
    (n) =>
      String(n.id) === q ||
      n.transliteration.toLowerCase().includes(q) ||
      n.englishMeaning.toLowerCase().includes(q) ||
      n.urduMeaning.includes(query.trim()) ||
      n.arabic.includes(query.trim()) ||
      n.significance.toLowerCase().includes(q)
  );
}

export function getSeerahTimeline(eraFilter: 'All' | 'Makki' | 'Madani' = 'All'): SeerahMilestone[] {
  if (eraFilter === 'All') return SEERAH_TIMELINE;
  return SEERAH_TIMELINE.filter((m) => m.era === eraFilter);
}

export async function getProphetFavoriteIds(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(PROPHET_FAV_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function toggleProphetFavoriteId(id: number): Promise<number[]> {
  const current = await getProphetFavoriteIds();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  try {
    await AsyncStorage.setItem(PROPHET_FAV_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}
