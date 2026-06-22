export type PrayerName = "Fajr" | "Sunrise" | "Ishraq" | "Chasht" | "Dahwa-e-Kubra" | "Zuhr" | "Asr" | "Maghrib" | "Isha" | "Tahajjud";
export type PrayerTime = { name: PrayerName; time: Date; label: string; kind: "fard" | "sun" | "nafl" | "marker" };
export type PrayerCalculationSettings = {
  method: string;
  fajrAngle: number;
  ishaAngle: number;
  asrFactor: 1 | 2;
};

export const PRAYER_METHODS: Record<string, PrayerCalculationSettings> = {
  muslimWorldLeague: {
    method: "Muslim World League",
    fajrAngle: 18,
    ishaAngle: 17,
    asrFactor: 1,
  },
  egyptian: {
    method: "Egyptian General Authority",
    fajrAngle: 19.5,
    ishaAngle: 17.5,
    asrFactor: 1,
  },
  karachi: {
    method: "University of Islamic Sciences, Karachi",
    fajrAngle: 18,
    ishaAngle: 18,
    asrFactor: 2,
  },
  ummAlQura: {
    method: "Umm al-Qura, Makkah",
    fajrAngle: 18.5,
    ishaAngle: 90 / 60,
    asrFactor: 1,
  },
  northAmerica: {
    method: "ISNA / North America",
    fajrAngle: 15,
    ishaAngle: 15,
    asrFactor: 1,
  },
};

export function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

export function normalizeHour(value: number) {
  return ((value % 24) + 24) % 24;
}

export function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

export function getPrayerCalculationSettings(
  country?: string,
): PrayerCalculationSettings {
  const normalizedCountry = (country || "").toLowerCase();
  if (/(pakistan|india|bangladesh|afghanistan)/.test(normalizedCountry)) {
    return PRAYER_METHODS.karachi;
  }
  if (/(saudi|arabia|makkah|mecca)/.test(normalizedCountry)) {
    return PRAYER_METHODS.ummAlQura;
  }
  if (/(egypt|sudan)/.test(normalizedCountry)) {
    return PRAYER_METHODS.egyptian;
  }
  if (/(united states|usa|canada|america)/.test(normalizedCountry)) {
    return PRAYER_METHODS.northAmerica;
  }
  return PRAYER_METHODS.muslimWorldLeague;
}

export function solarDeclination(date: Date) {
  return 23.45 * Math.sin(toRadians((360 / 365) * (284 + dayOfYear(date))));
}

export function asrZenith(date: Date, latitude: number, asrFactor: 1 | 2) {
  const declination = solarDeclination(date);
  const angle = toDegrees(
    Math.atan(
      1 / (asrFactor + Math.tan(toRadians(Math.abs(latitude - declination)))),
    ),
  );
  return 90 - angle;
}

export function formatClock(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function decimalToDate(base: Date, decimalHour: number) {
  const date = new Date(base);
  date.setHours(0, 0, 0, 0);
  date.setMinutes(Math.round(normalizeHour(decimalHour) * 60));
  return date;
}

export function solarTime(
  date: Date,
  latitude: number,
  longitude: number,
  zenith: number,
  afterNoon: boolean,
) {
  const n = dayOfYear(date);
  const lngHour = longitude / 15;
  const t = n + ((afterNoon ? 18 : 6) - lngHour) / 24;
  const m = 0.9856 * t - 3.289;
  let l =
    m +
    1.916 * Math.sin(toRadians(m)) +
    0.02 * Math.sin(toRadians(2 * m)) +
    282.634;
  l = ((l % 360) + 360) % 360;
  let ra = toDegrees(Math.atan(0.91764 * Math.tan(toRadians(l))));
  ra = ((ra % 360) + 360) % 360;
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
    (afterNoon
      ? toDegrees(Math.acos(cosH))
      : 360 - toDegrees(Math.acos(cosH))) / 15;
  const localMean = h + ra - 0.06571 * t - 6.622;
  const utc = localMean - lngHour;
  return normalizeHour(utc + -date.getTimezoneOffset() / 60);
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

export function calculatePrayerTimes(
  date: Date,
  latitude: number,
  longitude: number,
  settings: PrayerCalculationSettings = PRAYER_METHODS.muslimWorldLeague,
  altitude?: number,
): PrayerTime[] {
  const dip = altitude && altitude > 0 ? 0.0347 * Math.sqrt(altitude) : 0;
  const fajr = decimalToDate(date, solarTime(date, latitude, longitude, 90 + settings.fajrAngle + dip, false));
  const sunrise = decimalToDate(date, solarTime(date, latitude, longitude, 90.833 + dip, false));
  const sunset = decimalToDate(date, solarTime(date, latitude, longitude, 90.833 + dip, true));
  const zuhr = decimalToDate(date, normalizeHour((solarTime(date, latitude, longitude, 90.833, false) + solarTime(date, latitude, longitude, 90.833, true)) / 2 + 0.05));
  const isha = decimalToDate(date, settings.method === PRAYER_METHODS.ummAlQura.method
    ? normalizeHour(solarTime(date, latitude, longitude, 90.833 + dip, true) + settings.ishaAngle)
    : solarTime(date, latitude, longitude, 90 + settings.ishaAngle + dip, true));
  const tomorrowFajr = decimalToDate(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
    solarTime(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1), latitude, longitude, 90 + settings.fajrAngle + dip, false),
  );
  const nightMs = Math.max(1, tomorrowFajr.getTime() - isha.getTime());
  const tahajjud = new Date(isha.getTime() + (nightMs * 2) / 3);
  const dahwa = new Date(fajr.getTime() + (sunset.getTime() - fajr.getTime()) / 2);
  const times: PrayerTime[] = [
    { name: "Fajr", time: fajr, label: "", kind: "fard" },
    { name: "Sunrise", time: sunrise, label: "", kind: "sun" },
    { name: "Ishraq", time: addMinutes(sunrise, 15), label: "", kind: "nafl" },
    { name: "Chasht", time: addMinutes(sunrise, 120), label: "", kind: "nafl" },
    { name: "Dahwa-e-Kubra", time: dahwa, label: "", kind: "marker" },
    { name: "Zuhr", time: zuhr, label: "", kind: "fard" },
    {
      name: "Asr",
      time: decimalToDate(date, solarTime(date, latitude, longitude, asrZenith(date, latitude, settings.asrFactor), true)),
      label: "",
      kind: "fard",
    },
    { name: "Maghrib", time: addMinutes(sunset, 3), label: "", kind: "fard" },
    { name: "Isha", time: isha, label: "", kind: "fard" },
    { name: "Tahajjud", time: tahajjud, label: "", kind: "nafl" },
  ];
  return times
    .sort((a, b) => a.time.getTime() - b.time.getTime())
    .map((item) => ({ ...item, label: formatClock(item.time) }));
}

export function getPrayerWindow(
  prayers: PrayerTime[],
  now: Date,
  latitude: number,
  longitude: number,
  settings: PrayerCalculationSettings,
  altitude?: number,
) {
  const today = prayers;
  const tomorrow = calculatePrayerTimes(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    latitude,
    longitude,
    settings,
    altitude,
  );
  const previous =
    [...today].reverse().find((item) => item.time <= now) ||
    today[today.length - 1];
  const next = today.find((item) => item.time > now) || tomorrow[0];
  const prevTime =
    previous.time <= now
      ? previous.time
      : new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 1,
          previous.time.getHours(),
          previous.time.getMinutes(),
        );
  const duration = Math.max(1, next.time.getTime() - prevTime.getTime());
  const elapsed = Math.max(0, now.getTime() - prevTime.getTime());
  return { current: previous, next, progress: Math.min(1, elapsed / duration) };
}
