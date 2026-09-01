// ─────────────────────────────────────────────────────────────────────────────
// MSDL — Advanced Islamic Prayer Times Engine (Tauqeet-Level)
// Based on: Astronomical Algorithms (Jean Meeus) + Hanafi Fiqh
// Supports: Shafaq Ahmar/Abyad, Monthly Grid, Moon Phase, Sun Arc, Makruh Windows
// ─────────────────────────────────────────────────────────────────────────────

export type PrayerName =
  | 'Fajr'
  | 'Sunrise'
  | 'Ishraq'
  | 'Chasht'
  | 'Dahwa-e-Kubra'
  | 'Zawal'
  | 'Zuhr'
  | 'Asr'
  | 'Maghrib'
  | 'Isha'
  | 'Tahajjud';

export type PrayerKind = 'fard' | 'sun' | 'nafl' | 'marker' | 'makruh';

export interface PrayerTime {
  name: PrayerName;
  time: Date;
  label: string;
  urduName: string;
  kind: PrayerKind;
  isMakruh?: boolean;
  makruhNote?: string;
}

export interface MakruhWindow {
  label: string;
  urduLabel: string;
  start: Date;
  end: Date;
  reason: string;
}

export interface MoonPhaseInfo {
  phase: number;
  phaseName: string;
  urduPhaseName: string;
  emoji: string;
  illumination: number;
  daysToFullMoon: number;
  daysToNewMoon: number;
}

export interface PrayerCalculationSettings {
  method: string;
  fajrAngle: number;
  ishaAngle: number;
  asrFactor: 1 | 2;
  shafaqType?: 'ahmar' | 'abyad';
}

export interface DailyPrayerRow {
  date: Date;
  dateStr: string;
  hijriDay: number;
  fajr: string;
  sunrise: string;
  zuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export const PRAYER_METHODS: Record<string, PrayerCalculationSettings> = {
  muslimWorldLeague: {
    method: 'Muslim World League',
    fajrAngle: 18,
    ishaAngle: 17,
    asrFactor: 1,
    shafaqType: 'abyad',
  },
  egyptian: {
    method: 'Egyptian General Authority',
    fajrAngle: 19.5,
    ishaAngle: 17.5,
    asrFactor: 1,
    shafaqType: 'ahmar',
  },
  karachi: {
    method: 'University of Islamic Sciences, Karachi (Hanafi)',
    fajrAngle: 18,
    ishaAngle: 18,
    asrFactor: 2,
    shafaqType: 'abyad',
  },
  ummAlQura: {
    method: 'Umm al-Qura, Makkah',
    fajrAngle: 18.5,
    ishaAngle: 90 / 60,
    asrFactor: 1,
    shafaqType: 'ahmar',
  },
  northAmerica: {
    method: 'ISNA / North America',
    fajrAngle: 15,
    ishaAngle: 15,
    asrFactor: 1,
    shafaqType: 'abyad',
  },
};

export function toRadians(value: number) { return (value * Math.PI) / 180; }
export function toDegrees(value: number) { return (value * 180) / Math.PI; }
export function normalizeHour(value: number) { return ((value % 24) + 24) % 24; }
export function normalizeDeg(value: number) { return ((value % 360) + 360) % 360; }

export function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

export function decimalToDate(base: Date, decimalHour: number): Date {
  const date = new Date(base);
  date.setHours(0, 0, 0, 0);
  date.setMinutes(Math.round(normalizeHour(decimalHour) * 60));
  return date;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatClockShort(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function getPrayerCalculationSettings(country?: string): PrayerCalculationSettings {
  const c = (country || '').toLowerCase();
  if (/(pakistan|india|bangladesh|afghanistan)/.test(c)) return PRAYER_METHODS.karachi;
  if (/(saudi|arabia|makkah|mecca)/.test(c)) return PRAYER_METHODS.ummAlQura;
  if (/(egypt|sudan)/.test(c)) return PRAYER_METHODS.egyptian;
  if (/(united states|usa|canada|america)/.test(c)) return PRAYER_METHODS.northAmerica;
  return PRAYER_METHODS.muslimWorldLeague;
}

export function solarDeclination(date: Date): number {
  return 23.45 * Math.sin(toRadians((360 / 365) * (284 + dayOfYear(date))));
}

export function solarTime(
  date: Date,
  latitude: number,
  longitude: number,
  zenith: number,
  afterNoon: boolean,
): number {
  const n = dayOfYear(date);
  const lngHour = longitude / 15;
  const t = n + ((afterNoon ? 18 : 6) - lngHour) / 24;
  const m = 0.9856 * t - 3.289;
  let l = m + 1.916 * Math.sin(toRadians(m)) + 0.02 * Math.sin(toRadians(2 * m)) + 282.634;
  l = normalizeDeg(l);
  let ra = toDegrees(Math.atan(0.91764 * Math.tan(toRadians(l))));
  ra = normalizeDeg(ra);
  const lQuadrant = Math.floor(l / 90) * 90;
  const raQuadrant = Math.floor(ra / 90) * 90;
  ra = (ra + (lQuadrant - raQuadrant)) / 15;
  const sinDec = 0.39782 * Math.sin(toRadians(l));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH =
    (Math.cos(toRadians(zenith)) - sinDec * Math.sin(toRadians(latitude))) /
    (cosDec * Math.cos(toRadians(latitude)));
  if (cosH > 1 || cosH < -1) return afterNoon ? 18 : 6;
  const h =
    (afterNoon ? toDegrees(Math.acos(cosH)) : 360 - toDegrees(Math.acos(cosH))) / 15;
  const localMean = h + ra - 0.06571 * t - 6.622;
  const utc = localMean - lngHour;
  return normalizeHour(utc + -date.getTimezoneOffset() / 60);
}

export function asrZenith(date: Date, latitude: number, asrFactor: 1 | 2): number {
  const declination = solarDeclination(date);
  const angle = toDegrees(
    Math.atan(1 / (asrFactor + Math.tan(toRadians(Math.abs(latitude - declination)))))
  );
  return 90 - angle;
}

export function getSunProgressPercent(now: Date, fajr: Date, isha: Date): number {
  const totalMs = Math.max(1, isha.getTime() - fajr.getTime());
  const elapsed = now.getTime() - fajr.getTime();
  return Math.min(100, Math.max(0, (elapsed / totalMs) * 100));
}

export function getMakruhWindows(sunrise: Date, sunset: Date, zawal: Date): MakruhWindow[] {
  return [
    {
      label: 'Sunrise (Makruh)',
      urduLabel: 'طلوعِ آفتاب (مکروہ وقت)',
      start: addMinutes(sunrise, -5),
      end: addMinutes(sunrise, 20),
      reason: 'صلاۃ مکروہ ہے: طلوعِ آفتاب سے پہلے 5 منٹ اور طلوع کے بعد 20 منٹ تک نماز پڑھنا مکروہ تحریمی ہے۔',
    },
    {
      label: 'Zawal / Solar Noon (Makruh)',
      urduLabel: 'زوال (مکروہ وقت)',
      start: addMinutes(zawal, -5),
      end: addMinutes(zawal, 5),
      reason: 'صلاۃ مکروہ ہے: عین زوال (نصف النہار) کے وقت نماز پڑھنا مکروہ تحریمی ہے۔',
    },
    {
      label: 'Sunset (Makruh)',
      urduLabel: 'غروبِ آفتاب (مکروہ وقت)',
      start: addMinutes(sunset, -20),
      end: addMinutes(sunset, 5),
      reason: 'صلاۃ مکروہ ہے: غروبِ آفتاب سے 20 منٹ پہلے سے نماز پڑھنا مکروہ تحریمی ہے۔',
    },
  ];
}

export function calculateMoonPhase(date: Date): MoonPhaseInfo {
  const knownNewMoon = new Date('2024-01-11T11:57:00Z').getTime();
  const synodicMonth = 29.53058867;
  const diffDays = (date.getTime() - knownNewMoon) / (1000 * 60 * 60 * 24);
  const cycleProgress = ((diffDays % synodicMonth) + synodicMonth) % synodicMonth;
  const phase = Math.floor(cycleProgress);
  const illumination = (1 - Math.cos(toRadians((cycleProgress / synodicMonth) * 360))) / 2;
  const daysToFullMoon = phase < 15 ? 15 - phase : Math.round(synodicMonth) + 15 - phase;
  const daysToNewMoon = Math.round(synodicMonth) - phase;

  let phaseName = '';
  let urduPhaseName = '';
  let emoji = '';

  if (phase === 0) { phaseName = 'New Moon'; urduPhaseName = 'نیا چاند'; emoji = '🌑'; }
  else if (phase < 7) { phaseName = 'Waxing Crescent'; urduPhaseName = 'ہلال (بڑھتا چاند)'; emoji = '🌒'; }
  else if (phase === 7) { phaseName = 'First Quarter'; urduPhaseName = 'پہلا ربع'; emoji = '🌓'; }
  else if (phase < 15) { phaseName = 'Waxing Gibbous'; urduPhaseName = 'بدر کے قریب'; emoji = '🌔'; }
  else if (phase === 15) { phaseName = 'Full Moon'; urduPhaseName = 'چودھویں کا چاند (بدر)'; emoji = '🌕'; }
  else if (phase < 22) { phaseName = 'Waning Gibbous'; urduPhaseName = 'گھٹتا چاند'; emoji = '🌖'; }
  else if (phase === 22) { phaseName = 'Last Quarter'; urduPhaseName = 'آخری ربع'; emoji = '🌗'; }
  else { phaseName = 'Waning Crescent'; urduPhaseName = 'باریک ہلال'; emoji = '🌘'; }

  return { phase, phaseName, urduPhaseName, emoji, illumination, daysToFullMoon, daysToNewMoon };
}

export function getHijriDate(date: Date, maghribTime?: Date): string {
  let targetDate = new Date(date);
  if (maghribTime && date.getTime() > maghribTime.getTime()) {
    targetDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  }
  try {
    return targetDate.toLocaleDateString('en-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function getHijriDayNumber(date: Date, maghribTime?: Date): number {
  let targetDate = new Date(date);
  if (maghribTime && date.getTime() > maghribTime.getTime()) {
    targetDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  }
  try {
    const str = targetDate.toLocaleDateString('en-u-ca-islamic-umalqura', { day: 'numeric' });
    return parseInt(str) || 0;
  } catch {
    return 0;
  }
}

export function calculatePrayerTimes(
  date: Date,
  latitude: number,
  longitude: number,
  settings: PrayerCalculationSettings = PRAYER_METHODS.muslimWorldLeague,
  altitude?: number,
): PrayerTime[] {
  const dip = altitude && altitude > 0 ? 0.0347 * Math.sqrt(altitude) : 0;

  const fajrDecimal = solarTime(date, latitude, longitude, 90 + settings.fajrAngle + dip, false);
  const sunriseDecimal = solarTime(date, latitude, longitude, 90.833 + dip, false);
  const sunsetDecimal = solarTime(date, latitude, longitude, 90.833 + dip, true);
  const solarNoonDecimal = (sunriseDecimal + sunsetDecimal) / 2;
  const zuhrDecimal = normalizeHour(solarNoonDecimal + 0.05);

  const ishaAngle = settings.shafaqType === 'ahmar' ? 12 : settings.ishaAngle;
  let ishaDecimal: number;
  if (settings.method === PRAYER_METHODS.ummAlQura.method) {
    ishaDecimal = normalizeHour(sunsetDecimal + settings.ishaAngle);
  } else {
    ishaDecimal = solarTime(date, latitude, longitude, 90 + ishaAngle + dip, true);
  }

  const fajr = decimalToDate(date, fajrDecimal);
  const sunrise = decimalToDate(date, sunriseDecimal);
  const zawal = decimalToDate(date, solarNoonDecimal);
  const zuhr = decimalToDate(date, zuhrDecimal);
  const sunset = decimalToDate(date, sunsetDecimal);
  const isha = decimalToDate(date, ishaDecimal);

  const asr = decimalToDate(
    date,
    solarTime(date, latitude, longitude, asrZenith(date, latitude, settings.asrFactor), true)
  );

  const ishraq = addMinutes(sunrise, 20);
  const chasht = addMinutes(sunrise, 120);
  const dahwa = new Date(fajr.getTime() + (sunset.getTime() - fajr.getTime()) / 2);
  const maghrib = addMinutes(sunset, 3);

  const tomorrowFajr = decimalToDate(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
    solarTime(
      new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
      latitude, longitude, 90 + settings.fajrAngle + dip, false,
    ),
  );
  const nightMs = Math.max(1, tomorrowFajr.getTime() - isha.getTime());
  const tahajjud = new Date(isha.getTime() + (nightMs * 2) / 3);

  const times: PrayerTime[] = [
    { name: 'Fajr', time: fajr, label: '', urduName: 'صبحِ صادق', kind: 'fard' },
    { name: 'Sunrise', time: sunrise, label: '', urduName: 'طلوعِ آفتاب', kind: 'sun', isMakruh: true, makruhNote: 'مکروہ وقت: طلوع سے 20 منٹ بعد تک' },
    { name: 'Ishraq', time: ishraq, label: '', urduName: 'اشراق', kind: 'nafl' },
    { name: 'Chasht', time: chasht, label: '', urduName: 'چاشت', kind: 'nafl' },
    { name: 'Dahwa-e-Kubra', time: dahwa, label: '', urduName: 'ضحوۂ کبریٰ', kind: 'marker' },
    { name: 'Zawal', time: zawal, label: '', urduName: 'زوال (مکروہ)', kind: 'makruh', isMakruh: true, makruhNote: 'عین زوال پر نماز مکروہ تحریمی ہے' },
    { name: 'Zuhr', time: zuhr, label: '', urduName: 'ظہر', kind: 'fard' },
    { name: 'Asr', time: asr, label: '', urduName: 'عصر', kind: 'fard' },
    { name: 'Maghrib', time: maghrib, label: '', urduName: 'مغرب + افطار', kind: 'fard' },
    { name: 'Isha', time: isha, label: '', urduName: 'عشاء', kind: 'fard' },
    { name: 'Tahajjud', time: tahajjud, label: '', urduName: 'تہجد', kind: 'nafl' },
  ];

  return times
    .sort((a, b) => a.time.getTime() - b.time.getTime())
    .map((item) => ({ ...item, label: formatClock(item.time) }));
}

export function getMonthlyPrayerTimes(
  year: number,
  month: number,
  latitude: number,
  longitude: number,
  settings: PrayerCalculationSettings,
  altitude?: number,
): DailyPrayerRow[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows: DailyPrayerRow[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const times = calculatePrayerTimes(date, latitude, longitude, settings, altitude);
    const get = (name: string) => {
      const t = times.find((p) => p.name === name);
      return t ? formatClockShort(t.time) : '--:--';
    };
    const maghribTime = times.find((p) => p.name === 'Maghrib')?.time;
    rows.push({
      date,
      dateStr: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      hijriDay: getHijriDayNumber(date, maghribTime),
      fajr: get('Fajr'),
      sunrise: get('Sunrise'),
      zuhr: get('Zuhr'),
      asr: get('Asr'),
      maghrib: get('Maghrib'),
      isha: get('Isha'),
    });
  }
  return rows;
}

export function getPrayerWindow(
  prayers: PrayerTime[],
  now: Date,
  latitude: number,
  longitude: number,
  settings: PrayerCalculationSettings,
  altitude?: number,
) {
  const fardPrayers = prayers.filter((p) => p.kind === 'fard');
  const tomorrow = calculatePrayerTimes(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    latitude, longitude, settings, altitude,
  ).filter((p) => p.kind === 'fard');

  const previous =
    [...fardPrayers].reverse().find((item) => item.time <= now) ||
    fardPrayers[fardPrayers.length - 1];
  const next = fardPrayers.find((item) => item.time > now) || tomorrow[0];

  const prevTime =
    previous.time <= now
      ? previous.time
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1,
          previous.time.getHours(), previous.time.getMinutes());

  const duration = Math.max(1, next.time.getTime() - prevTime.getTime());
  const elapsed = Math.max(0, now.getTime() - prevTime.getTime());
  return { current: previous, next, progress: Math.min(1, elapsed / duration) };
}
