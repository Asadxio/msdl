/**
 * SUFFAH Islamic Knowledge Modules — Type Definitions
 * 
 * Defines core types for:
 * 1. Hadith Library (7 canonical collections)
 * 2. Duas & Azkar (Hisn al-Muslim categories)
 * 3. Asma-ul-Husna (99 Names of Allah)
 * 4. Salah Guide & Audio (Step-by-step prayer)
 * 5. Azaan & Prayer Audio (Muazzin recitations & settings)
 */

// ─── Module 1: Hadith Types ──────────────────────────────────────────────

export type HadithBookId =
  | 'bukhari'
  | 'muslim'
  | 'abudawud'
  | 'tirmidhi'
  | 'nasai'
  | 'ibnmajah'
  | 'malik'
  | 'nawawi'
  | 'qudsi'
  | 'dehlawi';

export interface HadithBook {
  id: HadithBookId;
  titleEnglish: string;
  titleArabic: string;
  titleUrdu: string;
  author: string;
  deathYearHijri: number;
  totalHadith: number;
  totalChapters: number;
  descriptionEn: string;
  descriptionUr: string;
  colorBg: string;
  colorFg: string;
}

export interface HadithChapter {
  id: string; // e.g. "bukhari-1"
  bookId: HadithBookId;
  chapterNumber: number;
  titleEnglish: string;
  titleArabic: string;
  titleUrdu: string;
  hadithStart: number;
  hadithEnd: number;
  hadithCount: number;
}

export interface HadithGrade {
  name: string; // e.g. "Al-Albani", "Ahmad Muhammad Shakir", "Zubair Ali Zai"
  grade: string; // e.g. "Sahih", "Hasan", "Daif"
}

export interface HadithReference {
  book: number;
  hadith: number;
}

export interface HadithEntry {
  id: string; // e.g. "bukhari-1"
  bookId: HadithBookId;
  hadithNumber: number;
  arabicNumber?: number;
  chapterNumber: number;
  chapterTitleEn?: string;
  chapterTitleUr?: string;
  arabicText: string;
  englishText: string;
  urduText: string;
  narrator?: string;
  grades: HadithGrade[];
  reference: HadithReference;
}

export interface HadithBookmark {
  id: string;
  hadithId: string;
  bookId: HadithBookId;
  hadithNumber: number;
  bookName: string;
  snippet: string;
  timestamp: number;
}

// ─── Module 2: Duas & Azkar Types ─────────────────────────────────────────

export type DuaCategoryId =
  | 'morning'
  | 'evening'
  | 'sleep'
  | 'wake'
  | 'eating'
  | 'travel'
  | 'masjid'
  | 'daily'
  | 'ramadan'
  | 'general';

export interface DuaCategory {
  id: DuaCategoryId;
  titleEn: string;
  titleUr: string;
  titleAr: string;
  icon: string;
  count: number;
  colorBg: string;
  colorFg: string;
  descriptionEn: string;
  descriptionUr: string;
}

export interface DuaEntry {
  id: string;
  categoryId: DuaCategoryId;
  titleEn: string;
  titleUr: string;
  arabicText: string;
  transliteration: string;
  englishTranslation: string;
  urduTranslation: string;
  reference: string;
  targetCount: number; // e.g. 1, 3, 33, 100
  repeatCount?: number;
  virtueUr?: string;
  virtueEn?: string;
  audioUrl?: string;
}

export interface DuaBookmark {
  duaId: string;
  categoryId: DuaCategoryId;
  titleEn: string;
  titleUr: string;
  timestamp: number;
}

// ─── Module 3: Asma-ul-Husna Types ────────────────────────────────────────

export interface AllahName {
  id: number; // 1 to 99
  arabic: string;
  transliteration: string;
  englishMeaning: string;
  urduMeaning: string;
  explanationEn: string;
  explanationUr: string;
  quranicReference?: string;
  quranicVerse?: string;
  audioUrl?: string;
  benefitUr?: string;
  benefitEn?: string;
}

export interface NameFavorite {
  nameId: number;
  timestamp: number;
}

// ─── Module 4: Salah Guide Types ──────────────────────────────────────────

export type SalahPosture =
  | 'standing'
  | 'bowing'
  | 'prostrating'
  | 'sitting';

export interface FiqhGuidance {
  hanafi: string;
  shafii: string;
  general: string;
}

export interface SalahStep {
  stepNumber: number;
  id: string;
  stepNameEn: string;
  stepNameUr: string;
  stepNameAr: string;
  posture: SalahPosture;
  arabicText: string;
  transliteration: string;
  englishTranslation: string;
  urduTranslation: string;
  instructionsEn: string;
  instructionsUr: string;
  fiqhGuidance: FiqhGuidance;
  audioUrl?: string;
  repeatTimes?: number;
}

export type FiqhSchool = 'hanafi' | 'shafii';

// ─── Module 5: Azaan & Prayer Audio Types ─────────────────────────────────

export interface AzaanRecitation {
  id: string;
  titleEn: string;
  titleUr: string;
  muazzin: string;
  location: string;
  isFajr: boolean;
  durationSeconds: number;
  audioUrl: string;
  attribution: string;
  license: string;
}

export interface AzaanPreference {
  enabled: boolean;
  selectedAzaanId: string;
  fajrAzaanId: string;
  volume: number; // 0.0 - 1.0
  playFullAzaan: boolean;
  preAzaanReminder?: boolean;
  prayerNotifications?: {
    fajr: 'full_azaan' | 'takbeer_only' | 'beep' | 'silent';
    dhuhr: 'full_azaan' | 'takbeer_only' | 'beep' | 'silent';
    asr: 'full_azaan' | 'takbeer_only' | 'beep' | 'silent';
    maghrib: 'full_azaan' | 'takbeer_only' | 'beep' | 'silent';
    isha: 'full_azaan' | 'takbeer_only' | 'beep' | 'silent';
  };
  prayerAlarms: {
    fajr: boolean;
    zuhr: boolean;
    asr: boolean;
    maghrib: boolean;
    isha: boolean;
  };
}
