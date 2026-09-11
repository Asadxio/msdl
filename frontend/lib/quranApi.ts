import { loadCachedSurah, cacheSurah, saveDailyAyat, loadDailyAyat } from './quranStorage';
import { STARTER_SURAHS } from './quranStarterSurahs';

// ─────────────────────────────────────────────────────────────────────────────
// MSDL — Quran API Layer
// Primary: api.alquran.cloud (free, open)
// High-Availability Fallback: api.quran.com (Cloudflare edge CDN)
// Zero-Network Fallback: STARTER_SURAHS (bundled offline)
// Roman Urdu: quran-roman-translation.blogspot.com (owner's own content)
// ─────────────────────────────────────────────────────────────────────────────

export interface QuranAyat {
  number: number;         // ayat number within surah (1-based)
  globalNumber: number;   // global ayat number (1-6236)
  arabic: string;
  roman: string;
  urduMeaning: string;
  surahNumber: number;
  surahName: string;
}

export interface SurahData {
  surahNumber: number;
  surahName: string;
  arabicName: string;
  totalAyat: number;
  ayats: QuranAyat[];
  fetchedAt: number;
}

// API endpoints
const ALQURAN_BASE = 'https://api.alquran.cloud/v1';
const QURAN_COM_BASE = 'https://api.quran.com/api/v4';
const BLOGGER_FEED_BASE = 'https://quran-roman-translation.blogspot.com/feeds/posts/default/-/';

// Known daily ayat pool (stored in app — offline guaranteed)
const DAILY_AYAT_POOL: Array<{ surah: number; ayat: number; arabic: string; roman: string; urdu: string; name: string }> = [
  { surah: 2, ayat: 286, arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا', roman: 'La yukallifullahu nafsan illa wus-aha', urdu: 'اللہ کسی جان پر اس کی طاقت سے زیادہ بوجھ نہیں ڈالتا', name: 'Al-Baqarah' },
  { surah: 3, ayat: 200, arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا اصْبِرُوا وَصَابِرُوا', roman: 'Ya ayyuhal lazeena amanoo isbiroo wa sabiroo', urdu: 'اے ایمان والو! صبر کرو اور ثابت قدم رہو', name: 'Aal-E-Imran' },
  { surah: 94, ayat: 6, arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', roman: 'Inna maAl usri yusra', urdu: 'بیشک تکلیف کے ساتھ آسانی ہے', name: 'Ash-Sharh' },
  { surah: 2, ayat: 152, arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ', roman: 'Fazkurooni azkurkum', urdu: 'پس مجھے یاد کرو، میں تمہیں یاد کروں گا', name: 'Al-Baqarah' },
  { surah: 65, ayat: 3, arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', roman: 'Wa man yatawakkal alallahi fahuwa hasbuh', urdu: 'اور جو اللہ پر بھروسہ کرے تو وہی اسے کافی ہے', name: 'At-Talaq' },
  { surah: 39, ayat: 53, arabic: 'لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ', roman: 'La taqnatu mir rahmatillah', urdu: 'اللہ کی رحمت سے مایوس نہ ہو', name: 'Az-Zumar' },
  { surah: 14, ayat: 7, arabic: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ', roman: "La-in shakartum la-azeedannakum", urdu: 'اگر تم شکر کرو گے تو میں تمہیں اور زیادہ دوں گا', name: 'Ibrahim' },
  { surah: 55, ayat: 13, arabic: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ', roman: "Fabi-ayyi ala-i rabbikuma tukazziban", urdu: 'پس اپنے رب کی کن کن نعمتوں کو جھٹلاؤ گے', name: 'Ar-Rahman' },
  { surah: 93, ayat: 11, arabic: 'وَأَمَّا بِنِعْمَةِ رَبِّكَ فَحَدِّثْ', roman: "Wa amma bi-ni'mati rabbika fahaddith", urdu: 'اور اپنے رب کی نعمتوں کا تذکرہ کرتے رہو', name: 'Ad-Duhaa' },
  { surah: 2, ayat: 255, arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ', roman: 'Allahu la ilaha illa huwal hayyul qayyoom', urdu: 'اللہ — اس کے سوا کوئی معبود نہیں، وہ ہمیشہ زندہ ہے، ہمیشہ قائم رہنے والا', name: 'Al-Baqarah' },
];

export function getTodayDailyAyat(): typeof DAILY_AYAT_POOL[0] {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return DAILY_AYAT_POOL[dayOfYear % DAILY_AYAT_POOL.length];
}

// ─── Fetch Helper with Timeout ────────────────────────────────────────────────
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return resp;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

// ─── 1. Primary Fetch: alquran.cloud ──────────────────────────────────────────
async function fetchFromAlquranCloud(surahNumber: number): Promise<{ ayats: QuranAyat[]; arabicName: string; totalAyat: number }> {
  const url = `${ALQURAN_BASE}/surah/${surahNumber}/editions/quran-uthmani,ur.kanzuliman,en.transliteration`;
  const resp = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 12000);
  if (!resp.ok) throw new Error(`alquran.cloud error: ${resp.status}`);
  const json = await resp.json();

  if (!json.data || json.data.length < 3) throw new Error('Invalid alquran.cloud structure');

  const arabicEdition = json.data[0];
  const urduEdition = json.data[1];
  const transliterationEdition = json.data[2];
  const arabicName = arabicEdition.name || '';
  const totalAyat = arabicEdition.numberOfAyahs || 0;

  const ayats: QuranAyat[] = arabicEdition.ayahs.map((a: any, idx: number) => ({
    number: a.numberInSurah,
    globalNumber: a.number,
    arabic: a.text,
    roman: transliterationEdition.ayahs[idx]?.text || '',
    urduMeaning: urduEdition.ayahs[idx]?.text || '',
    surahNumber,
    surahName: arabicEdition.englishName || '',
  }));

  return { ayats, arabicName, totalAyat };
}

// ─── 2. Fallback Fetch: api.quran.com (Cloudflare CDN backed) ─────────────────
async function fetchFromQuranCom(surahNumber: number, surahName: string): Promise<{ ayats: QuranAyat[]; arabicName: string; totalAyat: number }> {
  // Resource 158: Urdu translation (Maulana Fateh Muhammad / Kanzul Iman equivalent)
  // Resource 57: English Transliteration
  const url = `${QURAN_COM_BASE}/verses/by_chapter/${surahNumber}?words=false&translations=158,57&fields=text_uthmani&per_page=300`;
  const resp = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 10000);
  if (!resp.ok) throw new Error(`api.quran.com error: ${resp.status}`);
  const json = await resp.json();

  if (!json.verses || !Array.isArray(json.verses) || json.verses.length === 0) {
    throw new Error('Invalid api.quran.com structure');
  }

  const ayats: QuranAyat[] = json.verses.map((v: any) => {
    const translations = v.translations || [];
    const urduTr = translations.find((t: any) => t.resource_id === 158)?.text || '';
    const romanTr = translations.find((t: any) => t.resource_id === 57)?.text || '';

    // Strip any HTML tags that may appear in translation strings
    const cleanUrdu = urduTr.replace(/<[^>]+>/g, '').trim();
    const cleanRoman = romanTr.replace(/<[^>]+>/g, '').trim();

    return {
      number: v.verse_number,
      globalNumber: v.id,
      arabic: v.text_uthmani || '',
      roman: cleanRoman,
      urduMeaning: cleanUrdu,
      surahNumber,
      surahName,
    };
  });

  return {
    ayats,
    arabicName: '',
    totalAyat: ayats.length,
  };
}

// ─── Parse Roman from Blogger Atom Feed ──────────────────────────────────────
async function fetchRomanFromBlogspot(blogSlug: string): Promise<string[]> {
  try {
    const url = BLOGGER_FEED_BASE + encodeURIComponent(blogSlug) + '?alt=json&max-results=1';
    const resp = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 5000);
    if (!resp.ok) return [];
    const json = await resp.json();

    const entries = json.feed?.entry;
    if (!entries || entries.length === 0) return [];

    const content: string = entries[0]?.content?.['$t'] || entries[0]?.summary?.['$t'] || '';
    if (!content) return [];

    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const stripTags = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();

    const romans: string[] = [];
    let rowMatch;
    while ((rowMatch = rowRegex.exec(content)) !== null) {
      const rowHtml = rowMatch[1];
      const cells: string[] = [];
      let cellMatch;
      const tempRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      while ((cellMatch = tempRegex.exec(rowHtml)) !== null) {
        cells.push(stripTags(cellMatch[1]));
      }
      if (cells.length >= 2 && cells[1] && cells[1].length > 1) {
        if (!cells[1].toLowerCase().includes('roman') && !cells[1].toLowerCase().includes('meaning')) {
          romans.push(cells[1]);
        }
      }
    }
    return romans;
  } catch (e) {
    return [];
  }
}

// ─── Main: Resilient Surah Fetcher ────────────────────────────────────────────
export async function fetchSurah(surahNumber: number, blogSlug: string, surahName: string): Promise<SurahData> {
  // 1. Check local cache first
  const cached = await loadCachedSurah(surahNumber);
  if (cached) {
    try {
      const parsed: SurahData = JSON.parse(cached);
      if (parsed.ayats && parsed.ayats.length > 0) {
        return parsed;
      }
    } catch {
      // Cache corrupted, continue to fetch
    }
  }

  let resultAyats: QuranAyat[] = [];
  let resultArabicName = '';
  let resultTotal = 0;

  // 2. Try Primary: alquran.cloud with 1 retry
  let primarySuccess = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const primary = await fetchFromAlquranCloud(surahNumber);
      resultAyats = primary.ayats;
      resultArabicName = primary.arabicName;
      resultTotal = primary.totalAyat;
      primarySuccess = true;
      break;
    } catch (primaryErr) {
      console.warn(`[QuranApi] Primary (alquran.cloud) attempt ${attempt} failed:`, primaryErr);
      if (attempt === 1) {
        await new Promise((res) => setTimeout(res, 600)); // small delay before retry
      }
    }
  }

  // 3. If primary failed, try Secondary Fallback: api.quran.com (Cloudflare CDN)
  if (!primarySuccess) {
    try {
      console.log(`[QuranApi] Falling back to api.quran.com for Surah ${surahNumber}`);
      const fallback = await fetchFromQuranCom(surahNumber, surahName);
      resultAyats = fallback.ayats;
      resultArabicName = fallback.arabicName;
      resultTotal = fallback.totalAyat;
    } catch (fallbackErr) {
      console.warn('[QuranApi] Secondary (api.quran.com) failed:', fallbackErr);

      // 4. Last Line of Defense: Check if this Surah is in the bundled STARTER_SURAHS
      if (STARTER_SURAHS[surahNumber]) {
        console.log(`[QuranApi] Serving offline bundled starter data for Surah ${surahNumber}`);
        return STARTER_SURAHS[surahNumber];
      }

      // Re-throw if totally unavailable and not in starters
      throw new Error('Unable to connect to Quran services. Please check your internet connection.');
    }
  }

  // 4. Fetch Custom Roman Urdu from blogspot (best-effort, non-blocking)
  if (blogSlug) {
    try {
      const romans = await fetchRomanFromBlogspot(blogSlug);
      if (romans.length > 0) {
        resultAyats.forEach((a, idx) => {
          if (romans[idx]) a.roman = romans[idx];
        });
      }
    } catch {
      // Ignore blogspot failure — API roman transliteration is already present
    }
  }

  const surahData: SurahData = {
    surahNumber,
    surahName,
    arabicName: resultArabicName,
    totalAyat: resultTotal || resultAyats.length,
    ayats: resultAyats,
    fetchedAt: Date.now(),
  };

  // 5. Cache for offline future use
  await cacheSurah(surahNumber, JSON.stringify(surahData));

  return surahData;
}

// ─── Fetch + Serve Daily Ayat ─────────────────────────────────────────────────
export async function getDailyAyat() {
  const today = new Date().toISOString().split('T')[0];
  const cached = await loadDailyAyat();
  if (cached && cached.cachedDate === today) return cached;

  // Use local pool (guaranteed offline)
  const poolItem = getTodayDailyAyat();
  const daily = {
    surahNumber: poolItem.surah,
    ayatNumber: poolItem.ayat,
    arabic: poolItem.arabic,
    roman: poolItem.roman,
    urduMeaning: poolItem.urdu,
    surahName: poolItem.name,
    cachedDate: today,
  };
  await saveDailyAyat(daily);
  return daily;
}

// ─── Audio Helpers ───────────────────────────────────────────────────────────
/**
 * Returns Ayat-by-Ayat audio URL for Mishary Rashid Alafasy.
 * Formatted as 001001.mp3 (3 digits surah + 3 digits ayat)
 */
export function getAyatAudioUrl(surahNumber: number, ayatNumber: number): string {
  const sStr = String(surahNumber).padStart(3, '0');
  const aStr = String(ayatNumber).padStart(3, '0');
  return 'https://everyayah.com/data/Alafasy_128kbps/' + sStr + aStr + '.mp3';
}

/**
 * Returns full surah audio with Urdu translation (from user's website archive.org collection).
 */
export function getFullSurahUrduAudioUrl(surahNumber: number): string {
  const sStr = String(surahNumber).padStart(3, '0');
  return 'https://archive.org/download/quran-arabic-to-urdu-hindi-verse-by-verse-tarjuma-audio/' + sStr + '.mp3';
}

