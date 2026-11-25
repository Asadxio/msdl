jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() =>
        Promise.resolve({
          sound: {
            playAsync: jest.fn(),
            pauseAsync: jest.fn(),
            stopAsync: jest.fn(),
            unloadAsync: jest.fn(),
            setPositionAsync: jest.fn(),
            setRateAsync: jest.fn(),
            setIsLoopingAsync: jest.fn(),
            setOnPlaybackStatusUpdate: jest.fn(),
          },
          status: { isLoaded: true },
        })
      ),
    },
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import { searchHadiths, OFFLINE_SEED_HADITHS, HADITH_BOOKS } from './hadithService';
import { searchDuas, getDuaCategories } from './duasService';
import { searchNames, getNameById } from './asmaUlHusnaService';
import { getSalahSteps } from './salahGuideService';
import { getAzaanRecitations } from './azaanAudioService';

describe('Global Islamic Search Services Integration Tests', () => {
  describe('Hadith Search', () => {
    it('searches Hadith by hadith number', async () => {
      const results = await searchHadiths('1', 'bukhari');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].hadithNumber).toBe(1);
      expect(results[0].arabicText).toContain('الأَعْمَالُ بِالنِّيَّاتِ');
    });

    it('searches Hadith by English keyword "intentions"', async () => {
      const results = await searchHadiths('intentions');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((h) => h.englishText.toLowerCase().includes('intentions'))).toBe(true);
    });

    it('searches Hadith by Urdu keyword "نیت"', async () => {
      const results = await searchHadiths('نیت');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((h) => h.urduText.includes('نیت'))).toBe(true);
    });

    it('contains all 7 canonical Kutub as-Sittah collections in catalog', () => {
      expect(HADITH_BOOKS.length).toBe(7);
      const ids = HADITH_BOOKS.map((b) => b.id);
      expect(ids).toContain('bukhari');
      expect(ids).toContain('muslim');
      expect(ids).toContain('abudawud');
      expect(ids).toContain('tirmidhi');
      expect(ids).toContain('nasai');
      expect(ids).toContain('ibnmajah');
      expect(ids).toContain('malik');
    });
  });

  describe('Duas & Azkar Search', () => {
    it('returns matching Duas for morning azkar keyword', () => {
      const results = searchDuas('morning');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((d) => d.categoryId === 'morning' || d.titleEn.toLowerCase().includes('morning'))).toBe(true);
    });

    it('searches Duas by Arabic text snippet', () => {
      const results = searchDuas('أَصْبَحْنَا');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].arabicText).toContain('أَصْبَحْنَا');
    });

    it('searches Duas by reference (e.g. Bukhari or Muslim)', () => {
      const results = searchDuas('Bukhari');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((d) => d.reference.includes('Bukhari'))).toBe(true);
    });
  });

  describe('Asma-ul-Husna (99 Names of Allah) Search', () => {
    it('finds Name #1 Ar-Rahman by transliteration', () => {
      const results = searchNames('Ar-Rahman');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe(1);
      expect(results[0].arabic).toBe('الرَّحْمَنُ');
    });

    it('finds Name by Urdu meaning "نہایت مہربان"', () => {
      const results = searchNames('مہربان');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((n) => n.urduMeaning.includes('مہربان'))).toBe(true);
    });

    it('finds Name by ID string "99"', () => {
      const results = searchNames('99');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(99);
      expect(results[0].transliteration).toBe('As-Saboor');
    });
  });

  describe('Salah Guide & Audio Recitations', () => {
    it('returns complete step-by-step prayer guidance', () => {
      const steps = getSalahSteps();
      expect(steps.length).toBeGreaterThanOrEqual(10);
      expect(steps[0].stepNumber).toBe(1);
      expect(steps[0].stepNameEn).toBe('Takbir-e-Tahrima (Commencement)');
      expect(steps[0].posture).toBe('standing');
    });

    it('returns Azaan recitations from Islamic holy sanctuaries', () => {
      const azaans = getAzaanRecitations();
      expect(azaans.length).toBeGreaterThanOrEqual(4);
      const locations = azaans.map((a) => a.location);
      expect(locations.some((l) => l.includes('Makkah'))).toBe(true);
      expect(locations.some((l) => l.includes('Madinah'))).toBe(true);
    });
  });
});
