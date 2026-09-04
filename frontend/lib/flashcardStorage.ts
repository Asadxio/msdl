import AsyncStorage from '@react-native-async-storage/async-storage';
import { ISLAMIC_FLASHCARDS, IslamicFlashcard } from '@/constants/flashcardData';

export const MASTERED_CARDS_STORAGE_KEY = '@msdl_mastered_flashcards';
export const SRS_RECORDS_STORAGE_KEY = '@msdl_srs_records';
export const CUSTOM_AI_CARDS_STORAGE_KEY = '@msdl_custom_ai_cards';

export interface CardSRSRecord {
  cardId: string;
  level: number; // 0: New, 1: Weak, 2: Learning, 3: Reviewing, 4: Mastered
  nextReviewMs: number;
  lastReviewedMs: number;
  reviewCount: number;
  correctCount: number;
}

// SRS Review intervals based on mastery level (Fibonacci-style spacing)
// Level 0 -> immediate (0 hours)
// Level 1 -> 4 hours
// Level 2 -> 24 hours (1 day)
// Level 3 -> 72 hours (3 days)
// Level 4 -> 168 hours (7 days)
const SRS_INTERVALS_HOURS = [0, 4, 24, 72, 168];

export async function loadCardSRSRecords(): Promise<Record<string, CardSRSRecord>> {
  try {
    const raw = await AsyncStorage.getItem(SRS_RECORDS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (err) {
    console.warn('[FlashcardStorage] Failed to load SRS records:', err);
    return {};
  }
}

export async function saveCardSRSRecords(records: Record<string, CardSRSRecord>): Promise<void> {
  try {
    await AsyncStorage.setItem(SRS_RECORDS_STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn('[FlashcardStorage] Failed to save SRS records:', err);
  }
}

export async function recordCardReview(
  cardId: string,
  result: 'know' | 'dont_know'
): Promise<{ record: CardSRSRecord; isMastered: boolean }> {
  const records = await loadCardSRSRecords();
  const existing = records[cardId] || {
    cardId,
    level: 0,
    nextReviewMs: 0,
    lastReviewedMs: 0,
    reviewCount: 0,
    correctCount: 0,
  };

  let newLevel = existing.level;
  let correctCount = existing.correctCount;

  if (result === 'know') {
    newLevel = Math.min(newLevel + 1, 4);
    correctCount += 1;
  } else {
    // If not known, demote card back to Weak / Level 1
    newLevel = Math.max(1, newLevel - 1);
  }

  const hoursToAdd = SRS_INTERVALS_HOURS[newLevel] || 4;
  const now = Date.now();
  const nextReviewMs = now + hoursToAdd * 60 * 60 * 1000;

  const updatedRecord: CardSRSRecord = {
    cardId,
    level: newLevel,
    nextReviewMs,
    lastReviewedMs: now,
    reviewCount: existing.reviewCount + 1,
    correctCount,
  };

  records[cardId] = updatedRecord;
  await saveCardSRSRecords(records);

  // Synchronize with mastered cards list if Level 4
  const currentMastered = await loadMasteredCardIds();
  const isNowMastered = newLevel >= 4;
  if (isNowMastered && !currentMastered.includes(cardId)) {
    await saveMasteredCardIds([...currentMastered, cardId]);
  } else if (!isNowMastered && currentMastered.includes(cardId)) {
    await saveMasteredCardIds(currentMastered.filter((id) => id !== cardId));
  }

  return { record: updatedRecord, isMastered: isNowMastered };
}

/**
 * 10.1 Sort cards using Spaced Repetition System (SRS) priority:
 * 1. Due cards (now >= nextReviewMs) and completely new cards (Level 0) appear first.
 * 2. Weakest cards (Level 1) appear next.
 * 3. Learning & reviewing cards (Level 2 & 3).
 * 4. Mastered cards (Level 4) appear at the end.
 */
export function sortCardsBySRS(
  cards: IslamicFlashcard[],
  srsRecords: Record<string, CardSRSRecord>
): IslamicFlashcard[] {
  const now = Date.now();

  return [...cards].sort((a, b) => {
    const recA = srsRecords[a.id];
    const recB = srsRecords[b.id];

    // Priority 1: Unseen/New cards
    if (!recA && recB) return -1;
    if (recA && !recB) return 1;
    if (!recA && !recB) return 0;

    // Priority 2: Due for review
    const aDue = recA.nextReviewMs <= now;
    const bDue = recB.nextReviewMs <= now;
    if (aDue && !bDue) return -1;
    if (!aDue && bDue) return 1;

    // Priority 3: Lower SRS Level first (weaker cards first)
    if (recA.level !== recB.level) {
      return recA.level - recB.level;
    }

    // Priority 4: Earlier review time
    return recA.nextReviewMs - recB.nextReviewMs;
  });
}

// 10.2 Custom AI Flashcard Decks Storage
export async function loadCustomAiFlashcards(): Promise<IslamicFlashcard[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_AI_CARDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[FlashcardStorage] Failed to load custom AI cards:', err);
    return [];
  }
}

export async function saveCustomAiFlashcards(cards: IslamicFlashcard[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CUSTOM_AI_CARDS_STORAGE_KEY, JSON.stringify(cards));
  } catch (err) {
    console.warn('[FlashcardStorage] Failed to save custom AI cards:', err);
  }
}

export async function addCustomAiFlashcards(newCards: IslamicFlashcard[]): Promise<IslamicFlashcard[]> {
  const existing = await loadCustomAiFlashcards();
  const combined = [...newCards, ...existing];
  await saveCustomAiFlashcards(combined);
  return combined;
}

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

  // Sync with SRS level (Level 4 if mastered, Level 1 if untoggled)
  const records = await loadCardSRSRecords();
  const existing = records[cardId];
  if (existing) {
    records[cardId] = {
      ...existing,
      level: !exists ? 4 : 1,
      nextReviewMs: !exists ? Date.now() + 168 * 3600000 : Date.now(),
    };
    await saveCardSRSRecords(records);
  }

  return {
    isMastered: !exists,
    totalMastered: updated.length,
  };
}

export function getFlashcardsByCategory(category: string, customCards: IslamicFlashcard[] = []): IslamicFlashcard[] {
  const allCards = [...customCards, ...ISLAMIC_FLASHCARDS];
  if (!category || category === 'all') {
    return allCards;
  }
  if (category === 'custom_ai') {
    return customCards;
  }
  return allCards.filter((c) => c.category === category);
}
