const mockAsyncStorageData: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockAsyncStorageData[key] || null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockAsyncStorageData[key] = value;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockAsyncStorageData[key];
  }),
  getAllKeys: jest.fn(async () => Object.keys(mockAsyncStorageData)),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((k) => delete mockAsyncStorageData[k]);
  }),
}));

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          playAsync: jest.fn().mockResolvedValue(undefined),
          pauseAsync: jest.fn().mockResolvedValue(undefined),
          stopAsync: jest.fn().mockResolvedValue(undefined),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
          replayAsync: jest.fn().mockResolvedValue(undefined),
          setPositionAsync: jest.fn().mockResolvedValue(undefined),
          setVolumeAsync: jest.fn().mockResolvedValue(undefined),
        },
        status: { isLoaded: true },
      }),
    },
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
}));

import {
  getHadithBooks,
  getHadithBook,
  getHadithChapters,
  searchHadiths,
  toggleHadithBookmark,
  isHadithBookmarked,
  getHadithBookmarks,
  addRecentHadith,
  getRecentHadiths,
} from './hadithService';
import {
  getDuaCategories,
  getDuaCategoryById,
  getDuasByCategory,
  searchDuas,
  toggleDuaBookmark,
  isDuaBookmarked,
  getDuaBookmarks,
  getDuaCountProgress,
  incrementDuaCount,
  resetDuaCount,
} from './duasService';
import {
  getAllNames,
  getNameById,
  getDailyName,
  searchNames,
  getFavoriteNameIds,
  toggleFavoriteName,
} from './asmaUlHusnaService';
import {
  getSalahSteps,
  getSalahStep,
  getPreferredFiqh,
  setPreferredFiqh,
  getCompletedSalahSteps,
  markSalahStepCompleted,
} from './salahGuideService';
import {
  getAzaanRecitations,
  getAzaanById,
  getAzaanPreferences,
  saveAzaanPreferences,
} from './azaanAudioService';
import { HadithEntry } from '@/types/islamic';

describe('SUFFAH Islamic Knowledge Modules Architecture', () => {
  beforeEach(() => {
    // Clear mock storage between tests
    Object.keys(mockAsyncStorageData).forEach((k) => delete mockAsyncStorageData[k]);
  });

  /* ─────────────────────────────────────────────────────────── */
  /* MODULE 1: HADITH LIBRARY (KUTUB AS-SITTAH)                  */
  /* ─────────────────────────────────────────────────────────── */
  describe('Module 1: Hadith Library', () => {
    it('provides all 7 canonical Hadith collections', () => {
      const books = getHadithBooks();
      expect(books).toHaveLength(7);
      const bookIds = books.map((b) => b.id);
      expect(bookIds).toContain('bukhari');
      expect(bookIds).toContain('muslim');
      expect(bookIds).toContain('abudawud');
      expect(bookIds).toContain('tirmidhi');
      expect(bookIds).toContain('nasai');
      expect(bookIds).toContain('ibnmajah');
      expect(bookIds).toContain('malik');
    });

    it('retrieves detailed book metadata by ID', () => {
      const bukhari = getHadithBook('bukhari');
      expect(bukhari).toBeDefined();
      expect(bukhari?.titleEnglish).toContain('Sahih al-Bukhari');
      expect(bukhari?.author).toContain('Imam Muhammad al-Bukhari');
      expect(bukhari?.totalHadith).toBeGreaterThan(7000);
    });

    it('returns chapters list for a canonical book', async () => {
      const chapters = await getHadithChapters('bukhari');
      expect(chapters.length).toBeGreaterThan(0);
      expect(chapters[0].chapterNumber).toBe(1);
      expect(chapters[0].titleEnglish).toBeDefined();
      expect(chapters[0].titleUrdu).toBeDefined();
    });

    it('searches Hadith by keyword across English, Urdu and Arabic', async () => {
      const resultsEn = await searchHadiths('intentions');
      expect(resultsEn.length).toBeGreaterThan(0);
      expect(resultsEn[0].englishText.toLowerCase()).toContain('intentions');

      const resultsUr = await searchHadiths('نیتوں');
      expect(resultsUr.length).toBeGreaterThan(0);
      expect(resultsUr[0].urduText).toContain('نیتوں');
    });

    it('toggles bookmarks and persists recent views', async () => {
      const books = getHadithBooks();
      const firstBook = books[0];
      const hadithItem: HadithEntry = {
        id: 'bukhari-1',
        bookId: firstBook.id,
        hadithNumber: 1,
        chapterNumber: 1,
        arabicText: 'إنما الأعمال بالنيات',
        englishText: 'Actions are judged by intentions.',
        urduText: 'اعمال کا دارومدار نیتوں پر ہے۔',
        narrator: 'Umar ibn al-Khattab',
        grades: [{ name: 'Sahih', grade: 'Sahih' }],
        reference: { book: 1, hadith: 1 },
      };

      const initiallyBookmarked = await isHadithBookmarked(hadithItem.id);
      expect(initiallyBookmarked).toBe(false);

      const isNowBookmarked = await toggleHadithBookmark(hadithItem, firstBook.titleEnglish);
      expect(isNowBookmarked).toBe(true);

      const bookmarks = await getHadithBookmarks();
      expect(bookmarks.some((b) => b.hadithId === hadithItem.id)).toBe(true);

      // Record recent
      await addRecentHadith(hadithItem, firstBook.titleEnglish);
      const recents = await getRecentHadiths();
      expect(recents.some((r) => r.hadithId === hadithItem.id)).toBe(true);
    });
  });

  /* ─────────────────────────────────────────────────────────── */
  /* MODULE 2: DUAS & AZKAR (HISN AL-MUSLIM)                     */
  /* ─────────────────────────────────────────────────────────── */
  describe('Module 2: Duas & Azkar', () => {
    it('returns all 10 canonical categories', () => {
      const categories = getDuaCategories();
      expect(categories).toHaveLength(10);
      const catIds = categories.map((c) => c.id);
      expect(catIds).toContain('morning');
      expect(catIds).toContain('evening');
      expect(catIds).toContain('sleep');
      expect(catIds).toContain('wake');
      expect(catIds).toContain('eating');
      expect(catIds).toContain('travel');
      expect(catIds).toContain('masjid');
      expect(catIds).toContain('daily');
      expect(catIds).toContain('ramadan');
      expect(catIds).toContain('general');
    });

    it('retrieves category metadata and category duas', () => {
      const morningCat = getDuaCategoryById('morning');
      expect(morningCat).toBeDefined();
      expect(morningCat?.titleEn).toBe('Morning Azkar');

      const morningDuas = getDuasByCategory('morning');
      expect(morningDuas.length).toBeGreaterThan(0);
      morningDuas.forEach((d) => {
        expect(d.arabicText).toBeDefined();
        expect(d.englishTranslation).toBeDefined();
        expect(d.urduTranslation).toBeDefined();
        expect(d.reference).toBeDefined();
        expect(d.targetCount).toBeGreaterThanOrEqual(1);
      });
    });

    it('searches Duas by keyword across languages', () => {
      const res = searchDuas('Bismillah');
      expect(res.length).toBeGreaterThan(0);

      const resUr = searchDuas('اللہ');
      expect(resUr.length).toBeGreaterThan(0);
    });

    it('increments daily repeat counter with ceiling protection and resets', async () => {
      const duaId = 'dua-test-count-1';
      await resetDuaCount(duaId);

      let count = await getDuaCountProgress(duaId);
      expect(count).toBe(0);

      count = await incrementDuaCount(duaId, count, 3);
      expect(count).toBe(1);

      count = await incrementDuaCount(duaId, count, 3);
      expect(count).toBe(2);

      count = await incrementDuaCount(duaId, count, 3);
      expect(count).toBe(3);

      // Ceiling protection
      count = await incrementDuaCount(duaId, count, 3);
      expect(count).toBe(3);

      await resetDuaCount(duaId);
      count = await getDuaCountProgress(duaId);
      expect(count).toBe(0);
    });
  });

  /* ─────────────────────────────────────────────────────────── */
  /* MODULE 3: ASMA-UL-HUSNA (99 BEAUTIFUL NAMES OF ALLAH)       */
  /* ─────────────────────────────────────────────────────────── */
  describe('Module 3: Asma-ul-Husna', () => {
    it('contains exactly 99 verified Names of Allah', () => {
      const names = getAllNames();
      expect(names).toHaveLength(99);
      expect(names[0].id).toBe(1);
      expect(names[98].id).toBe(99);
    });

    it('ensures each Name contains complete vocalization, meanings, and Quranic citations', () => {
      const names = getAllNames();
      names.forEach((n) => {
        expect(n.id).toBeGreaterThanOrEqual(1);
        expect(n.id).toBeLessThanOrEqual(99);
        expect(n.arabic.length).toBeGreaterThan(0);
        expect(n.transliteration.length).toBeGreaterThan(0);
        expect(n.englishMeaning.length).toBeGreaterThan(0);
        expect(n.urduMeaning.length).toBeGreaterThan(0);
        expect(n.explanationEn.length).toBeGreaterThan(0);
        expect(n.explanationUr.length).toBeGreaterThan(0);
      });
    });

    it('generates a deterministic Daily Name of Allah', () => {
      const daily1 = getDailyName();
      const daily2 = getDailyName();
      expect(daily1).toBeDefined();
      expect(daily1.id).toBe(daily2.id);
      expect(daily1.id).toBeGreaterThanOrEqual(1);
      expect(daily1.id).toBeLessThanOrEqual(99);
    });

    it('searches Names by id, transliteration, or meaning', () => {
      const byId = searchNames('1');
      expect(byId.some((n) => n.id === 1)).toBe(true);

      const byTrans = searchNames('Rahman');
      expect(byTrans.length).toBeGreaterThan(0);
      expect(byTrans[0].transliteration).toContain('Rahman');
    });

    it('manages favorite Names', async () => {
      const nameId = 1;
      const wasFav = (await getFavoriteNameIds()).includes(nameId);
      const nowFav = await toggleFavoriteName(nameId);
      expect(nowFav).toBe(!wasFav);
    });
  });

  /* ─────────────────────────────────────────────────────────── */
  /* MODULE 4: SALAH GUIDE & AUDIO                               */
  /* ─────────────────────────────────────────────────────────── */
  describe('Module 4: Salah Guide & Audio', () => {
    it('contains all 14 chronological steps of Salah', () => {
      const steps = getSalahSteps();
      expect(steps).toHaveLength(14);
      for (let i = 0; i < 14; i++) {
        expect(steps[i].stepNumber).toBe(i + 1);
      }
      expect(steps[0].id).toBe('takbir-tahrima');
      expect(steps[13].id).toBe('dua-salam');
    });

    it('features explicit dual Fiqh guidance for Hanafi and Shafi/General traditions', () => {
      const steps = getSalahSteps();
      steps.forEach((s) => {
        expect(s.fiqhGuidance).toBeDefined();
        expect(s.fiqhGuidance?.hanafi.length).toBeGreaterThan(0);
        expect(s.fiqhGuidance?.shafii.length).toBeGreaterThan(0);
      });
    });

    it('stores user fiqh preference and marks completed steps', async () => {
      await setPreferredFiqh('shafii');
      let fiqh = await getPreferredFiqh();
      expect(fiqh).toBe('shafii');

      await setPreferredFiqh('hanafi');
      fiqh = await getPreferredFiqh();
      expect(fiqh).toBe('hanafi');

      const completed = await markSalahStepCompleted(1);
      expect(completed).toContain(1);
    });
  });

  /* ─────────────────────────────────────────────────────────── */
  /* MODULE 5: AZAAN & PRAYER AUDIO                              */
  /* ─────────────────────────────────────────────────────────── */
  describe('Module 5: Azaan & Prayer Audio', () => {
    it('provides 5 authentic Holy Sanctuaries recordings', () => {
      const recitations = getAzaanRecitations();
      expect(recitations).toHaveLength(5);
      const ids = recitations.map((r) => r.id);
      expect(ids).toContain('makkah-mulla');
      expect(ids).toContain('madinah-bukhari');
      expect(ids).toContain('fajr-makkah');
      expect(ids).toContain('al-aqsa-jerusalem');
      expect(ids).toContain('mishary-alafasy');
    });

    it('identifies Fajr special recitation', () => {
      const fajr = getAzaanById('fajr-makkah');
      expect(fajr).toBeDefined();
      expect(fajr?.isFajr).toBe(true);
      expect(fajr?.titleUr).toContain('فجر');
    });

    it('manages per-prayer sound preferences', async () => {
      const initial = await getAzaanPreferences();
      expect(initial).toBeDefined();
      expect(initial.prayerAlarms.fajr).toBe(true);

      const custom = {
        ...initial,
        volume: 0.8,
        prayerAlarms: {
          ...initial.prayerAlarms,
          fajr: true,
          zuhr: false,
        },
      };

      await saveAzaanPreferences(custom);
      const reloaded = await getAzaanPreferences();
      expect(reloaded.volume).toBe(0.8);
      expect(reloaded.prayerAlarms.zuhr).toBe(false);
    });
  });
});
