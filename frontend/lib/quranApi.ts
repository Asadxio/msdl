import { loadCachedSurah, cacheSurah, saveDailyAyat, loadDailyAyat } from './quranStorage';

// ─────────────────────────────────────────────────────────────────────────────
// MSDL — Quran API Layer
// Arabic + Urdu: api.alquran.cloud (free, open)
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

// ─── Fetch from alquran.cloud ─────────────────────────────────────────────────
async function fetchFromAlquranCloud(surahNumber: number): Promise<{ ayats: QuranAyat[]; arabicName: string; totalAyat: number }> {
  const url = ALQURAN_BASE + '/surah/' + surahNumber + '/editions/quran-uthmani,ur.jalandhri';
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error('alquran.cloud fetch failed: ' + resp.status);
  const json = await resp.json();

  if (!json.data || json.data.length < 2) throw new Error('Invalid API response structure');

  const arabicEdition = json.data[0];
  const urduEdition = json.data[1];
  const arabicName = arabicEdition.name || '';
  const totalAyat = arabicEdition.numberOfAyahs || 0;

  const ayats: QuranAyat[] = arabicEdition.ayahs.map((a: any, idx: number) => ({
    number: a.numberInSurah,
    globalNumber: a.number,
    arabic: a.text,
    roman: '',  // filled in later from blogspot
    urduMeaning: urduEdition.ayahs[idx]?.text || '',
    surahNumber,
    surahName: arabicEdition.englishName || '',
  }));

  return { ayats, arabicName, totalAyat };
}

// ─── Parse Roman from Blogger Atom Feed ──────────────────────────────────────
async function fetchRomanFromBlogspot(blogSlug: string): Promise<string[]> {
  try {
    // Use the label-based feed for this post
    const url = BLOGGER_FEED_BASE + encodeURIComponent(blogSlug) + '?alt=json&max-results=1';
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return [];
    const json = await resp.json();

    const entries = json.feed?.entry;
    if (!entries || entries.length === 0) return [];

    const content: string = entries[0]?.content?.['$t'] || entries[0]?.summary?.['$t'] || '';
    if (!content) return [];

    // Extract Roman column from HTML table: rows have Arabic | Roman | Meaning | Audio
    // We want column index 1 (Roman)
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
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
      // Column 1 (index 1) is Roman translation
      if (cells.length >= 2 && cells[1] && cells[1].length > 1) {
        // Skip header row
        if (!cells[1].toLowerCase().includes('roman') && !cells[1].toLowerCase().includes('meaning')) {
          romans.push(cells[1]);
        }
      }
    }
    return romans;
  } catch (e) {
    console.warn('fetchRomanFromBlogspot error:', e);
    return [];
  }
}

// ─── Main: Fetch Complete Surah ───────────────────────────────────────────────
export async function fetchSurah(surahNumber: number, blogSlug: string, surahName: string): Promise<SurahData> {
  // 1. Try cache first
  const cached = await loadCachedSurah(surahNumber);
  if (cached) {
    try {
      const parsed: SurahData = JSON.parse(cached);
      // Revive dates in ayats (not needed but structure intact)
      return parsed;
    } catch {
      // Cache corrupted, re-fetch
    }
  }

  // 2. Fetch from alquran.cloud
  const { ayats, arabicName, totalAyat } = await fetchFromAlquranCloud(surahNumber);

  // 3. Fetch Roman from blogspot (best-effort, non-blocking)
  const romans = await fetchRomanFromBlogspot(blogSlug);
  if (romans.length > 0) {
    ayats.forEach((a, idx) => {
      if (romans[idx]) a.roman = romans[idx];
    });
  }

  const surahData: SurahData = {
    surahNumber,
    surahName,
    arabicName,
    totalAyat,
    ayats,
    fetchedAt: Date.now(),
  };

  // 4. Cache it
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
