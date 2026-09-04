// ─────────────────────────────────────────────────────────────────────────────
// MSDL — Complete 114 Surahs Metadata
// Source: quran-roman-translation.blogspot.com (Owner's own content)
// ─────────────────────────────────────────────────────────────────────────────

export type RevelationType = 'Makki' | 'Madani';

export interface SurahMeta {
  number: number;
  arabicName: string;
  englishName: string;
  urduName: string;
  totalAyat: number;
  parah: number;       // Starting Parah (1-30)
  type: RevelationType;
  blogSlug: string;    // blogspot URL slug for Roman Urdu fetch
}

export const QURAN_SURAHS: SurahMeta[] = [
  { number: 1,   arabicName: 'الفاتحة',         englishName: 'Al-Fatihah',      urduName: 'الفاتحہ',      totalAyat: 7,   parah: 1,  type: 'Makki',  blogSlug: 'surah-1-al-fatihah-roman' },
  { number: 2,   arabicName: 'البقرة',           englishName: 'Al-Baqarah',      urduName: 'البقرہ',       totalAyat: 286, parah: 1,  type: 'Madani', blogSlug: 'surah-2-al-baqarah-roman' },
  { number: 3,   arabicName: 'آل عمران',         englishName: 'Aal-E-Imran',     urduName: 'آل عمران',     totalAyat: 200, parah: 3,  type: 'Madani', blogSlug: 'surah-3-al-imran-roman' },
  { number: 4,   arabicName: 'النساء',           englishName: 'An-Nisa',         urduName: 'النساء',       totalAyat: 176, parah: 4,  type: 'Madani', blogSlug: 'surah-4-an-nisa-roman' },
  { number: 5,   arabicName: 'المائدة',          englishName: 'Al-Maidah',       urduName: 'المائدہ',      totalAyat: 120, parah: 6,  type: 'Madani', blogSlug: 'surah-5-al-maidah-roman' },
  { number: 6,   arabicName: 'الأنعام',          englishName: 'Al-Anam',         urduName: 'الانعام',      totalAyat: 165, parah: 7,  type: 'Makki',  blogSlug: 'surah-6-al-anam-roman' },
  { number: 7,   arabicName: 'الأعراف',          englishName: "Al-A'raf",        urduName: 'الاعراف',      totalAyat: 206, parah: 8,  type: 'Makki',  blogSlug: 'surah-7-al-araf-roman' },
  { number: 8,   arabicName: 'الأنفال',          englishName: 'Al-Anfal',        urduName: 'الانفال',      totalAyat: 75,  parah: 9,  type: 'Madani', blogSlug: 'surah-8-al-anfal-roman' },
  { number: 9,   arabicName: 'التوبة',           englishName: 'At-Tawbah',       urduName: 'التوبہ',       totalAyat: 129, parah: 10, type: 'Madani', blogSlug: 'surah-9-at-tawbah-roman' },
  { number: 10,  arabicName: 'يونس',             englishName: 'Yunus',           urduName: 'یونس',         totalAyat: 109, parah: 11, type: 'Makki',  blogSlug: 'surah-10-yunus-roman' },
  { number: 11,  arabicName: 'هود',              englishName: 'Hud',             urduName: 'ہود',          totalAyat: 123, parah: 11, type: 'Makki',  blogSlug: 'surah-11-hud-roman' },
  { number: 12,  arabicName: 'يوسف',             englishName: 'Yusuf',           urduName: 'یوسف',         totalAyat: 111, parah: 12, type: 'Makki',  blogSlug: 'surah-12-yusuf-roman' },
  { number: 13,  arabicName: 'الرعد',            englishName: "Ar-Ra'd",         urduName: 'الرعد',        totalAyat: 43,  parah: 13, type: 'Madani', blogSlug: 'surah-13-ar-rad-roman' },
  { number: 14,  arabicName: 'إبراهيم',          englishName: 'Ibrahim',         urduName: 'ابراہیم',      totalAyat: 52,  parah: 13, type: 'Makki',  blogSlug: 'surah-14-ibrahim-roman' },
  { number: 15,  arabicName: 'الحجر',            englishName: 'Al-Hijr',         urduName: 'الحجر',        totalAyat: 99,  parah: 14, type: 'Makki',  blogSlug: 'surah-15-al-hijr-roman' },
  { number: 16,  arabicName: 'النحل',            englishName: 'An-Nahl',         urduName: 'النحل',        totalAyat: 128, parah: 14, type: 'Makki',  blogSlug: 'surah-16-an-nahl-roman' },
  { number: 17,  arabicName: 'الإسراء',          englishName: "Al-Isra'",        urduName: 'الاسراء',      totalAyat: 111, parah: 15, type: 'Makki',  blogSlug: 'surah-17-al-isra-roman' },
  { number: 18,  arabicName: 'الكهف',            englishName: 'Al-Kahf',         urduName: 'الکہف',        totalAyat: 110, parah: 15, type: 'Makki',  blogSlug: 'surah-18-al-kahf-roman' },
  { number: 19,  arabicName: 'مريم',             englishName: 'Maryam',          urduName: 'مریم',         totalAyat: 98,  parah: 16, type: 'Makki',  blogSlug: 'surah-19-maryam-roman' },
  { number: 20,  arabicName: 'طه',               englishName: 'Ta-Ha',           urduName: 'طٰہٰ',         totalAyat: 135, parah: 16, type: 'Makki',  blogSlug: 'surah-20-ta-ha-roman' },
  { number: 21,  arabicName: 'الأنبياء',         englishName: "Al-Anbiya'",      urduName: 'الانبیاء',     totalAyat: 112, parah: 17, type: 'Makki',  blogSlug: 'surah-21-al-anbiya-roman' },
  { number: 22,  arabicName: 'الحج',             englishName: 'Al-Hajj',         urduName: 'الحج',         totalAyat: 78,  parah: 17, type: 'Madani', blogSlug: 'surah-22-al-hajj-roman' },
  { number: 23,  arabicName: 'المؤمنون',         englishName: "Al-Mu'minun",     urduName: 'المومنون',     totalAyat: 118, parah: 18, type: 'Makki',  blogSlug: 'surah-23-al-muminun-roman' },
  { number: 24,  arabicName: 'النور',            englishName: 'An-Nur',          urduName: 'النور',        totalAyat: 64,  parah: 18, type: 'Madani', blogSlug: 'surah-24-an-nur-roman' },
  { number: 25,  arabicName: 'الفرقان',          englishName: 'Al-Furqan',       urduName: 'الفرقان',      totalAyat: 77,  parah: 18, type: 'Makki',  blogSlug: 'surah-25-al-furqan-roman' },
  { number: 26,  arabicName: 'الشعراء',          englishName: "Ash-Shu'ara'",    urduName: 'الشعراء',      totalAyat: 227, parah: 19, type: 'Makki',  blogSlug: 'surah-26-ash-shuara-roman' },
  { number: 27,  arabicName: 'النمل',            englishName: 'An-Naml',         urduName: 'النمل',        totalAyat: 93,  parah: 19, type: 'Makki',  blogSlug: 'surah-27-an-naml-roman' },
  { number: 28,  arabicName: 'القصص',            englishName: 'Al-Qasas',        urduName: 'القصص',        totalAyat: 88,  parah: 20, type: 'Makki',  blogSlug: 'surah-28-al-qasas-roman' },
  { number: 29,  arabicName: 'العنكبوت',         englishName: 'Al-Ankabut',      urduName: 'العنکبوت',     totalAyat: 69,  parah: 20, type: 'Makki',  blogSlug: 'surah-29-al-ankabut-roman' },
  { number: 30,  arabicName: 'الروم',            englishName: 'Ar-Rum',          urduName: 'الروم',        totalAyat: 60,  parah: 21, type: 'Makki',  blogSlug: 'surah-30-ar-rum-roman' },
  { number: 31,  arabicName: 'لقمان',            englishName: 'Luqman',          urduName: 'لقمان',        totalAyat: 34,  parah: 21, type: 'Makki',  blogSlug: 'surah-31-luqman-roman' },
  { number: 32,  arabicName: 'السجدة',           englishName: 'As-Sajdah',       urduName: 'السجدہ',       totalAyat: 30,  parah: 21, type: 'Makki',  blogSlug: 'surah-32-as-sajdah-roman' },
  { number: 33,  arabicName: 'الأحزاب',          englishName: 'Al-Ahzab',        urduName: 'الاحزاب',      totalAyat: 73,  parah: 21, type: 'Madani', blogSlug: 'surah-33-al-ahzab-roman' },
  { number: 34,  arabicName: 'سبأ',              englishName: "Saba'",           urduName: 'سبا',          totalAyat: 54,  parah: 22, type: 'Makki',  blogSlug: 'surah-34-saba-roman' },
  { number: 35,  arabicName: 'فاطر',             englishName: 'Fatir',           urduName: 'فاطر',         totalAyat: 45,  parah: 22, type: 'Makki',  blogSlug: 'surah-35-fatir-roman' },
  { number: 36,  arabicName: 'يس',               englishName: 'Ya-Sin',          urduName: 'یٰسٓ',         totalAyat: 83,  parah: 22, type: 'Makki',  blogSlug: 'surah-36-yaseen-roman' },
  { number: 37,  arabicName: 'الصافات',          englishName: 'As-Saffat',       urduName: 'الصافات',      totalAyat: 182, parah: 23, type: 'Makki',  blogSlug: 'surah-37-as-saffat-roman' },
  { number: 38,  arabicName: 'ص',                englishName: 'Sad',             urduName: 'صٓ',           totalAyat: 88,  parah: 23, type: 'Makki',  blogSlug: 'surah-38-saad-roman' },
  { number: 39,  arabicName: 'الزمر',            englishName: 'Az-Zumar',        urduName: 'الزمر',        totalAyat: 75,  parah: 23, type: 'Makki',  blogSlug: 'surah-39-az-zumar-roman' },
  { number: 40,  arabicName: 'غافر',             englishName: 'Ghafir',          urduName: 'غافر',         totalAyat: 85,  parah: 24, type: 'Makki',  blogSlug: 'surah-40-ghafir-roman' },
  { number: 41,  arabicName: 'فصلت',             englishName: 'Fussilat',        urduName: 'فصلت',         totalAyat: 54,  parah: 24, type: 'Makki',  blogSlug: 'surah-41-fussilat-roman' },
  { number: 42,  arabicName: 'الشورى',           englishName: 'Ash-Shura',       urduName: 'الشوریٰ',      totalAyat: 53,  parah: 25, type: 'Makki',  blogSlug: 'surah-42-ash-shura-roman' },
  { number: 43,  arabicName: 'الزخرف',           englishName: 'Az-Zukhruf',      urduName: 'الزخرف',       totalAyat: 89,  parah: 25, type: 'Makki',  blogSlug: 'surah-43-az-zukhruf-roman' },
  { number: 44,  arabicName: 'الدخان',           englishName: 'Ad-Dukhan',       urduName: 'الدخان',       totalAyat: 59,  parah: 25, type: 'Makki',  blogSlug: 'surah-44-ad-dukhan-roman' },
  { number: 45,  arabicName: 'الجاثية',          englishName: 'Al-Jathiyah',     urduName: 'الجاثیہ',      totalAyat: 37,  parah: 25, type: 'Makki',  blogSlug: 'surah-45-al-jathiyah-roman' },
  { number: 46,  arabicName: 'الأحقاف',          englishName: 'Al-Ahqaf',        urduName: 'الاحقاف',      totalAyat: 35,  parah: 26, type: 'Makki',  blogSlug: 'surah-46-al-ahqaf-roman' },
  { number: 47,  arabicName: 'محمد',             englishName: 'Muhammad',        urduName: 'محمد',         totalAyat: 38,  parah: 26, type: 'Madani', blogSlug: 'surah-47-muhammad-roman' },
  { number: 48,  arabicName: 'الفتح',            englishName: 'Al-Fath',         urduName: 'الفتح',        totalAyat: 29,  parah: 26, type: 'Madani', blogSlug: 'surah-48-al-fath-roman' },
  { number: 49,  arabicName: 'الحجرات',          englishName: 'Al-Hujurat',      urduName: 'الحجرات',      totalAyat: 18,  parah: 26, type: 'Madani', blogSlug: 'surah-49-al-hujurat-roman' },
  { number: 50,  arabicName: 'ق',                englishName: 'Qaf',             urduName: 'قٓ',           totalAyat: 45,  parah: 26, type: 'Makki',  blogSlug: 'surah-50-qaf-roman' },
  { number: 51,  arabicName: 'الذاريات',         englishName: 'Adh-Dhariyat',    urduName: 'الذاریات',     totalAyat: 60,  parah: 26, type: 'Makki',  blogSlug: 'surah-51-adh-dhariyat-roman' },
  { number: 52,  arabicName: 'الطور',            englishName: 'At-Tur',          urduName: 'الطور',        totalAyat: 49,  parah: 27, type: 'Makki',  blogSlug: 'surah-52-at-tur-roman' },
  { number: 53,  arabicName: 'النجم',            englishName: 'An-Najm',         urduName: 'النجم',        totalAyat: 62,  parah: 27, type: 'Makki',  blogSlug: 'surah-53-najm-roman' },
  { number: 54,  arabicName: 'القمر',            englishName: 'Al-Qamar',        urduName: 'القمر',        totalAyat: 55,  parah: 27, type: 'Makki',  blogSlug: 'surah-54-al-qamar-roman' },
  { number: 55,  arabicName: 'الرحمن',           englishName: 'Ar-Rahman',       urduName: 'الرحمن',       totalAyat: 78,  parah: 27, type: 'Madani', blogSlug: 'surah-55-ar-rahman-roman' },
  { number: 56,  arabicName: 'الواقعة',          englishName: "Al-Waqi'ah",      urduName: 'الواقعہ',      totalAyat: 96,  parah: 27, type: 'Makki',  blogSlug: 'surah-56-al-waqiah-roman' },
  { number: 57,  arabicName: 'الحديد',           englishName: 'Al-Hadid',        urduName: 'الحدید',       totalAyat: 29,  parah: 27, type: 'Madani', blogSlug: 'surah-57-al-hadid-roman' },
  { number: 58,  arabicName: 'المجادلة',         englishName: 'Al-Mujadila',     urduName: 'المجادلہ',     totalAyat: 22,  parah: 28, type: 'Madani', blogSlug: 'surah-58-al-mujadilah-roman' },
  { number: 59,  arabicName: 'الحشر',            englishName: 'Al-Hashr',        urduName: 'الحشر',        totalAyat: 24,  parah: 28, type: 'Madani', blogSlug: 'surah-59-al-hashr-roman' },
  { number: 60,  arabicName: 'الممتحنة',         englishName: 'Al-Mumtahanah',   urduName: 'الممتحنہ',     totalAyat: 13,  parah: 28, type: 'Madani', blogSlug: 'surah-60-al-mumtahanah-roman' },
  { number: 61,  arabicName: 'الصف',             englishName: 'As-Saf',          urduName: 'الصف',         totalAyat: 14,  parah: 28, type: 'Madani', blogSlug: 'surah-61-as-saff-roman' },
  { number: 62,  arabicName: 'الجمعة',           englishName: "Al-Jumu'ah",      urduName: 'الجمعہ',       totalAyat: 11,  parah: 28, type: 'Madani', blogSlug: 'surah-62-al-jumuah-roman' },
  { number: 63,  arabicName: 'المنافقون',        englishName: 'Al-Munafiqun',    urduName: 'المنافقون',    totalAyat: 11,  parah: 28, type: 'Madani', blogSlug: 'surah-63-al-munafiqoon-roman' },
  { number: 64,  arabicName: 'التغابن',          englishName: 'At-Taghabun',     urduName: 'التغابن',      totalAyat: 18,  parah: 28, type: 'Madani', blogSlug: 'surah-64-at-taghabun-roman' },
  { number: 65,  arabicName: 'الطلاق',           englishName: 'At-Talaq',        urduName: 'الطلاق',       totalAyat: 12,  parah: 28, type: 'Madani', blogSlug: 'surah-65-at-talaq-roman' },
  { number: 66,  arabicName: 'التحريم',          englishName: 'At-Tahrim',       urduName: 'التحریم',      totalAyat: 12,  parah: 28, type: 'Madani', blogSlug: 'surah-66-at-tahrim-roman' },
  { number: 67,  arabicName: 'الملك',            englishName: 'Al-Mulk',         urduName: 'الملک',        totalAyat: 30,  parah: 29, type: 'Makki',  blogSlug: 'surah-67-al-mulk-roman' },
  { number: 68,  arabicName: 'القلم',            englishName: 'Al-Qalam',        urduName: 'القلم',        totalAyat: 52,  parah: 29, type: 'Makki',  blogSlug: 'surah-68-al-qalam-roman' },
  { number: 69,  arabicName: 'الحاقة',           englishName: 'Al-Haqqah',       urduName: 'الحاقہ',       totalAyat: 52,  parah: 29, type: 'Makki',  blogSlug: 'surah-69-al-haqqah-roman' },
  { number: 70,  arabicName: 'المعارج',          englishName: "Al-Ma'arij",      urduName: 'المعارج',      totalAyat: 44,  parah: 29, type: 'Makki',  blogSlug: 'surah-70-al-maarij-roman' },
  { number: 71,  arabicName: 'نوح',              englishName: 'Nuh',             urduName: 'نوح',          totalAyat: 28,  parah: 29, type: 'Makki',  blogSlug: 'surah-71-nuh-roman' },
  { number: 72,  arabicName: 'الجن',             englishName: 'Al-Jinn',         urduName: 'الجن',         totalAyat: 28,  parah: 29, type: 'Makki',  blogSlug: 'surah-72-al-jinn-roman' },
  { number: 73,  arabicName: 'المزمل',           englishName: 'Al-Muzzammil',    urduName: 'المزمل',       totalAyat: 20,  parah: 29, type: 'Makki',  blogSlug: 'surah-73-al-muzzammil-roman' },
  { number: 74,  arabicName: 'المدثر',           englishName: 'Al-Muddaththir',  urduName: 'المدثر',       totalAyat: 56,  parah: 29, type: 'Makki',  blogSlug: 'surah-74-al-muddaththir-roman' },
  { number: 75,  arabicName: 'القيامة',          englishName: 'Al-Qiyamah',      urduName: 'القیامہ',      totalAyat: 40,  parah: 29, type: 'Makki',  blogSlug: 'surah-75-al-qiyamah-roman' },
  { number: 76,  arabicName: 'الإنسان',          englishName: 'Al-Insan',        urduName: 'الانسان',      totalAyat: 31,  parah: 29, type: 'Madani', blogSlug: 'surah-76-al-insan-roman' },
  { number: 77,  arabicName: 'المرسلات',         englishName: 'Al-Mursalat',     urduName: 'المرسلات',     totalAyat: 50,  parah: 29, type: 'Makki',  blogSlug: 'surah-77-al-mursalat-roman' },
  { number: 78,  arabicName: 'النبأ',            englishName: "An-Naba'",        urduName: 'النبا',        totalAyat: 40,  parah: 30, type: 'Makki',  blogSlug: 'surah-78-naba-roman' },
  { number: 79,  arabicName: 'النازعات',         englishName: "An-Nazi'at",      urduName: 'النازعات',     totalAyat: 46,  parah: 30, type: 'Makki',  blogSlug: 'surah-79-naziat-roman' },
  { number: 80,  arabicName: 'عبس',              englishName: 'Abasa',           urduName: 'عبس',          totalAyat: 42,  parah: 30, type: 'Makki',  blogSlug: 'surah-80-abasa-roman' },
  { number: 81,  arabicName: 'التكوير',          englishName: 'At-Takwir',       urduName: 'التکویر',      totalAyat: 29,  parah: 30, type: 'Makki',  blogSlug: 'surah-81-at-takwir-roman' },
  { number: 82,  arabicName: 'الانفطار',         englishName: 'Al-Infitar',      urduName: 'الانفطار',     totalAyat: 19,  parah: 30, type: 'Makki',  blogSlug: 'surah-82-al-infitar-roman' },
  { number: 83,  arabicName: 'المطففين',         englishName: 'Al-Mutaffifin',   urduName: 'المطففین',     totalAyat: 36,  parah: 30, type: 'Makki',  blogSlug: 'surah-83-al-mutaffifin-roman' },
  { number: 84,  arabicName: 'الانشقاق',         englishName: 'Al-Inshiqaq',     urduName: 'الانشقاق',     totalAyat: 25,  parah: 30, type: 'Makki',  blogSlug: 'surah-84-al-inshiqaq-roman' },
  { number: 85,  arabicName: 'البروج',           englishName: 'Al-Buruj',        urduName: 'البروج',       totalAyat: 22,  parah: 30, type: 'Makki',  blogSlug: 'surah-85-al-burooj-roman' },
  { number: 86,  arabicName: 'الطارق',           englishName: 'At-Tariq',        urduName: 'الطارق',       totalAyat: 17,  parah: 30, type: 'Makki',  blogSlug: 'surah-86-at-tariq-roman' },
  { number: 87,  arabicName: 'الأعلى',           englishName: "Al-A'la",         urduName: 'الاعلیٰ',      totalAyat: 19,  parah: 30, type: 'Makki',  blogSlug: 'surah-87-al-aala-roman' },
  { number: 88,  arabicName: 'الغاشية',          englishName: 'Al-Ghashiyah',    urduName: 'الغاشیہ',      totalAyat: 26,  parah: 30, type: 'Makki',  blogSlug: 'surah-88-al-ghashiyah-roman' },
  { number: 89,  arabicName: 'الفجر',            englishName: 'Al-Fajr',         urduName: 'الفجر',        totalAyat: 30,  parah: 30, type: 'Makki',  blogSlug: 'surah-89-al-fajr-roman' },
  { number: 90,  arabicName: 'البلد',            englishName: 'Al-Balad',        urduName: 'البلد',        totalAyat: 20,  parah: 30, type: 'Makki',  blogSlug: 'surah-90-al-balad-roman' },
  { number: 91,  arabicName: 'الشمس',            englishName: 'Ash-Shams',       urduName: 'الشمس',        totalAyat: 15,  parah: 30, type: 'Makki',  blogSlug: 'surah-91-ash-shams-roman' },
  { number: 92,  arabicName: 'الليل',            englishName: 'Al-Layl',         urduName: 'اللیل',        totalAyat: 21,  parah: 30, type: 'Makki',  blogSlug: 'surah-92-al-lail-roman' },
  { number: 93,  arabicName: 'الضحى',            englishName: 'Ad-Duhaa',        urduName: 'الضحیٰ',       totalAyat: 11,  parah: 30, type: 'Makki',  blogSlug: 'surah-93-ad-duha-roman' },
  { number: 94,  arabicName: 'الشرح',            englishName: 'Ash-Sharh',       urduName: 'الشرح',        totalAyat: 8,   parah: 30, type: 'Makki',  blogSlug: 'surah-94-ash-sharh-roman' },
  { number: 95,  arabicName: 'التين',            englishName: 'At-Tin',          urduName: 'التین',        totalAyat: 8,   parah: 30, type: 'Makki',  blogSlug: 'surah-95-at-tin-roman' },
  { number: 96,  arabicName: 'العلق',            englishName: "Al-'Alaq",        urduName: 'العلق',        totalAyat: 19,  parah: 30, type: 'Makki',  blogSlug: 'surah-96-al-alaq-roman' },
  { number: 97,  arabicName: 'القدر',            englishName: 'Al-Qadr',         urduName: 'القدر',        totalAyat: 5,   parah: 30, type: 'Makki',  blogSlug: 'surah-97-al-qadr-roman' },
  { number: 98,  arabicName: 'البينة',           englishName: 'Al-Bayyinah',     urduName: 'البینہ',       totalAyat: 8,   parah: 30, type: 'Madani', blogSlug: 'surah-98-al-bayyinah-roman' },
  { number: 99,  arabicName: 'الزلزلة',          englishName: 'Az-Zalzalah',     urduName: 'الزلزلہ',      totalAyat: 8,   parah: 30, type: 'Madani', blogSlug: 'surah-99-az-zalzalah-roman' },
  { number: 100, arabicName: 'العاديات',         englishName: 'Al-Adiyat',       urduName: 'العادیات',     totalAyat: 11,  parah: 30, type: 'Makki',  blogSlug: 'surah-100-al-adiyat-roman' },
  { number: 101, arabicName: 'القارعة',          englishName: "Al-Qari'ah",      urduName: 'القارعہ',      totalAyat: 11,  parah: 30, type: 'Makki',  blogSlug: 'surah-101-al-qariah-roman' },
  { number: 102, arabicName: 'التكاثر',          englishName: 'At-Takathur',     urduName: 'التکاثر',      totalAyat: 8,   parah: 30, type: 'Makki',  blogSlug: 'surah-102-at-takathur-roman' },
  { number: 103, arabicName: 'العصر',            englishName: 'Al-Asr',          urduName: 'العصر',        totalAyat: 3,   parah: 30, type: 'Makki',  blogSlug: 'surah-103-al-asr-roman' },
  { number: 104, arabicName: 'الهمزة',           englishName: 'Al-Humazah',      urduName: 'الھمزہ',       totalAyat: 9,   parah: 30, type: 'Makki',  blogSlug: 'surah-104-al-humazah-roman' },
  { number: 105, arabicName: 'الفيل',            englishName: 'Al-Fil',          urduName: 'الفیل',        totalAyat: 5,   parah: 30, type: 'Makki',  blogSlug: 'surah-105-al-fil-roman' },
  { number: 106, arabicName: 'قريش',             englishName: 'Quraysh',         urduName: 'قریش',         totalAyat: 4,   parah: 30, type: 'Makki',  blogSlug: 'surah-106-quraysh-roman' },
  { number: 107, arabicName: 'الماعون',          englishName: "Al-Ma'un",        urduName: 'الماعون',      totalAyat: 7,   parah: 30, type: 'Makki',  blogSlug: 'surah-107-al-maun-roman' },
  { number: 108, arabicName: 'الكوثر',           englishName: 'Al-Kawthar',      urduName: 'الکوثر',       totalAyat: 3,   parah: 30, type: 'Makki',  blogSlug: 'surah-108-al-kawthar-roman' },
  { number: 109, arabicName: 'الكافرون',         englishName: 'Al-Kafirun',      urduName: 'الکافرون',     totalAyat: 6,   parah: 30, type: 'Makki',  blogSlug: 'surah-109-al-kafirun-roman' },
  { number: 110, arabicName: 'النصر',            englishName: 'An-Nasr',         urduName: 'النصر',        totalAyat: 3,   parah: 30, type: 'Madani', blogSlug: 'surah-110-an-nasr-roman' },
  { number: 111, arabicName: 'المسد',            englishName: 'Al-Masad',        urduName: 'المسد',        totalAyat: 5,   parah: 30, type: 'Makki',  blogSlug: 'surah-111-al-masad-roman' },
  { number: 112, arabicName: 'الإخلاص',          englishName: 'Al-Ikhlas',       urduName: 'الاخلاص',      totalAyat: 4,   parah: 30, type: 'Makki',  blogSlug: 'surah-112-al-ikhlas-roman' },
  { number: 113, arabicName: 'الفلق',            englishName: 'Al-Falaq',        urduName: 'الفلق',        totalAyat: 5,   parah: 30, type: 'Makki',  blogSlug: 'surah-113-al-falaq-roman' },
  { number: 114, arabicName: 'الناس',            englishName: 'An-Nas',          urduName: 'الناس',        totalAyat: 6,   parah: 30, type: 'Makki',  blogSlug: 'surah-114-an-nas-roman' },
];

export const TOTAL_AYAT = 6236;
export const TOTAL_SURAHS = 114;
export const TOTAL_PARAHS = 30;

export function getSurahByNumber(n: number): SurahMeta | undefined {
  return QURAN_SURAHS.find((s) => s.number === n);
}

export function getSurahsByParah(parah: number): SurahMeta[] {
  return QURAN_SURAHS.filter((s) => s.parah === parah);
}

/**
 * Normalizes Urdu and Arabic text by stripping diacritics (tashkeel/aerab),
 * harmonizing Alif forms (ا, آ, أ, إ), Heh forms (ہ, ه, ة, ھ),
 * and Yeh forms (ی, ي, ے, ئ, ى). Also allows prefix-agnostic matching for "ال" (Al-).
 */
export function normalizeUrduAndArabicText(text: string): string {
  if (!text) return '';
  return text
    // Strip Arabic/Urdu diacritics (fatha, damma, kasra, shadda, sukun, etc.)
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    // Unify Alif variants
    .replace(/[آأإٱ]/g, 'ا')
    // Unify Heh / Teh Marbuta variants
    .replace(/[ةهھ]/g, 'ہ')
    // Unify Yeh / Alef Maksura variants
    .replace(/[يےئى]/g, 'ی')
    // Remove tatweel (kashida)
    .replace(/\u0640/g, '')
    .toLowerCase()
    .trim();
}

export function searchSurahs(query: string): SurahMeta[] {
  const rawQ = query.trim();
  if (!rawQ) return QURAN_SURAHS;

  const lowerQ = rawQ.toLowerCase();
  const normQ = normalizeUrduAndArabicText(rawQ);
  // Also create a stripped prefix version without leading 'ال' or 'al-' or 'at-' or 'an-' or 'ar-' or 'ash-' or 'as-' or 'az-'
  const normQWithoutAl = normQ.startsWith('ال') ? normQ.slice(2) : normQ;

  return QURAN_SURAHS.filter((s) => {
    // 1. Surah number exact match
    if (s.number.toString() === lowerQ) return true;

    // 2. English name match
    if (s.englishName.toLowerCase().includes(lowerQ)) return true;

    // 3. Normalized Urdu & Arabic text match
    const normUrdu = normalizeUrduAndArabicText(s.urduName);
    const normArabic = normalizeUrduAndArabicText(s.arabicName);

    const normUrduWithoutAl = normUrdu.startsWith('ال') ? normUrdu.slice(2) : normUrdu;
    const normArabicWithoutAl = normArabic.startsWith('ال') ? normArabic.slice(2) : normArabic;

    // Check direct normalized inclusions
    if (
      normUrdu.includes(normQ) ||
      normArabic.includes(normQ) ||
      normUrduWithoutAl.includes(normQWithoutAl) ||
      normArabicWithoutAl.includes(normQWithoutAl)
    ) {
      return true;
    }

    // Special phonetic Urdu aliases (e.g. Yaseen/یاسین/یسین, Baqarah/بقرہ/بقره, Fatihah/فاتحہ)
    if (normQ === 'یسین' || normQ === 'یاسین') {
      if (s.number === 36) return true;
    }
    if (normQ === 'فاتحہ' || normQ === 'فاتحه') {
      if (s.number === 1) return true;
    }
    if (normQ === 'بقرہ' || normQ === 'بقره') {
      if (s.number === 2) return true;
    }
    if (normQ === 'کہف' || normQ === 'کهف') {
      if (s.number === 18) return true;
    }
    if (normQ === 'رحمن' || normQ === 'رحمان') {
      if (s.number === 55) return true;
    }
    if (normQ === 'ملک' || normQ === 'تیاک') {
      if (s.number === 67) return true;
    }
    if (normQ === 'اخلاص') {
      if (s.number === 112) return true;
    }

    return false;
  });
}
