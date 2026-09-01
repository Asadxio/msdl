import AsyncStorage from '@react-native-async-storage/async-storage';
import { ISLAMIC_FLASHCARDS, IslamicFlashcard } from '@/constants/flashcardData';

export const MASTERED_CARDS_STORAGE_KEY = '@msdl_mastered_flashcards';

export async function loadMasteredCardIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(MASTERED_CARDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[FlashcardStorage] Failed to load mastered cards:', err);
    return [];
  }
}

export async function saveMasteredCardIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(MASTERED_CARDS_STORAGE_KEY, JSON.stringify(ids));
  } catch (err) {
    console.warn('[FlashcardStorage] Failed to save mastered cards:', err);
  }
}

export async function toggleCardMastery(cardId: string): Promise<{ isMastered: boolean; totalMastered: number }> {
  const current = await loadMasteredCardIds();
  const exists = current.includes(cardId);
  let updated: string[];

  if (exists) {
    updated = current.filter((id) => id !== cardId);
  } else {
    updated = [...current, cardId];
  }

  await saveMasteredCardIds(updated);
  return {
    isMastered: !exists,
    totalMastered: updated.length,
  };
}

export function getFlashcardsByCategory(category: string): IslamicFlashcard[] {
  if (!category || category === 'all') {
    return ISLAMIC_FLASHCARDS;
  }
  return ISLAMIC_FLASHCARDS.filter((c) => c.category === category);
}
