import AsyncStorage from '@react-native-async-storage/async-storage';

/* ─────────────────────────── Tafsir Types & Editions ─────────────────────────── */

export type TafsirLanguage = 'ur' | 'en' | 'ar';

export interface TafsirEdition {
  slug: string;
  name: string;
  author: string;
  language: TafsirLanguage;
  languageLabel: string;
  /** Numeric ID on api.quran.com/api/v4/quran/tafsirs/{id} used as resilient fallback */
  quranComId?: number;
}

export interface AyatTafsirResult {
  editionSlug: string;
  editionName: string;
  author: string;
  language: TafsirLanguage;
  surahNumber: number;
  ayatNumber: number;
  text: string;
  source: 'cache' | 'tafsir_api' | 'quran_com';
}

export const TAFSIR_EDITIONS: TafsirEdition[] = [
  {
    slug: 'ur-tafseer-ibn-e-kaseer',
    name: 'Tafseer Ibn-e-Kaseer',
    author: 'Hafiz Ibn Kathir (Urdu)',
    language: 'ur',
    languageLabel: 'اردو',
    quranComId: 160,
  },
  {
    slug: 'ur-tafsir-bayan-ul-quran',
    name: 'Tafsir Bayan-ul-Quran',
    author: 'Dr. Israr Ahmad',
    language: 'ur',
    languageLabel: 'اردو',
  },
  {
    slug: 'ur-tafsir-as-saadi-urdu',
    name: 'Tafsir As-Saadi (Urdu)',
    author: 'Abdur-Rahman al-Saadi',
    language: 'ur',
    languageLabel: 'اردو',
  },
  {
    // Exact upstream slug on spa5k/tafsir_api@v1.2.3 has "tafisr" spelling
    slug: 'en-tafisr-ibn-kathir',
    name: 'Tafsir Ibn Kathir',
    author: 'Hafiz Ibn Kathir (Abridged)',
    language: 'en',
    languageLabel: 'English',
    quranComId: 169,
  },
  {
    slug: 'en-tafsir-maarif-ul-quran',
    name: "Ma'arif al-Qur'an",
    author: 'Mufti Muhammad Shafi',
    language: 'en',
    languageLabel: 'English',
    quranComId: 168,
  },
  {
    slug: 'en-al-jalalayn',
    name: 'Tafsir al-Jalalayn',
    author: 'Al-Mahalli & As-Suyuti',
    language: 'en',
    languageLabel: 'English',
  },
  {
    slug: 'ar-tafsir-ibn-kathir',
    name: 'تفسير ابن كثير',
    author: 'الحافظ ابن كثير',
    language: 'ar',
    languageLabel: 'العربية',
    quranComId: 14,
  },
  {
    slug: 'ar-tafsir-muyassar',
    name: 'التفسير الميسر',
    author: 'نخبة من العلماء',
    language: 'ar',
    languageLabel: 'العربية',
    quranComId: 16,
  },
  {
    slug: 'ar-tafsir-al-jalalayn',
    name: 'تفسير الجلالين',
    author: 'الجلال المحلي والسيوطي',
    language: 'ar',
    languageLabel: 'العربية',
  },
];

export const DEFAULT_TAFSIR_EDITION_SLUG = 'ur-tafseer-ibn-e-kaseer';

const TAFSIR_PREF_KEY = '@suffah_tafsir_pref_v1';
const TAFSIR_CACHE_PREFIX = '@suffah_tafsir_ayat_v1_';
const memoryTafsirCache = new Map<string, AyatTafsirResult>();

/**
 * Strips HTML tags and normalizes common HTML entities from tafsir text responses
 * (especially api.quran.com which wraps paragraphs in HTML elements).
 */
export function stripHtmlTags(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/(h[1-6]|li|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function getTafsirEditionBySlug(slug: string): TafsirEdition {
  return TAFSIR_EDITIONS.find((e) => e.slug === slug) || TAFSIR_EDITIONS[0];
}

export async function getPreferredTafsirEdition(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(TAFSIR_PREF_KEY);
    if (saved && TAFSIR_EDITIONS.some((e) => e.slug === saved)) {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_TAFSIR_EDITION_SLUG;
}

export async function savePreferredTafsirEdition(slug: string): Promise<void> {
  try {
    await AsyncStorage.setItem(TAFSIR_PREF_KEY, slug);
  } catch {
    // ignore storage errors
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Fetches authentic per-ayat Tafsir from spa5k/tafsir_api@v1.2.3 on jsDelivr CDN,
 * with automatic fallback to api.quran.com/api/v4 and AsyncStorage offline caching.
 */
export async function fetchAyatTafsir(
  surahNumber: number,
  ayatNumber: number,
  editionSlug: string = DEFAULT_TAFSIR_EDITION_SLUG
): Promise<AyatTafsirResult> {
  const edition = getTafsirEditionBySlug(editionSlug);
  const cacheKey = `${edition.slug}:${surahNumber}:${ayatNumber}`;

  const memHit = memoryTafsirCache.get(cacheKey);
  if (memHit) {
    return { ...memHit, source: 'cache' };
  }

  try {
    const stored = await AsyncStorage.getItem(`${TAFSIR_CACHE_PREFIX}${cacheKey}`);
    if (stored) {
      const parsed = JSON.parse(stored) as AyatTafsirResult;
      if (parsed?.text) {
        memoryTafsirCache.set(cacheKey, parsed);
        return { ...parsed, source: 'cache' };
      }
    }
  } catch {
    // proceed to network
  }

  // Primary: spa5k/tafsir_api@v1.2.3
  const primaryUrl = `https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@v1.2.3/tafsir/${edition.slug}/${surahNumber}/${ayatNumber}.json`;
  try {
    const res = await fetchWithTimeout(primaryUrl, 10000);
    if (res.ok) {
      const json = await res.json();
      const cleaned = stripHtmlTags(String(json?.text || ''));
      if (cleaned.length > 0) {
        const result: AyatTafsirResult = {
          editionSlug: edition.slug,
          editionName: edition.name,
          author: edition.author,
          language: edition.language,
          surahNumber,
          ayatNumber,
          text: cleaned,
          source: 'tafsir_api',
        };
        memoryTafsirCache.set(cacheKey, result);
        AsyncStorage.setItem(`${TAFSIR_CACHE_PREFIX}${cacheKey}`, JSON.stringify(result)).catch(() => {});
        return result;
      }
    }
  } catch {
    // fall through to api.quran.com fallback
  }

  // Fallback: api.quran.com/api/v4/quran/tafsirs/{id}?verse_key=s:a
  const quranComId = edition.quranComId ?? 169;
  const fallbackUrl = `https://api.quran.com/api/v4/quran/tafsirs/${quranComId}?verse_key=${surahNumber}:${ayatNumber}`;
  try {
    const res = await fetchWithTimeout(fallbackUrl, 10000);
    if (res.ok) {
      const json = await res.json();
      const tafsirEntry = Array.isArray(json?.tafsirs) ? json.tafsirs[0] : json?.tafsir;
      const cleaned = stripHtmlTags(String(tafsirEntry?.text || ''));
      if (cleaned.length > 0) {
        const result: AyatTafsirResult = {
          editionSlug: edition.slug,
          editionName: edition.name,
          author: edition.author,
          language: edition.language,
          surahNumber,
          ayatNumber,
          text: cleaned,
          source: 'quran_com',
        };
        memoryTafsirCache.set(cacheKey, result);
        AsyncStorage.setItem(`${TAFSIR_CACHE_PREFIX}${cacheKey}`, JSON.stringify(result)).catch(() => {});
        return result;
      }
    }
  } catch {
    // handled below
  }

  throw new Error('Unable to load Tafsir right now. Please check your internet connection.');
}

/* ────────────────────── Multi-Qari & Ayah Timing (MP3Quran v3) ────────────────────── */

export interface QuranReciter {
  id: string;
  nameEn: string;
  nameAr: string;
  style: string;
  /** EveryAyah folder for crystal-clear per-ayah streaming */
  everyAyahFolder?: string;
  /** MP3Quran full-surah server root (e.g. https://cdn.mp3quran.net/audio/mishary-alafasy/r1/) */
  mp3QuranServer?: string;
  /** Read ID on mp3quran.net/api/v3/ayat_timing for real-time verse highlight */
  mp3QuranReadId?: number;
  /** Special bundled Urdu translation + Arabic tilawat mode */
  isUrduTranslationMode?: boolean;
}

export interface AyahTiming {
  ayah: number;
  startTimeMs: number;
  endTimeMs: number;
}

export const CURATED_QARIS: QuranReciter[] = [
  {
    id: 'alafasy',
    nameEn: 'Mishary Rashid Alafasy',
    nameAr: 'مشاري راشد العفاسي',
    style: 'Murattal • Synced',
    everyAyahFolder: 'Alafasy_128kbps',
    mp3QuranServer: 'https://cdn.mp3quran.net/audio/mishary-alafasy/r1/',
    mp3QuranReadId: 123,
  },
  {
    id: 'urdu_translation',
    nameEn: 'Arabic + Urdu Translation',
    nameAr: 'تلاوت مع اردو ترجمہ',
    style: 'Full Surah Audio',
    everyAyahFolder: 'Alafasy_128kbps',
    isUrduTranslationMode: true,
  },
  {
    id: 'abdulbasit',
    nameEn: 'Abdul Basit Abdus Samad',
    nameAr: 'عبدالباسط عبدالصمد',
    style: 'Murattal • Synced',
    everyAyahFolder: 'Abdul_Basit_Murattal_192kbps',
    mp3QuranServer: 'https://cdn.mp3quran.net/audio/abdulbasit-abdulsamad/r1/',
    mp3QuranReadId: 51,
  },
  {
    id: 'sudais',
    nameEn: 'Abdur-Rahman as-Sudais',
    nameAr: 'عبدالرحمن السديس',
    style: 'Haramain • Synced',
    everyAyahFolder: 'Abdurrahmaan_As-Sudais_192kbps',
    mp3QuranServer: 'https://cdn.mp3quran.net/audio/abdulrahman-sudais/r1/',
    mp3QuranReadId: 54,
  },
  {
    id: 'husary',
    nameEn: 'Mahmoud Khalil al-Husary',
    nameAr: 'محمود خليل الحصري',
    style: 'Classic Tajweed • Synced',
    everyAyahFolder: 'Husary_128kbps',
    mp3QuranServer: 'https://cdn.mp3quran.net/audio/mahmoud-husary/r1/',
    mp3QuranReadId: 118,
  },
  {
    id: 'minshawi',
    nameEn: 'Muhammad Siddiq al-Minshawi',
    nameAr: 'محمد صديق المنشاوي',
    style: 'Murattal • Synced',
    everyAyahFolder: 'Minshawy_Murattal_128kbps',
    mp3QuranServer: 'https://cdn.mp3quran.net/audio/muhammad-minshawi/r1/',
    mp3QuranReadId: 112,
  },
  {
    id: 'maher',
    nameEn: 'Maher al-Muaiqly',
    nameAr: 'ماهر المعيقلي',
    style: 'Makkah Imam • Synced',
    everyAyahFolder: 'MaherAlMuaiqly128kbps',
    mp3QuranServer: 'https://cdn.mp3quran.net/audio/maher-muaiqly/r3/',
    mp3QuranReadId: 133,
  },
  {
    id: 'dosari',
    nameEn: 'Yasser ad-Dossari',
    nameAr: 'ياسر الدوسري',
    style: 'Haramain • Synced',
    everyAyahFolder: 'Yasser_Ad-Dussary_128kbps',
    mp3QuranServer: 'https://cdn.mp3quran.net/audio/yasser-dosari/r1/',
    mp3QuranReadId: 92,
  },
  {
    id: 'shatri',
    nameEn: 'Abu Bakr al-Shatri',
    nameAr: 'أبو بكر الشاطري',
    style: 'Murattal • Synced',
    everyAyahFolder: 'Abu_Bakr_Ash-Shaatree_128kbps',
    mp3QuranServer: 'https://cdn.mp3quran.net/audio/abubakr-shatri/r1/',
    mp3QuranReadId: 4,
  },
];

const QARI_PREF_KEY = '@suffah_qari_pref_v1';
const MP3QURAN_RECITERS_CACHE_KEY = '@suffah_mp3quran_reciters_v1';
const AYAT_TIMING_CACHE_PREFIX = '@suffah_ayat_timing_v1_';

export function getReciterById(id: string): QuranReciter {
  return CURATED_QARIS.find((q) => q.id === id) || CURATED_QARIS[0];
}

export async function getPreferredQariId(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(QARI_PREF_KEY);
    if (saved) return saved;
  } catch {
    // ignore
  }
  return CURATED_QARIS[0].id;
}

export async function savePreferredQariId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(QARI_PREF_KEY, id);
  } catch {
    // ignore
  }
}

export function getQariAyatAudioUrl(qari: QuranReciter, surahNumber: number, ayatNumber: number): string {
  const folder = qari.everyAyahFolder || 'Alafasy_128kbps';
  const sStr = String(surahNumber).padStart(3, '0');
  const aStr = String(ayatNumber).padStart(3, '0');
  return `https://everyayah.com/data/${folder}/${sStr}${aStr}.mp3`;
}

export function getQariFullSurahAudioUrl(qari: QuranReciter, surahNumber: number): string | null {
  if (!qari.mp3QuranServer) return null;
  const base = qari.mp3QuranServer.endsWith('/') ? qari.mp3QuranServer : `${qari.mp3QuranServer}/`;
  return `${base}${String(surahNumber).padStart(3, '0')}.mp3`;
}

/**
 * Fetches additional reciters from MP3Quran API v3, keeping our curated synced reciters first
 * and adding top global Hafs reciters from MP3Quran (up to 40 total for snappy UI).
 */
export async function fetchAllQaris(): Promise<QuranReciter[]> {
  try {
    const cachedRaw = await AsyncStorage.getItem(MP3QURAN_RECITERS_CACHE_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw) as { fetchedAt: number; items: QuranReciter[] };
      if (Date.now() - parsed.fetchedAt < 7 * 24 * 60 * 60 * 1000 && Array.isArray(parsed.items)) {
        return [...CURATED_QARIS, ...parsed.items];
      }
    }
  } catch {
    // continue to network
  }

  try {
    const res = await fetchWithTimeout('https://www.mp3quran.net/api/v3/reciters?language=eng', 10000);
    if (res.ok) {
      const json = await res.json();
      const rawList = Array.isArray(json?.reciters) ? json.reciters : [];
      const curatedNames = new Set(CURATED_QARIS.map((q) => q.nameEn.toLowerCase()));
      const extras: QuranReciter[] = [];

      for (const rec of rawList) {
        const moshaf = Array.isArray(rec?.moshaf) ? rec.moshaf.find((m: any) => Number(m?.surah_total) >= 114) || rec.moshaf[0] : null;
        if (!rec?.name || !moshaf?.server) continue;
        if (curatedNames.has(String(rec.name).toLowerCase())) continue;

        extras.push({
          id: `mp3q_${rec.id}`,
          nameEn: String(rec.name),
          nameAr: String(moshaf.name || 'حفص عن عاصم'),
          style: 'MP3Quran Stream',
          mp3QuranServer: String(moshaf.server),
          everyAyahFolder: 'Alafasy_128kbps',
        });

        if (extras.length >= 30) break;
      }

      if (extras.length > 0) {
        AsyncStorage.setItem(
          MP3QURAN_RECITERS_CACHE_KEY,
          JSON.stringify({ fetchedAt: Date.now(), items: extras })
        ).catch(() => {});
        return [...CURATED_QARIS, ...extras];
      }
    }
  } catch {
    // fallback to curated list cleanly
  }

  return CURATED_QARIS;
}

/**
 * Fetches ayah-level timestamp synchronization data (in milliseconds) from MP3Quran API v3
 * for a given Surah and read ID.
 */
export async function fetchAyahTimings(
  surahNumber: number,
  mp3QuranReadId?: number
): Promise<AyahTiming[]> {
  if (!mp3QuranReadId) return [];
  const cacheKey = `${AYAT_TIMING_CACHE_PREFIX}${mp3QuranReadId}_${surahNumber}`;

  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as AyahTiming[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }

  try {
    const res = await fetchWithTimeout(
      `https://www.mp3quran.net/api/v3/ayat_timing?surah=${surahNumber}&read=${mp3QuranReadId}`,
      10000
    );
    if (res.ok) {
      const raw = await res.json();
      if (Array.isArray(raw)) {
        const timings: AyahTiming[] = raw
          .filter((item) => Number(item?.ayah) > 0 && Number.isFinite(Number(item?.end_time)))
          .map((item) => ({
            ayah: Number(item.ayah),
            startTimeMs: Number(item.start_time) || 0,
            endTimeMs: Number(item.end_time) || 0,
          }))
          .sort((a, b) => a.startTimeMs - b.startTimeMs);

        if (timings.length > 0) {
          AsyncStorage.setItem(cacheKey, JSON.stringify(timings)).catch(() => {});
        }
        return timings;
      }
    }
  } catch {
    // fallback cleanly
  }

  return [];
}

/**
 * Resolves the currently recited Ayat number from an audio playback position (ms) and timing table.
 */
export function findActiveAyatFromPosition(timings: AyahTiming[], positionMs: number): number | null {
  if (!Array.isArray(timings) || timings.length === 0 || positionMs < 0) return null;
  for (const t of timings) {
    if (positionMs >= t.startTimeMs && positionMs < t.endTimeMs) {
      return t.ayah;
    }
  }
  const last = timings[timings.length - 1];
  if (last && positionMs >= last.startTimeMs && positionMs <= last.endTimeMs + 2000) {
    return last.ayah;
  }
  return null;
}

/* ────────────────────── Live Islamic Radio (MP3Quran v3) ────────────────────── */

export interface IslamicRadioStation {
  id: string;
  name: string;
  url: string;
  category: 'Haramain & Tafsir' | 'Reciters' | 'Translation & Urdu';
  subtitle: string;
}

export const CURATED_RADIOS: IslamicRadioStation[] = [
  {
    id: 'radio-makkah-translation',
    name: 'Quran with Urdu Translation Radio',
    url: 'https://qurango.net/radio/translation_quran_urdu',
    category: 'Translation & Urdu',
    subtitle: '24/7 Tilawat with Urdu Tarjuma',
  },
  {
    id: 'radio-alafasy',
    name: 'Mishary Rashid Alafasy Radio',
    url: 'https://qurango.net/radio/mishary_alafasy',
    category: 'Reciters',
    subtitle: 'Continuous Murattal Tilawat',
  },
  {
    id: 'radio-sudais',
    name: 'Abdur-Rahman as-Sudais Radio',
    url: 'https://qurango.net/radio/abdulrahman_alsudaes',
    category: 'Haramain & Tafsir',
    subtitle: 'Masjid al-Haram Senior Imam',
  },
  {
    id: 'radio-shuraim',
    name: 'Saud al-Shuraim Radio',
    url: 'https://qurango.net/radio/saud_alshuraim',
    category: 'Haramain & Tafsir',
    subtitle: 'Makkah Haram Recitation',
  },
  {
    id: 'radio-abdulbasit',
    name: 'Abdul Basit Abdus Samad Radio',
    url: 'https://qurango.net/radio/abdulbasit_abdulsamad_warsh',
    category: 'Reciters',
    subtitle: 'Classic Egyptian Qari Stream',
  },
  {
    id: 'radio-minshawi',
    name: 'Muhammad Siddiq al-Minshawi Radio',
    url: 'https://qurango.net/radio/mohammed_siddiq_alminshawi',
    category: 'Reciters',
    subtitle: 'Reverent Murattal Stream',
  },
  {
    id: 'radio-maher',
    name: 'Maher al-Muaiqly Radio',
    url: 'https://qurango.net/radio/maher_al_meaqli',
    category: 'Haramain & Tafsir',
    subtitle: 'Masjid al-Haram Imam Stream',
  },
  {
    id: 'radio-tafsir',
    name: 'Al-Mukhtasar Fi Tafsir Radio',
    url: 'https://qurango.net/radio/mukhtasar_altfsir',
    category: 'Haramain & Tafsir',
    subtitle: 'Arabic Concise Quran Exegesis',
  },
];

const RADIOS_CACHE_KEY = '@suffah_mp3quran_radios_v1';

export async function fetchIslamicRadios(): Promise<IslamicRadioStation[]> {
  try {
    const cachedRaw = await AsyncStorage.getItem(RADIOS_CACHE_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw) as { fetchedAt: number; items: IslamicRadioStation[] };
      if (Date.now() - parsed.fetchedAt < 24 * 60 * 60 * 1000 && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return parsed.items;
      }
    }
  } catch {
    // ignore
  }

  try {
    const res = await fetchWithTimeout('https://www.mp3quran.net/api/v3/radios?language=eng', 10000);
    if (res.ok) {
      const json = await res.json();
      const rawRadios = Array.isArray(json?.radios) ? json.radios : [];
      const seenUrls = new Set(CURATED_RADIOS.map((r) => r.url));
      const dynamicStations: IslamicRadioStation[] = [];

      for (const r of rawRadios) {
        const url = String(r?.url || '').trim();
        const name = String(r?.name || '').trim();
        if (!url || !name || seenUrls.has(url)) continue;
        seenUrls.add(url);

        const lower = name.toLowerCase();
        const category: IslamicRadioStation['category'] =
          lower.includes('urdu') || lower.includes('translation')
            ? 'Translation & Urdu'
            : lower.includes('tafsir') || lower.includes('fatwa') || lower.includes('haram')
            ? 'Haramain & Tafsir'
            : 'Reciters';

        dynamicStations.push({
          id: `mp3q_radio_${r.id}`,
          name,
          url,
          category,
          subtitle: 'Live MP3Quran Broadcast',
        });

        if (dynamicStations.length >= 60) break;
      }

      const merged = [...CURATED_RADIOS, ...dynamicStations];
      AsyncStorage.setItem(
        RADIOS_CACHE_KEY,
        JSON.stringify({ fetchedAt: Date.now(), items: merged })
      ).catch(() => {});
      return merged;
    }
  } catch {
    // fall back to curated list
  }

  return CURATED_RADIOS;
}
