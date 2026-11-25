// ─────────────────────────────────────────────────────────────────────────────
// SUFFAH — Islamic (Hijri) Calendar Service & Significant Milestones
// Combines Intl Umm al-Qura precision with deterministic Kuwayti/Tabular math fallback.
// ─────────────────────────────────────────────────────────────────────────────

export interface HijriDateParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..30
  monthName: string;
  monthAbbr: string;
  urduMonthName: string;
  formatted: string;
  formattedWithAH: string;
  urduFormatted: string;
}

export interface IslamicEventTemplate {
  id: string;
  hijriMonth: number;
  hijriDay: number;
  title: string;
  arabicTitle: string;
  urduTitle: string;
  description: string;
  significance: string;
  category: 'sacred' | 'fasting' | 'eid' | 'ramadan' | 'hajj' | 'history';
}

export interface IslamicCalendarEvent extends IslamicEventTemplate {
  hijriYear: number;
  hijriMonthName: string;
  hijriMonthAbbr: string;
  hijriDateLabel: string; // e.g. "27 Rajab"
  hijriFullLabel: string; // e.g. "27 Rajab 1448 AH"
  gregorianDate: Date;
  gregorianShort: string; // e.g. "5 Jan 2027"
  gregorianLong: string; // e.g. "Tuesday 5 January 2027"
  daysRemaining: number; // 0 = Today, 1 = Tomorrow, >1 = future, <0 = past
  countdownLabel: string; // "Today" | "Tomorrow" | "In 15 days" | "Past"
}

export const HIJRI_MONTHS: ReadonlyArray<{
  number: number;
  name: string;
  abbr: string;
  arabic: string;
  urdu: string;
}> = [
  { number: 1, name: 'Muharram', abbr: 'Muh', arabic: 'مُحَرَّم', urdu: 'محرم الحرام' },
  { number: 2, name: 'Safar', abbr: 'Saf', arabic: 'صَفَر', urdu: 'صفر المظفر' },
  { number: 3, name: 'Rabi al-Awwal', abbr: 'Rab', arabic: 'رَبِيع الأَوَّل', urdu: 'ربیع الاول' },
  { number: 4, name: 'Rabi al-Thani', abbr: 'Rab II', arabic: 'رَبِيع الثَّانِي', urdu: 'ربیع الثانی' },
  { number: 5, name: 'Jumada al-Awwal', abbr: 'Jum', arabic: 'جُمَادَى الأُولَى', urdu: 'جمادی الاول' },
  { number: 6, name: 'Jumada al-Thani', abbr: 'Jum II', arabic: 'جُمَادَى الآخِرَة', urdu: 'جمادی الثانی' },
  { number: 7, name: 'Rajab', abbr: 'Raj', arabic: 'رَجَب', urdu: 'رجب المرجب' },
  { number: 8, name: "Sha'ban", abbr: 'Sha', arabic: 'شَعْبَان', urdu: 'شعبان المعظم' },
  { number: 9, name: 'Ramadan', abbr: 'Ram', arabic: 'رَمَضَان', urdu: 'رمضان المبارک' },
  { number: 10, name: 'Shawwal', abbr: 'Shw', arabic: 'شَوَّال', urdu: 'شوال المکرم' },
  { number: 11, name: 'Zul Qidah', abbr: 'DhQ', arabic: 'ذُو القَعْدَة', urdu: 'ذوالقعدہ' },
  { number: 12, name: 'Dhul Hijjah', abbr: 'Dhu', arabic: 'ذُو الحِجَّة', urdu: 'ذوالحجہ' },
];

export const ISLAMIC_EVENT_TEMPLATES: readonly IslamicEventTemplate[] = [
  {
    id: 'islamic-new-year',
    hijriMonth: 1,
    hijriDay: 1,
    title: 'Islamic New Year',
    arabicTitle: 'رأس السنة الهجرية',
    urduTitle: 'نیا اسلامی سال',
    description: 'Marks 1 Muharram and the beginning of the new Hijri lunar calendar year.',
    significance:
      'Commemorates the Hijrah (migration) of Prophet Muhammad (ﷺ) and his companions from Makkah to Madinah, establishing the Islamic community and calendar.',
    category: 'history',
  },
  {
    id: 'day-of-ashura',
    hijriMonth: 1,
    hijriDay: 10,
    title: 'Day of Ashura',
    arabicTitle: 'يوم عاشوراء',
    urduTitle: 'یومِ عاشورہ',
    description: 'A deeply blessed day of voluntary fasting on the 10th of Muharram.',
    significance:
      'The Prophet (ﷺ) fasted on Ashura in gratitude for Allah saving Prophet Musa (عليه السلام). Fasting on Ashura expiates the sins of the previous year (Sahih Muslim); fasting the 9th alongside it is encouraged.',
    category: 'fasting',
  },
  {
    id: 'mawlid-al-nabi',
    hijriMonth: 3,
    hijriDay: 12,
    title: 'Mawlid al-Nabi',
    arabicTitle: 'ذكرى المولد النبوي',
    urduTitle: 'عید میلاد النبی / سیرت النبی ﷺ',
    description: 'Reflects on the life, mercy, and noble character (Seerah) of Prophet Muhammad (ﷺ).',
    significance:
      'Observed on 12 Rabi al-Awwal across many communities as an occasion to increase salutations (Durood/Salawat) upon the Prophet (ﷺ), charity, and studying the Seerah.',
    category: 'history',
  },
  {
    id: 'rajab-begins',
    hijriMonth: 7,
    hijriDay: 1,
    title: 'Rajab begins',
    arabicTitle: 'بداية شهر رجب',
    urduTitle: 'ماہِ رجب کا آغاز',
    description: 'One of the four sacred months in Islam when worship is especially rewarding.',
    significance:
      'Rajab is one of the Ashhur al-Hurum (Sacred Months) mentioned in the Quran (9:36). Scholars emphasize avoiding wrongdoing and intensifying sincere repentance, prayer, and voluntary charity.',
    category: 'sacred',
  },
  {
    id: 'isra-and-miraj',
    hijriMonth: 7,
    hijriDay: 27,
    title: "Isra and Mi'raj",
    arabicTitle: 'الإسراء والمعراج',
    urduTitle: 'شبِ معراج',
    description: 'Commemorates the Night Journey from Makkah to Jerusalem and Ascension to the heavens.',
    significance:
      'During this blessed night, Allah honored Prophet Muhammad (ﷺ) with the miraculous journey to Masjid al-Aqsa and the heavens, where the gift of the five daily Salah was prescribed.',
    category: 'history',
  },
  {
    id: 'shaban-begins',
    hijriMonth: 8,
    hijriDay: 1,
    title: "Sha'ban begins",
    arabicTitle: 'بداية شهر شعبان',
    urduTitle: 'ماہِ شعبان کا آغاز',
    description: 'The eighth Islamic month in which deeds are raised and hearts prepare for Ramadan.',
    significance:
      'The Prophet (ﷺ) used to fast more in Sha’ban than in any other month outside Ramadan (Sahih al-Bukhari & Muslim), preparing body and soul for the month of the Quran.',
    category: 'sacred',
  },
  {
    id: 'mid-shaban',
    hijriMonth: 8,
    hijriDay: 15,
    title: "Mid-Sha'ban",
    arabicTitle: 'ليلة النصف من شعبان',
    urduTitle: 'شبِ برات (نصف شعبان)',
    description: 'Fifteenth of Sha’ban, a blessed time to seek forgiveness and mend relationships.',
    significance:
      'Known in South Asia as Shab-e-Barat (Night of Forgiveness). Narrations encourage sincere Istighfar, reconciling quarrels, and preparing for the approaching fasts of Ramadan.',
    category: 'sacred',
  },
  {
    id: 'first-day-ramadan',
    hijriMonth: 9,
    hijriDay: 1,
    title: 'First day of Ramadan',
    arabicTitle: 'أول أيام شهر رمضان',
    urduTitle: 'یکم رمضان المبارک',
    description: 'Beginning of the blessed month of fasting, Quran recitation, and nightly Taraweeh.',
    significance:
      'Ramadan is the month in which the Holy Quran was revealed as guidance for humanity (2:185). The gates of Paradise open and believers strive in Sawm, Qiyam, and generosity.',
    category: 'ramadan',
  },
  {
    id: 'last-ten-nights',
    hijriMonth: 9,
    hijriDay: 21,
    title: 'Last ten nights begin',
    arabicTitle: 'بداية العشر الأواخر',
    urduTitle: 'آخری عشرہ کا آغاز',
    description: 'The final ten nights of Ramadan begin at sunset, including Laylat al-Qadr.',
    significance:
      'Aishah (رضي الله عنها) reported that during the last ten nights, the Prophet (ﷺ) tightened his waist-belt, stayed awake in prayer, and encouraged his family to worship.',
    category: 'ramadan',
  },
  {
    id: 'laylat-al-qadr',
    hijriMonth: 9,
    hijriDay: 27,
    title: 'Laylat al-Qadr',
    arabicTitle: 'ليلة القدر',
    urduTitle: 'شبِ قدر (۲۷ رمضان)',
    description: 'The Night of Decree, worshipped across the odd final nights and honored especially on the 27th.',
    significance:
      'Worship on Laylat al-Qadr is better than a thousand months (Surah al-Qadr 97:3). Recite frequently: "Allahumma innaka Afuwwun tuhibbul-afwa fa’fu anni."',
    category: 'ramadan',
  },
  {
    id: 'eid-al-fitr',
    hijriMonth: 10,
    hijriDay: 1,
    title: 'Eid al-Fitr',
    arabicTitle: 'عيد الفطر المبارك',
    urduTitle: 'عید الفطر',
    description: 'Joyous festival celebrating the completion of Ramadan fasting and gratitude to Allah.',
    significance:
      'Marked by discharging Zakat al-Fitr before Eid prayer, reciting Takbirat, wearing clean attire, gathering for congregational Eid Salah, and fostering kinship.',
    category: 'eid',
  },
  {
    id: 'six-fasts-shawwal',
    hijriMonth: 10,
    hijriDay: 2,
    title: 'Six fasts of Shawwal',
    arabicTitle: 'صيام ست من شوال',
    urduTitle: 'شوال کے چھ نفلی روزے',
    description: 'Voluntary period for fasting six days during Shawwal begins after Eid al-Fitr.',
    significance:
      'The Prophet (ﷺ) taught: "Whoever fasts Ramadan and follows it with six days of Shawwal will have a reward as though they fasted the entire year" (Sahih Muslim).',
    category: 'fasting',
  },
  {
    id: 'dhul-hijjah-begins',
    hijriMonth: 12,
    hijriDay: 1,
    title: 'Dhul Hijjah begins',
    arabicTitle: 'بداية ذي الحجة',
    urduTitle: 'ذوالحجہ کے مبارک عشرے کا آغاز',
    description: 'First of the ten greatest days of the Islamic year and the sacred month of Hajj.',
    significance:
      'Ibn Abbas (رضي الله عنهما) narrated that no days are more beloved to Allah for righteous deeds than these first ten days of Dhul Hijjah (Sahih al-Bukhari).',
    category: 'hajj',
  },
  {
    id: 'day-of-tarwiyah',
    hijriMonth: 12,
    hijriDay: 8,
    title: 'Day of Tarwiyah',
    arabicTitle: 'يوم التروية',
    urduTitle: 'یومِ ترویہ (۸ ذوالحجہ)',
    description: 'Pilgrims enter Ihram and depart Makkah for the plains of Mina to begin Hajj.',
    significance:
      'The 8th of Dhul Hijjah marks the formal opening of the annual Hajj rituals, filled with Talbiyah ("Labbayk Allahumma labbayk") and contemplation.',
    category: 'hajj',
  },
  {
    id: 'day-of-arafah',
    hijriMonth: 12,
    hijriDay: 9,
    title: 'Day of Arafah',
    arabicTitle: 'يوم عرفة',
    urduTitle: 'یومِ عرفہ',
    description: 'The pinnacle day of Hajj and the best day of the year for Dua and fasting.',
    significance:
      'Fasting on the Day of Arafah (for those not performing Hajj) expiates the minor sins of the previous year and the coming year (Sahih Muslim). Increase Tahleel, Takbir, and Dua.',
    category: 'hajj',
  },
  {
    id: 'eid-al-adha',
    hijriMonth: 12,
    hijriDay: 10,
    title: 'Eid al-Adha',
    arabicTitle: 'عيد الأضحى المبارك',
    urduTitle: 'عید الاضحیٰ',
    description: 'The Festival of Sacrifice honoring the devotion of Prophet Ibrahim (عليه السلام).',
    significance:
      'Observed with morning Eid Salah, Takbir al-Tashriq, Qurbani (Udhiyah) distributed among family, neighbors, and the needy, and gratitude for Allah’s blessings.',
    category: 'eid',
  },
  {
    id: 'days-of-tashriq',
    hijriMonth: 12,
    hijriDay: 11,
    title: 'Days of Tashriq',
    arabicTitle: 'أيام التشريق',
    urduTitle: 'ایامِ تشریق',
    description: 'Blessed days of remembrance, gratitude, and celebration (11–13 Dhul Hijjah).',
    significance:
      'Described by the Prophet (ﷺ) as days of eating, drinking, and remembering Allah (Sahih Muslim). Fasting is prohibited on Eid and these days; Takbirat continue after prayers.',
    category: 'eid',
  },
];

// Deterministic local date utilities (noon-normalized to prevent DST/TZ shifts)
export function toNoonDate(year: number, monthIndex0: number, day: number): Date {
  return new Date(year, monthIndex0, day, 12, 0, 0, 0);
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

// Fast mathematical Tabular/Kuwayti Hijri <-> JDN conversion as guaranteed fallback
export function hijriToJulianDay(hYear: number, hMonth: number, hDay: number): number {
  return (
    Math.floor((11 * hYear + 3) / 30) +
    354 * hYear +
    30 * hMonth -
    Math.floor((hMonth - 1) / 2) +
    hDay +
    1948440 -
    385
  );
}

export function julianDayToGregorian(jd: number): Date {
  let l = jd + 68569;
  const n = Math.floor((4 * l) / 146097);
  l = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l) / 2447);
  const day = l - Math.floor((2447 * j) / 80);
  l = Math.floor(j / 11);
  const month = j + 2 - 12 * l;
  const year = 100 * (n - 49) + i + l;
  return toNoonDate(year, month - 1, day);
}

export function gregorianToJulianDay(date: Date): number {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045
  );
}

export function tabularJulianToHijri(jd: number): { year: number; month: number; day: number } {
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

let cachedIntlFormatter: Intl.DateTimeFormat | null = null;
function getIntlHijriFormatter(): Intl.DateTimeFormat | null {
  if (cachedIntlFormatter) return cachedIntlFormatter;
  try {
    cachedIntlFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    return cachedIntlFormatter;
  } catch {
    try {
      cachedIntlFormatter = new Intl.DateTimeFormat('en-TN-u-ca-islamic-nu-latn', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      });
      return cachedIntlFormatter;
    } catch {
      return null;
    }
  }
}

export function getRawHijriNumbers(date: Date): { year: number; month: number; day: number } {
  const formatter = getIntlHijriFormatter();
  if (formatter) {
    try {
      const parts = formatter.formatToParts(date);
      const getNum = (t: string) => {
        const val = parts.find((p) => p.type === t)?.value || '';
        const digits = val.replace(/[^\d]/g, '');
        return parseInt(digits, 10) || 0;
      };
      const year = getNum('year');
      const month = getNum('month');
      const day = getNum('day');
      if (year >= 1300 && month >= 1 && month <= 12 && day >= 1 && day <= 30) {
        return { year, month, day };
      }
    } catch {
      // Fall back to deterministic math
    }
  }
  return tabularJulianToHijri(gregorianToJulianDay(date));
}

export function getHijriDateParts(date: Date): HijriDateParts {
  const { year, month, day } = getRawHijriNumbers(date);
  const meta = HIJRI_MONTHS[month - 1] || HIJRI_MONTHS[0];
  let urduFormatted = `${day} ${meta.urdu} ${year}`;
  try {
    const urFmt = new Intl.DateTimeFormat('ur-PK-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
    if (urFmt && urFmt.length > 3) urduFormatted = urFmt;
  } catch {
    // Keep clean constructed Urdu label
  }

  return {
    year,
    month,
    day,
    monthName: meta.name,
    monthAbbr: meta.abbr,
    urduMonthName: meta.urdu,
    formatted: `${day} ${meta.name} ${year}`,
    formattedWithAH: `${day} ${meta.name} ${year} AH`,
    urduFormatted,
  };
}

/**
 * Converts a target Hijri (year, month, day) into an exact Gregorian local Date,
 * using Tabular JDN as seed and Umm al-Qura Intl refinement across a ±5 day window.
 */
export function hijriToGregorianDate(hijriYear: number, hijriMonth: number, hijriDay: number): Date {
  const approx = julianDayToGregorian(hijriToJulianDay(hijriYear, hijriMonth, hijriDay));

  try {
    const probe = getRawHijriNumbers(approx);
    if (probe.year >= 1300) {
      for (let offset = -5; offset <= 5; offset++) {
        const candidate = toNoonDate(approx.getFullYear(), approx.getMonth(), approx.getDate() + offset);
        const h = getRawHijriNumbers(candidate);
        if (h.year === hijriYear && h.month === hijriMonth && h.day === hijriDay) {
          return candidate;
        }
      }
    }
  } catch {
    // Keep approx
  }

  return approx;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const FULL_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatGregorianShort(d: Date): string {
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatGregorianLong(d: Date): string {
  return `${FULL_WEEKDAYS[d.getDay()]} ${d.getDate()} ${FULL_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function buildEventForHijriYear(
  template: IslamicEventTemplate,
  hijriYear: number,
  referenceNow: Date = new Date()
): IslamicCalendarEvent {
  const gregorianDate = hijriToGregorianDate(hijriYear, template.hijriMonth, template.hijriDay);
  const monthMeta = HIJRI_MONTHS[template.hijriMonth - 1] || HIJRI_MONTHS[0];

  const todayMs = startOfLocalDay(referenceNow).getTime();
  const eventMs = startOfLocalDay(gregorianDate).getTime();
  const daysRemaining = Math.round((eventMs - todayMs) / 86400000);

  let countdownLabel = '';
  if (daysRemaining === 0) countdownLabel = 'Today';
  else if (daysRemaining === 1) countdownLabel = 'Tomorrow';
  else if (daysRemaining > 1) countdownLabel = `In ${daysRemaining} days`;
  else countdownLabel = `${Math.abs(daysRemaining)}d ago`;

  return {
    ...template,
    hijriYear,
    hijriMonthName: monthMeta.name,
    hijriMonthAbbr: monthMeta.abbr,
    hijriDateLabel: `${template.hijriDay} ${monthMeta.name}`,
    hijriFullLabel: `${template.hijriDay} ${monthMeta.name} ${hijriYear} AH`,
    gregorianDate,
    gregorianShort: formatGregorianShort(gregorianDate),
    gregorianLong: formatGregorianLong(gregorianDate),
    daysRemaining,
    countdownLabel,
  };
}

/**
 * Generates all 17 significant Islamic events for a given Hijri year in chronological order.
 */
export function getEventsForHijriYear(
  hijriYear: number,
  referenceNow: Date = new Date()
): IslamicCalendarEvent[] {
  return ISLAMIC_EVENT_TEMPLATES.map((tpl) => buildEventForHijriYear(tpl, hijriYear, referenceNow));
}

/**
 * Returns upcoming events starting from today across a rolling ~12–13 month window
 * so the "Coming up" section is always rich and complete at any point in the Hijri year.
 */
export function getUpcomingIslamicEvents(
  referenceNow: Date = new Date(),
  horizonDays: number = 380
): IslamicCalendarEvent[] {
  const currentHijri = getHijriDateParts(referenceNow);
  const combined = [
    ...getEventsForHijriYear(currentHijri.year, referenceNow),
    ...getEventsForHijriYear(currentHijri.year + 1, referenceNow),
  ];

  return combined
    .filter((ev) => ev.daysRemaining >= 0 && ev.daysRemaining <= horizonDays)
    .sort((a, b) => a.gregorianDate.getTime() - b.gregorianDate.getTime());
}
