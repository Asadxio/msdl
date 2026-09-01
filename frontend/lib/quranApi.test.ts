// ─────────────────────────────────────────────────────────────────────────────
// quranApi.test.ts — Tests for Quran API layer
// ─────────────────────────────────────────────────────────────────────────────

const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => { mockStore[key] = value; return Promise.resolve(); }),
  removeItem: jest.fn((key: string) => { delete mockStore[key]; return Promise.resolve(); }),
}));

// Mock fetch globally
global.fetch = jest.fn();

import { getTodayDailyAyat, getDailyAyat } from './quranApi';
import { QURAN_SURAHS, getSurahByNumber, searchSurahs, TOTAL_AYAT, TOTAL_SURAHS, TOTAL_PARAHS } from '../constants/quranSurahs';

beforeEach(() => {
  Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  jest.clearAllMocks();
});

describe('Quran Surahs Metadata', () => {
  it('has exactly 114 surahs', () => {
    expect(QURAN_SURAHS).toHaveLength(114);
    expect(TOTAL_SURAHS).toBe(114);
  });

  it('starts with Al-Fatihah and ends with An-Nas', () => {
    expect(QURAN_SURAHS[0].englishName).toBe('Al-Fatihah');
    expect(QURAN_SURAHS[113].englishName).toBe('An-Nas');
  });

  it('has correct total constants', () => {
    expect(TOTAL_AYAT).toBe(6236);
    expect(TOTAL_PARAHS).toBe(30);
  });

  it('can get surah by number', () => {
    const yaseen = getSurahByNumber(36);
    expect(yaseen?.englishName).toBe('Ya-Sin');
    expect(yaseen?.totalAyat).toBe(83);
    expect(yaseen?.type).toBe('Makki');
  });

  it('returns undefined for invalid surah number', () => {
    expect(getSurahByNumber(0)).toBeUndefined();
    expect(getSurahByNumber(115)).toBeUndefined();
  });

  it('can search surahs by English name', () => {
    const results = searchSurahs('rahman');
    expect(results.some((s) => s.englishName === 'Ar-Rahman')).toBe(true);
  });

  it('can search surahs by number', () => {
    const results = searchSurahs('36');
    expect(results.some((s) => s.number === 36)).toBe(true);
  });

  it('returns all surahs for empty search', () => {
    expect(searchSurahs('')).toHaveLength(114);
  });

  it('all surahs have valid parah (1-30)', () => {
    QURAN_SURAHS.forEach((s) => {
      expect(s.parah).toBeGreaterThanOrEqual(1);
      expect(s.parah).toBeLessThanOrEqual(30);
    });
  });

  it('all surahs have blogSlug', () => {
    QURAN_SURAHS.forEach((s) => {
      expect(s.blogSlug).toBeTruthy();
      expect(typeof s.blogSlug).toBe('string');
    });
  });
});

describe('Daily Ayat', () => {
  it('returns a valid ayat from pool', () => {
    const ayat = getTodayDailyAyat();
    expect(ayat).toBeDefined();
    expect(ayat.arabic).toBeTruthy();
    expect(ayat.roman).toBeTruthy();
    expect(ayat.urdu).toBeTruthy();
    expect(ayat.surah).toBeGreaterThan(0);
  });

  it('getDailyAyat returns cached data for same day', async () => {
    const ayat1 = await getDailyAyat();
    const ayat2 = await getDailyAyat();
    expect(ayat1.cachedDate).toBe(ayat2.cachedDate);
    expect(ayat1.arabic).toBe(ayat2.arabic);
  });

  it('daily ayat has all required fields', async () => {
    const ayat = await getDailyAyat();
    expect(ayat.surahNumber).toBeGreaterThan(0);
    expect(ayat.arabic).toBeTruthy();
    expect(ayat.roman).toBeTruthy();
    expect(ayat.urduMeaning).toBeTruthy();
    expect(ayat.cachedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
