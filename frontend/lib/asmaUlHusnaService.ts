import AsyncStorage from '@react-native-async-storage/async-storage';
import { ASMA_UL_HUSNA } from '@/constants/asmaUlHusnaData';
import { AllahName } from '@/types/islamic';

const ASMA_FAVORITES_KEY = '@suffah_asma_favorites_v1';

/**
 * Return all 99 Names of Allah
 */
export function getAllNames(): AllahName[] {
  return ASMA_UL_HUSNA;
}

/**
 * Get Name by ID (1 to 99)
 */
export function getNameById(id: number): AllahName | undefined {
  return ASMA_UL_HUSNA.find((n) => n.id === id);
}

/**
 * Deterministic Daily Name of Allah
 * Changes daily at midnight based on day of year
 */
export function getDailyName(): AllahName {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const index = (dayOfYear % 99);
  return ASMA_UL_HUSNA[index] || ASMA_UL_HUSNA[0];
}

/**
 * Search Names across Arabic, transliteration, English, Urdu, or ID
 */
export function searchNames(query: string): AllahName[] {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return ASMA_UL_HUSNA;

  return ASMA_UL_HUSNA.filter((n) => {
    return (
      String(n.id) === cleanQ ||
      n.transliteration.toLowerCase().includes(cleanQ) ||
      n.englishMeaning.toLowerCase().includes(cleanQ) ||
      n.urduMeaning.includes(cleanQ) ||
      n.arabic.includes(cleanQ) ||
      n.explanationEn.toLowerCase().includes(cleanQ) ||
      n.explanationUr.includes(cleanQ)
    );
  });
}

/**
 * Favorites Management
 */
export async function getFavoriteNameIds(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(ASMA_FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function isNameFavorite(nameId: number): Promise<boolean> {
  const favs = await getFavoriteNameIds();
  return favs.includes(nameId);
}

export async function toggleFavoriteName(nameId: number): Promise<boolean> {
  const favs = await getFavoriteNameIds();
  const exists = favs.includes(nameId);
  const updated = exists ? favs.filter((id) => id !== nameId) : [...favs, nameId];
  await AsyncStorage.setItem(ASMA_FAVORITES_KEY, JSON.stringify(updated));
  return !exists;
}
