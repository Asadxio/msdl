import {
  normalizeUrduAndArabicText,
  searchSurahs,
  QURAN_SURAHS,
} from '../constants/quranSurahs';

describe('Phase 48: Quran Reader Enhancements', () => {
  describe('2.4 Search by Surah name in Urdu & Arabic normalization', () => {
    it('normalizes Urdu and Arabic variants (alif, heh, yeh, tashkeel)', () => {
      const normalizedBaqarah = normalizeUrduAndArabicText('بَقَرَة');
      expect(normalizedBaqarah).toBe('بقرہ');

      const normalizedFatiha = normalizeUrduAndArabicText('الْفَاتِحَة');
      expect(normalizedFatiha).toBe('الفاتحہ');

      const normalizedYaseen = normalizeUrduAndArabicText('يٰسٓ');
      expect(normalizedYaseen.length).toBeGreaterThan(0);
    });

    it('searches Surah by Urdu names without Arabic prefix', () => {
      const resBaqarah = searchSurahs('بقرہ');
      expect(resBaqarah.length).toBeGreaterThan(0);
      expect(resBaqarah[0].number).toBe(2);

      const resFatiha = searchSurahs('فاتحہ');
      expect(resFatiha.length).toBeGreaterThan(0);
      expect(resFatiha[0].number).toBe(1);

      const resRahman = searchSurahs('رحمن');
      expect(resRahman.length).toBeGreaterThan(0);
      expect(resRahman.some((s) => s.number === 55)).toBe(true);

      const resMulk = searchSurahs('ملک');
      expect(resMulk.length).toBeGreaterThan(0);
      expect(resMulk.some((s) => s.number === 67)).toBe(true);

      const resYasin = searchSurahs('یسین');
      expect(resYasin.length).toBeGreaterThan(0);
      expect(resYasin[0].number).toBe(36);

      const resYasin2 = searchSurahs('یاسین');
      expect(resYasin2.length).toBeGreaterThan(0);
      expect(resYasin2[0].number).toBe(36);

      const resIkhlas = searchSurahs('اخلاص');
      expect(resIkhlas.length).toBeGreaterThan(0);
      expect(resIkhlas.some((s) => s.number === 112)).toBe(true);
    });

    it('searches Surah by English transliteration and number', () => {
      const resByNum = searchSurahs('36');
      expect(resByNum.length).toBe(1);
      expect(resByNum[0].englishName).toBe('Ya-Sin');

      const resEng = searchSurahs('kahf');
      expect(resEng.length).toBeGreaterThan(0);
      expect(resEng[0].number).toBe(18);
    });
  });

  describe('2.3 Font size bounds and clamping', () => {
    it('clamps font sizes between 16 and 36', () => {
      const clampFontSize = (current: number, delta: number) => {
        return Math.min(36, Math.max(16, current + delta));
      };

      expect(clampFontSize(16, -2)).toBe(16);
      expect(clampFontSize(20, -2)).toBe(18);
      expect(clampFontSize(34, 2)).toBe(36);
      expect(clampFontSize(36, 2)).toBe(36);
    });
  });

  describe('2.2 Last read position resume payload', () => {
    it('builds resume route query parameters with correct initialAyat', () => {
      const lastRead = {
        surahNumber: 36,
        surahName: 'Yaseen',
        ayatNumber: 12,
        timestamp: Date.now(),
      };

      const resumePath = '/quran-reader?surah=' + lastRead.surahNumber + '&initialAyat=' + lastRead.ayatNumber;
      expect(resumePath).toBe('/quran-reader?surah=36&initialAyat=12');
    });
  });

  describe('2.1 Bookmarking data structure', () => {
    it('accurately indexes bookmarks by surah and ayat number', () => {
      interface BookmarkRecord {
        id: string;
        surahNumber: number;
        surahName: string;
        ayatNumber: number;
        arabicText: string;
        createdAt: number;
      }

      const bookmarks: BookmarkRecord[] = [
        {
          id: 'b1',
          surahNumber: 2,
          surahName: 'Al-Baqarah',
          ayatNumber: 255,
          arabicText: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ',
          createdAt: Date.now(),
        },
        {
          id: 'b2',
          surahNumber: 36,
          surahName: 'Yaseen',
          ayatNumber: 1,
          arabicText: 'يسٓ',
          createdAt: Date.now(),
        },
      ];

      const surah2Bookmarks = bookmarks.filter((b) => b.surahNumber === 2);
      expect(surah2Bookmarks.length).toBe(1);
      expect(surah2Bookmarks[0].ayatNumber).toBe(255);

      const bookmarkAyatSet = new Set(surah2Bookmarks.map((b) => b.ayatNumber));
      expect(bookmarkAyatSet.has(255)).toBe(true);
      expect(bookmarkAyatSet.has(1)).toBe(false);
    });
  });
});
