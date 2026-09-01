// ─────────────────────────────────────────────────────────────────────────────
// quranStorage.test.ts — Unit tests for Quran storage functions
// ─────────────────────────────────────────────────────────────────────────────

const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => { mockStore[key] = value; return Promise.resolve(); }),
  removeItem: jest.fn((key: string) => { delete mockStore[key]; return Promise.resolve(); }),
}));

import {
  saveLastRead,
  loadLastRead,
  loadBookmarks,
  addBookmark,
  removeBookmark,
  isBookmarked,
  loadKhatamProgress,
  incrementKhatamAyats,
  resetKhatam,
  loadHifzProgress,
  toggleParahHifz,
  toggleSurahHifz,
  loadShowRoman,
  saveShowRoman,
  loadFontSize,
  saveFontSize,
  DEFAULT_KHATAM,
} from './quranStorage';

beforeEach(() => {
  Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  jest.clearAllMocks();
});

describe('Last Read', () => {
  it('returns null when nothing saved', async () => {
    const result = await loadLastRead();
    expect(result).toBeNull();
  });

  it('saves and loads last read position', async () => {
    await saveLastRead({ surahNumber: 36, ayatNumber: 10, surahName: 'Ya-Sin', timestamp: 123456 });
    const result = await loadLastRead();
    expect(result?.surahNumber).toBe(36);
    expect(result?.ayatNumber).toBe(10);
    expect(result?.surahName).toBe('Ya-Sin');
  });
});

describe('Bookmarks', () => {
  it('starts with empty bookmarks', async () => {
    const bookmarks = await loadBookmarks();
    expect(bookmarks).toEqual([]);
  });

  it('adds a bookmark', async () => {
    await addBookmark({
      surahNumber: 2,
      ayatNumber: 255,
      surahName: 'Al-Baqarah',
      arabicText: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ',
      savedAt: Date.now(),
    });
    const bookmarks = await loadBookmarks();
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].surahNumber).toBe(2);
  });

  it('checks if an ayat is bookmarked', async () => {
    await addBookmark({ surahNumber: 1, ayatNumber: 1, surahName: 'Al-Fatihah', arabicText: 'بِسْمِ اللَّهِ', savedAt: Date.now() });
    expect(await isBookmarked(1, 1)).toBe(true);
    expect(await isBookmarked(1, 2)).toBe(false);
  });

  it('removes a bookmark', async () => {
    await addBookmark({ surahNumber: 1, ayatNumber: 1, surahName: 'Al-Fatihah', arabicText: 'test', savedAt: Date.now() });
    await removeBookmark(1, 1);
    expect(await isBookmarked(1, 1)).toBe(false);
  });

  it('does not duplicate bookmarks', async () => {
    const bm = { surahNumber: 1, ayatNumber: 1, surahName: 'Al-Fatihah', arabicText: 'test', savedAt: Date.now() };
    await addBookmark(bm);
    await addBookmark(bm);
    const bookmarks = await loadBookmarks();
    expect(bookmarks).toHaveLength(1);
  });
});

describe('Khatam Tracker', () => {
  it('loads default khatam when nothing saved', async () => {
    const khatam = await loadKhatamProgress();
    expect(khatam.ayatsRead).toBe(0);
    expect(khatam.totalAyat).toBe(6236);
    expect(khatam.completions).toBe(0);
  });

  it('increments ayats read', async () => {
    await incrementKhatamAyats(10);
    const khatam = await loadKhatamProgress();
    expect(khatam.ayatsRead).toBe(10);
  });

  it('counts completions when total exceeded', async () => {
    await incrementKhatamAyats(6236);
    const khatam = await loadKhatamProgress();
    expect(khatam.completions).toBe(1);
  });

  it('resets khatam progress', async () => {
    await incrementKhatamAyats(100);
    await resetKhatam();
    const khatam = await loadKhatamProgress();
    expect(khatam.ayatsRead).toBe(0);
  });
});

describe('Hifz Tracker', () => {
  it('loads empty hifz progress', async () => {
    const hifz = await loadHifzProgress();
    expect(hifz.completedParahs).toEqual([]);
    expect(hifz.completedSurahs).toEqual([]);
  });

  it('toggles a parah on and off', async () => {
    let hifz = await toggleParahHifz(30);
    expect(hifz.completedParahs).toContain(30);
    hifz = await toggleParahHifz(30);
    expect(hifz.completedParahs).not.toContain(30);
  });

  it('toggles a surah on and off', async () => {
    let hifz = await toggleSurahHifz(36);
    expect(hifz.completedSurahs).toContain(36);
    hifz = await toggleSurahHifz(36);
    expect(hifz.completedSurahs).not.toContain(36);
  });
});

describe('Display Preferences', () => {
  it('Roman show defaults to true', async () => {
    expect(await loadShowRoman()).toBe(true);
  });

  it('saves and loads Roman preference', async () => {
    await saveShowRoman(false);
    expect(await loadShowRoman()).toBe(false);
  });

  it('font size defaults to 22', async () => {
    expect(await loadFontSize()).toBe(22);
  });

  it('saves and loads font size', async () => {
    await saveFontSize(28);
    expect(await loadFontSize()).toBe(28);
  });
});
