import AsyncStorage from '@react-native-async-storage/async-storage';
import { DUA_CATEGORIES, DUAS_COLLECTION } from '@/constants/duasData';
import { DuaBookmark, DuaCategory, DuaCategoryId, DuaEntry } from '@/types/islamic';

const DUA_BOOKMARKS_KEY = '@suffah_dua_bookmarks_v1';
const DUA_PROGRESS_PREFIX = '@suffah_dua_counter_';

/**
 * Fetch all authentic categories
 */
export function getDuaCategories(): DuaCategory[] {
  return DUA_CATEGORIES;
}

/**
 * Get category metadata by ID
 */
export function getDuaCategoryById(categoryId: DuaCategoryId): DuaCategory | undefined {
  return DUA_CATEGORIES.find((c) => c.id === categoryId);
}

/**
 * Fetch all Duas under a specific category
 */
export function getDuasByCategory(categoryId: DuaCategoryId): DuaEntry[] {
  return DUAS_COLLECTION.filter((d) => d.categoryId === categoryId);
}

/**
 * Fetch single Dua by ID
 */
export function getDuaById(id: string): DuaEntry | undefined {
  return DUAS_COLLECTION.find((d) => d.id === id);
}

/**
 * Search Duas by keyword across Urdu, English, Arabic, or Transliteration
 */
export function searchDuas(query: string): DuaEntry[] {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return [];

  return DUAS_COLLECTION.filter((d) => {
    return (
      d.titleEn.toLowerCase().includes(cleanQ) ||
      d.titleUr.includes(cleanQ) ||
      d.englishTranslation.toLowerCase().includes(cleanQ) ||
      d.urduTranslation.includes(cleanQ) ||
      d.arabicText.includes(cleanQ) ||
      d.transliteration.toLowerCase().includes(cleanQ) ||
      d.reference.toLowerCase().includes(cleanQ)
    );
  });
}

/**
 * Bookmarks Management
 */
export async function getDuaBookmarks(): Promise<DuaBookmark[]> {
  try {
    const raw = await AsyncStorage.getItem(DUA_BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function isDuaBookmarked(duaId: string): Promise<boolean> {
  const list = await getDuaBookmarks();
  return list.some((b) => b.duaId === duaId);
}

export async function toggleDuaBookmark(dua: DuaEntry): Promise<boolean> {
  const list = await getDuaBookmarks();
  const exists = list.some((b) => b.duaId === dua.id);
  let updated: DuaBookmark[];

  if (exists) {
    updated = list.filter((b) => b.duaId !== dua.id);
  } else {
    const newBm: DuaBookmark = {
      duaId: dua.id,
      categoryId: dua.categoryId,
      titleEn: dua.titleEn,
      titleUr: dua.titleUr,
      timestamp: Date.now(),
    };
    updated = [newBm, ...list];
  }

  await AsyncStorage.setItem(DUA_BOOKMARKS_KEY, JSON.stringify(updated));
  return !exists;
}

/**
 * Daily Repeat Counter Progress Tracking
 */
export async function getDuaCountProgress(duaId: string): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `${DUA_PROGRESS_PREFIX}${today}_${duaId}`;
    const raw = await AsyncStorage.getItem(key);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export async function incrementDuaCount(duaId: string, current: number, max: number): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `${DUA_PROGRESS_PREFIX}${today}_${duaId}`;
    const next = current >= max ? max : current + 1;
    await AsyncStorage.setItem(key, String(next));
    return next;
  } catch {
    return current + 1;
  }
}

export async function resetDuaCount(duaId: string): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `${DUA_PROGRESS_PREFIX}${today}_${duaId}`;
    await AsyncStorage.removeItem(key);
  } catch {}
}
