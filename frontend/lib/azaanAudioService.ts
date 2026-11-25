import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { AZAAN_RECITATIONS, DEFAULT_AZAAN_PREFERENCE } from '@/constants/azaanData';
import { AzaanPreference, AzaanRecitation } from '@/types/islamic';

const AZAAN_PREF_KEY = '@suffah_azaan_preferences_v1';

let activeSound: Audio.Sound | null = null;
let currentAzaanId: string | null = null;

export type AudioPlaybackState = {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  isBuffering: boolean;
  azaanId: string | null;
};

type PlaybackListener = (state: AudioPlaybackState) => void;
const listeners = new Set<PlaybackListener>();

function notifyListeners(state: AudioPlaybackState) {
  listeners.forEach((l) => {
    try {
      l(state);
    } catch {}
  });
}

export function subscribeToAzaanPlayback(listener: PlaybackListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAzaanRecitations(): AzaanRecitation[] {
  return AZAAN_RECITATIONS;
}

export function getAzaanById(id: string): AzaanRecitation | undefined {
  return AZAAN_RECITATIONS.find((a) => a.id === id);
}

export async function getAzaanPreferences(): Promise<AzaanPreference> {
  try {
    const raw = await AsyncStorage.getItem(AZAAN_PREF_KEY);
    if (raw) {
      return { ...DEFAULT_AZAAN_PREFERENCE, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_AZAAN_PREFERENCE;
}

export async function saveAzaanPreferences(prefs: AzaanPreference): Promise<void> {
  try {
    await AsyncStorage.setItem(AZAAN_PREF_KEY, JSON.stringify(prefs));
  } catch {}
}

/**
 * Configure audio mode for high-quality Devotional / Azaan playback
 */
export async function initializeAudioMode(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (err) {
    console.warn('[AzaanAudio] Audio mode initialization warning:', err);
  }
}

/**
 * Play an Azaan recitation
 */
export async function playAzaan(azaanId: string): Promise<void> {
  const item = getAzaanById(azaanId);
  if (!item) return;

  await stopAzaan();
  await initializeAudioMode();

  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: item.audioUrl },
      { shouldPlay: true, volume: 1.0 },
      (status) => {
        if (!status.isLoaded) {
          notifyListeners({
            isPlaying: false,
            positionMs: 0,
            durationMs: 0,
            isBuffering: true,
            azaanId,
          });
          return;
        }

        notifyListeners({
          isPlaying: status.isPlaying,
          positionMs: status.positionMillis || 0,
          durationMs: status.durationMillis || item.durationSeconds * 1000,
          isBuffering: status.isBuffering,
          azaanId,
        });

        if (status.didJustFinish) {
          currentAzaanId = null;
        }
      }
    );

    activeSound = sound;
    currentAzaanId = azaanId;
  } catch (err) {
    console.error('[AzaanAudio] Failed to load sound:', err);
    notifyListeners({
      isPlaying: false,
      positionMs: 0,
      durationMs: 0,
      isBuffering: false,
      azaanId: null,
    });
  }
}

/**
 * Pause active Azaan
 */
export async function pauseAzaan(): Promise<void> {
  if (activeSound) {
    try {
      await activeSound.pauseAsync();
    } catch {}
  }
}

/**
 * Resume active Azaan
 */
export async function resumeAzaan(): Promise<void> {
  if (activeSound) {
    try {
      await activeSound.playAsync();
    } catch {}
  }
}

/**
 * Stop and unload active Azaan
 */
export async function stopAzaan(): Promise<void> {
  if (activeSound) {
    try {
      await activeSound.stopAsync();
      await activeSound.unloadAsync();
    } catch {}
    activeSound = null;
    currentAzaanId = null;
  }
  notifyListeners({
    isPlaying: false,
    positionMs: 0,
    durationMs: 0,
    isBuffering: false,
    azaanId: null,
  });
}

/**
 * Seek to a position in milliseconds
 */
export async function seekAzaan(positionMs: number): Promise<void> {
  if (activeSound) {
    try {
      await activeSound.setPositionAsync(positionMs);
    } catch {}
  }
}

/**
 * Return currently playing Azaan ID
 */
export function getCurrentPlayingAzaanId(): string | null {
  return currentAzaanId;
}
