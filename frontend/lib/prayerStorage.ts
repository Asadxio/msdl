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
}

const PRAYER_SETTINGS_KEY = "prayer_settings_v3";

export const DEFAULT_PRAYER_SETTINGS: PrayerSettings = {
  locationMode: "auto",
  latitude: 21.4225, // Default/Fallback to Makkah
  longitude: 39.8262,
  altitude: 0,
  city: "Location unavailable",
  state: "Permission needed",
  country: "Saudi Arabia",
  method: "auto",
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
