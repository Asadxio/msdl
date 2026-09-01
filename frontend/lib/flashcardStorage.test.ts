const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStore[key] || null),
  setItem: jest.fn(async (key: string, val: string) => {
    mockStore[key] = val;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStore[key];
  }),
  clear: jest.fn(async () => {
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  }),
}));

import {
  loadMasteredCardIds,
  toggleCardMastery,
  getFlashcardsByCategory,
  MASTERED_CARDS_STORAGE_KEY,
} from './flashcardStorage';
import { ISLAMIC_FLASHCARDS, FLASHCARD_CATEGORIES } from '../constants/flashcardData';

describe('Interactive Islamic Flashcards Storage & Logic', () => {
  it('loads valid curated flashcards across all 4 categories', () => {
    expect(ISLAMIC_FLASHCARDS.length).toBeGreaterThanOrEqual(10);
    expect(FLASHCARD_CATEGORIES.map((c) => c.id)).toEqual(['duas', 'hadith', 'fiqh', 'tajweed']);
  });

  it('filters flashcards accurately by category', () => {
    const duas = getFlashcardsByCategory('duas');
    expect(duas.length).toBeGreaterThan(0);
    duas.forEach((d) => expect(d.category).toBe('duas'));

    const hadith = getFlashcardsByCategory('hadith');
    expect(hadith.length).toBeGreaterThan(0);
    hadith.forEach((h) => expect(h.category).toBe('hadith'));

    const fiqh = getFlashcardsByCategory('fiqh');
    expect(fiqh.length).toBeGreaterThan(0);
    fiqh.forEach((f) => expect(f.category).toBe('fiqh'));

    const all = getFlashcardsByCategory('all');
    expect(all.length).toBe(ISLAMIC_FLASHCARDS.length);
  });

  it('toggles mastery status correctly and calculates total mastered', async () => {
    const initial = await loadMasteredCardIds();
    expect(Array.isArray(initial)).toBe(true);

    const toggleRes = await toggleCardMastery('dua_sleep');
    expect(toggleRes.isMastered).toBe(true);

    const after = await loadMasteredCardIds();
    expect(after).toContain('dua_sleep');

    // Untoggle
    const untoggleRes = await toggleCardMastery('dua_sleep');
    expect(untoggleRes.isMastered).toBe(false);
  });

  it('uses consistent AsyncStorage persistence key', () => {
    expect(MASTERED_CARDS_STORAGE_KEY).toBe('@msdl_mastered_flashcards');
  });
});
