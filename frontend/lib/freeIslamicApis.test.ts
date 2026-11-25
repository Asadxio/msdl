const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage[key] || null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStorage[key];
  }),
}));

import {
  TAFSIR_EDITIONS,
  CURATED_QARIS,
  fetchAyatTafsir,
  fetchAllQaris,
  fetchAyahTimings,
  fetchIslamicRadios,
  findActiveAyatFromPosition,
  getQariAyatAudioUrl,
  getQariFullSurahAudioUrl,
  stripHtmlTags,
} from './quranExtrasService';
import { convertTroyOunceToPerGram, fetchLiveMetalPrices } from './zakatService';
import {
  getAdjustedDateForMoonOffset,
  loadMoonSightingOffset,
  saveMoonSightingOffset,
  syncHijriWithAlAdhan,
  fetchAlAdhanGregorianForHijri,
} from './islamicCalendarService';
import { fetchAlAdhanPrayerTimes } from './prayerTimes';
import {
  HADITH_BOOKS,
  EXTENDED_HADITH_BOOKS,
  getHadithBook,
  getHadithChapters,
  getHadiths,
} from './hadithService';
import {
  calculateDistanceKm,
  calculateBearingDeg,
  formatCompassDirection,
  buildDirectionsUrl,
  parseOverpassElements,
  fetchNearbyMasjids,
} from './masjidFinderService';

describe('Free Keyless Islamic & Utility APIs Integration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('1 & 2. Quran Tafsir, Multi-Qari, Ayah Timing Sync & Live Radio', () => {
    it('strips HTML tags cleanly and lists Urdu, English, and Arabic Tafsir editions', () => {
      expect(stripHtmlTags('<p>Verse meaning<br/>second line &amp; clarity</p>')).toBe(
        'Verse meaning\nsecond line & clarity'
      );
      expect(TAFSIR_EDITIONS.some((e) => e.slug === 'ur-tafseer-ibn-e-kaseer')).toBe(true);
      expect(TAFSIR_EDITIONS.some((e) => e.slug === 'en-tafisr-ibn-kathir')).toBe(true);
      expect(TAFSIR_EDITIONS.some((e) => e.slug === 'ar-tafsir-ibn-kathir')).toBe(true);
    });

    it('fetches per-ayat Tafsir from spa5k/tafsir_api and falls back to quran.com API v4', async () => {
      global.fetch = jest.fn(async (url: any) => {
        if (String(url).includes('cdn.jsdelivr.net/gh/spa5k/tafsir_api')) {
          return { ok: true, json: async () => ({ text: '<p>Tafsir text sample.</p>' }) } as any;
        }
        return { ok: false, status: 404 } as any;
      }) as any;

      const primary = await fetchAyatTafsir(1, 1, 'en-tafisr-ibn-kathir');
      expect(primary.source).toBe('tafsir_api');
      expect(primary.text).toBe('Tafsir text sample.');

      // Subsequent request for a new ayah where primary fails -> falls back to api.quran.com
      global.fetch = jest.fn(async (url: any) => {
        if (String(url).includes('cdn.jsdelivr.net/gh/spa5k/tafsir_api')) {
          return { ok: false, status: 503 } as any;
        }
        return {
          ok: true,
          json: async () => ({ tafsir: { text: '<p>Fallback Ibn Kathir</p>' } }),
        } as any;
      }) as any;

      const fallback = await fetchAyatTafsir(1, 2, 'en-tafisr-ibn-kathir');
      expect(fallback.source).toBe('quran_com');
      expect(fallback.text).toBe('Fallback Ibn Kathir');
    });

    it('resolves active Ayat from playback timestamp timings and builds Qari URLs', async () => {
      const alafasy = CURATED_QARIS[0];
      expect(getQariAyatAudioUrl(alafasy, 2, 255)).toBe(
        'https://everyayah.com/data/Alafasy_128kbps/002255.mp3'
      );
      expect(getQariFullSurahAudioUrl(alafasy, 36)).toBe(
        'https://cdn.mp3quran.net/audio/mishary-alafasy/r1/036.mp3'
      );

      global.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => [
          { ayah: 1, start_time: 0, end_time: 5200 },
          { ayah: 2, start_time: 5200, end_time: 12100 },
        ],
      })) as any;

      const timings = await fetchAyahTimings(1, 123);
      expect(timings).toHaveLength(2);
      expect(findActiveAyatFromPosition(timings, 6500)).toBe(2);
    });

    it('merges MP3Quran reciters and radio stations cleanly', async () => {
      global.fetch = jest.fn(async (url: any) => {
        if (String(url).includes('/reciters')) {
          return {
            ok: true,
            json: async () => ({
              reciters: [
                {
                  id: 999,
                  name: 'Test Global Qari',
                  moshaf: [{ id: 1, name: 'Hafs', server: 'https://server.example/q/', surah_total: 114 }],
                },
              ],
            }),
          } as any;
        }
        return {
          ok: true,
          json: async () => ({
            radios: [{ id: 77, name: 'Makkah Urdu Channel', url: 'https://radio.example/urdu' }],
          }),
        } as any;
      }) as any;

      const qaris = await fetchAllQaris();
      expect(qaris.some((q) => q.nameEn === 'Test Global Qari')).toBe(true);

      const radios = await fetchIslamicRadios();
      expect(radios.some((r) => r.name === 'Makkah Urdu Channel' && r.category === 'Translation & Urdu')).toBe(
        true
      );
    });
  });

  describe('3. Live Gold & Silver Prices (Zakat)', () => {
    it('accurately converts troy ounce prices into per-gram prices and fetches currency-api rates', async () => {
      expect(convertTroyOunceToPerGram(311.034768)).toBe(10);

      global.fetch = jest.fn(async (url: any) => {
        if (String(url).includes('/xau.json')) {
          return { ok: true, json: async () => ({ date: '2026-11-26', xau: { inr: 311034.768 } }) } as any;
        }
        return { ok: true, json: async () => ({ date: '2026-11-26', xag: { inr: 3732.417216 } }) } as any;
      }) as any;

      const prices = await fetchLiveMetalPrices('INR');
      expect(prices.currency).toBe('INR');
      expect(prices.goldPerGram).toBe(10000);
      expect(prices.silverPerGram).toBe(120);
    });

    it('falls back to gold-api.com USD spot + FX rate when currency-api XAU fails', async () => {
      global.fetch = jest.fn(async (url: any) => {
        const u = String(url);
        if (u.includes('xau.json') || u.includes('xag.json')) {
          return { ok: false, status: 500 } as any;
        }
        if (u.includes('price/XAU')) {
          return { ok: true, json: async () => ({ price: 3110.34768, updatedAt: '2026-11-26T00:00:00Z' }) } as any;
        }
        if (u.includes('price/XAG')) {
          return { ok: true, json: async () => ({ price: 31.1034768 }) } as any;
        }
        return { ok: true, json: async () => ({ usd: { pkr: 280 } }) } as any;
      }) as any;

      const prices = await fetchLiveMetalPrices('PKR');
      expect(prices.goldPerGram).toBe(28000);
      expect(prices.silverPerGram).toBe(280);
    });
  });

  describe('4. AlAdhan Hijri, Prayer Verification & Moon Sighting Offset', () => {
    it('shifts dates by moon sighting offset and persists preference', async () => {
      const base = new Date(2026, 10, 26, 12, 0, 0);
      expect(getAdjustedDateForMoonOffset(base, 1).getDate()).toBe(27);
      expect(getAdjustedDateForMoonOffset(base, -1).getDate()).toBe(25);

      await saveMoonSightingOffset(-1);
      expect(await loadMoonSightingOffset()).toBe(-1);
    });

    it('syncs Hijri date via AlAdhan gToH & hToG and verifies prayer timings', async () => {
      global.fetch = jest.fn(async (url: any) => {
        const u = String(url);
        if (u.includes('/gToH')) {
          return {
            ok: true,
            json: async () => ({
              data: {
                hijri: {
                  day: '16',
                  month: { number: 6, en: 'Jumada al-Akhirah', ar: 'جمادى الآخرة' },
                  year: '1448',
                  method: 'HJCoSA',
                },
              },
            }),
          } as any;
        }
        if (u.includes('/hToG')) {
          return {
            ok: true,
            json: async () => ({
              data: { gregorian: { day: '08', month: { en: 'February' }, year: '2027' } },
            }),
          } as any;
        }
        return {
          ok: true,
          json: async () => ({
            data: {
              timings: {
                Fajr: '05:35 (+05:30)',
                Sunrise: '06:52',
                Dhuhr: '12:26',
                Asr: '16:24',
                Maghrib: '17:59',
                Isha: '19:16',
              },
              date: { hijri: { day: '16', month: { en: 'Jumada al-Akhirah' }, year: '1448' } },
              meta: { method: { name: 'Karachi' } },
            },
          }),
        } as any;
      }) as any;

      const hijriSync = await syncHijriWithAlAdhan(new Date(2026, 10, 26));
      expect(hijriSync.day).toBe(16);
      expect(hijriSync.year).toBe(1448);

      const hToG = await fetchAlAdhanGregorianForHijri(1448, 9, 1);
      expect(hToG).toBe('08 February 2027');

      const timings = await fetchAlAdhanPrayerTimes({
        latitude: 19.076,
        longitude: 72.8777,
        method: 'karachi',
        asrFactor: 2,
      });
      expect(timings.fajr).toBe('05:35');
      expect(timings.asr).toBe('16:24');
    });
  });

  describe('5. Extended 40 Hadith Collections (Nawawi, Qudsi, Dehlawi)', () => {
    it('keeps 7 Kutub as-Sittah canonical books while adding 3 curated 40 Hadith collections', async () => {
      expect(HADITH_BOOKS).toHaveLength(7);
      expect(EXTENDED_HADITH_BOOKS).toHaveLength(3);
      expect(getHadithBook('qudsi')?.titleEnglish).toContain('Qudsi');
      expect((await getHadithChapters('dehlawi'))[0].chapterNumber).toBe(1);

      global.fetch = jest.fn(async (url: any) => {
        const u = String(url);
        if (u.includes('ara-nawawi.json')) {
          return {
            ok: true,
            json: async () => ({
              metadata: { name: '40 Hadith an-Nawawi' },
              hadiths: [{ hadithnumber: 1, arabicnumber: 1, text: 'إنما الأعمال بالنيات' }],
            }),
          } as any;
        }
        return {
          ok: true,
          json: async () => ({
            hadiths: [{ hadithnumber: 1, text: 'Actions are judged by intentions.' }],
          }),
        } as any;
      }) as any;

      const res = await getHadiths('nawawi', 1, 1, 10);
      expect(res.total).toBe(1);
      expect(res.hadiths[0].englishText).toContain('intentions');
    });
  });

  describe('6. Nearby Masjids Finder (OpenStreetMap Overpass & Nominatim)', () => {
    it('computes Haversine distance, bearing, compass labels and Google Maps directions URLs', () => {
      const dist = calculateDistanceKm(19.076, 72.8777, 19.085, 72.8777);
      expect(dist).toBeGreaterThan(0.9);
      expect(dist).toBeLessThan(1.1);

      const bearing = calculateBearingDeg(19.076, 72.8777, 19.085, 72.8777);
      expect(formatCompassDirection(bearing)).toBe('N');
      expect(buildDirectionsUrl(19.076, 72.8777, 'Jama Masjid')).toContain(
        'destination=19.076,72.8777'
      );
    });

    it('parses Overpass elements sorted closest-first and falls back to Nominatim cleanly', async () => {
      const parsed = parseOverpassElements(
        [
          { type: 'node', id: 2, lat: 19.09, lon: 72.8777, tags: { name: 'Far Masjid' } },
          {
            type: 'way',
            id: 1,
            center: { lat: 19.077, lon: 72.8777 },
            tags: { name: 'Near Masjid', 'addr:street': 'Main Rd' },
          },
        ],
        19.076,
        72.8777
      );
      expect(parsed[0].name).toBe('Near Masjid');
      expect(parsed[0].address).toBe('Main Rd');

      // Simulate Overpass failure -> Nominatim fallback
      global.fetch = jest.fn(async (url: any) => {
        if (String(url).includes('nominatim.openstreetmap.org')) {
          return {
            ok: true,
            json: async () => [
              { place_id: 50, name: 'Nom Masjid', display_name: 'Nom Masjid, Area', lat: '19.078', lon: '72.878' },
            ],
          } as any;
        }
        return { ok: false, status: 502 } as any;
      }) as any;

      const fallbackList = await fetchNearbyMasjids(19.076, 72.8777, 5000);
      expect(fallbackList).toHaveLength(1);
      expect(fallbackList[0].source).toBe('Nominatim');
      expect(fallbackList[0].name).toBe('Nom Masjid');
    });
  });
});
