import AsyncStorage from "@react-native-async-storage/async-storage";

export type LocationMode = "auto" | "search" | "manual";

export interface PrayerSettings {
  locationMode: LocationMode;
  latitude: number;
  longitude: number;
  altitude?: number;
  city: string;
  state: string;
  country: string;
  method: "auto" | "muslimWorldLeague" | "egyptian" | "karachi" | "ummAlQura" | "northAmerica";
  shafaqType?: "ahmar" | "abyad";
  asrFactor?: 1 | 2;
}

export interface QazaRecord {
  fajr: number;
  zuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

const PRAYER_SETTINGS_KEY = "prayer_settings_v4";
export const QAZA_STORAGE_KEY = "@msdl_qaza_namaz_record";

export const DEFAULT_PRAYER_SETTINGS: PrayerSettings = {
  locationMode: "auto",
  latitude: 21.4225,
  longitude: 39.8262,
  altitude: 0,
  city: "Location unavailable",
  state: "Permission needed",
  country: "Saudi Arabia",
  method: "auto",
  shafaqType: "abyad",
  asrFactor: 2,
};

type SettingsListener = (settings: PrayerSettings) => void;
const listeners = new Set<SettingsListener>();

export function subscribeToPrayerSettings(listener: SettingsListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyPrayerSettingsChanged(settings: PrayerSettings) {
  listeners.forEach((l) => {
    try {
      l(settings);
    } catch (e) {
      console.error("Error in prayer settings listener:", e);
    }
  });
}

export async function loadPrayerSettings(): Promise<PrayerSettings> {
  try {
    const data = await AsyncStorage.getItem(PRAYER_SETTINGS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return { ...DEFAULT_PRAYER_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error("Failed to load prayer settings:", error);
  }
  return DEFAULT_PRAYER_SETTINGS;
}

export async function savePrayerSettings(settings: PrayerSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(PRAYER_SETTINGS_KEY, JSON.stringify(settings));
    notifyPrayerSettingsChanged(settings);
  } catch (error) {
    console.error("Failed to save prayer settings:", error);
  }
}

export const DEFAULT_QAZA_RECORD: QazaRecord = { fajr: 0, zuhr: 0, asr: 0, maghrib: 0, isha: 0 };

export async function loadQazaRecord(): Promise<QazaRecord> {
  try {
    const raw = await AsyncStorage.getItem(QAZA_STORAGE_KEY);
    if (raw) return { ...DEFAULT_QAZA_RECORD, ...JSON.parse(raw) };
  } catch (e) {
    console.warn("Failed to load Qaza record:", e);
  }
  return { ...DEFAULT_QAZA_RECORD };
}

export async function saveQazaRecord(record: QazaRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(QAZA_STORAGE_KEY, JSON.stringify(record));
  } catch (e) {
    console.warn("Failed to save Qaza record:", e);
  }
}
