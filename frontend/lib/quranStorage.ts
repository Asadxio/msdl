import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage Keys ─────────────────────────────────────────────────────────────
export const QURAN_LAST_READ_KEY = '@msdl_quran_last_read';
export const QURAN_BOOKMARKS_KEY = '@msdl_quran_bookmarks';
export const QURAN_KHATAM_KEY = '@msdl_quran_khatam';
export const QURAN_HIFZ_KEY = '@msdl_quran_hifz';
export const QURAN_DAILY_AYAT_KEY = '@msdl_quran_daily_ayat';
export const QURAN_CACHE_PREFIX = '@msdl_quran_cache_';
export const QURAN_FONT_SIZE_KEY = '@msdl_quran_font_size';
export const QURAN_SHOW_ROMAN_KEY = '@msdl_quran_show_roman';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LastRead {
  surahNumber: number;
  ayatNumber: number;
  surahName: string;
  timestamp: number;
}

export interface QuranBookmark {
  surahNumber: number;
  ayatNumber: number;
  surahName: string;
  arabicText: string;
  savedAt: number;
}

export interface KhatamProgress {
  ayatsRead: number;   // total ayats read across all reading sessions
  totalAyat: number;   // 6236
  startedAt: number;
  lastReadAt: number;
  completions: number; // number of full Khatams completed
}

export interface HifzProgress {
  completedParahs: number[];   // e.g. [30, 29, 28] — parah numbers memorized
  completedSurahs: number[];   // surah numbers memorized
  lastUpdated: number;
}

export interface DailyAyatCache {
  surahNumber: number;
  ayatNumber: number;
  arabic: string;
  roman: string;
  urduMeaning: string;
  surahName: string;
  cachedDate: string; // YYYY-MM-DD
}

// ─── Default Values ───────────────────────────────────────────────────────────
export const DEFAULT_KHATAM: KhatamProgress = {
  ayatsRead: 0,
  totalAyat: 6236,
  startedAt: Date.now(),
  lastReadAt: Date.now(),
  completions: 0,
};

export const DEFAULT_HIFZ: HifzProgress = {
  completedParahs: [],
  completedSurahs: [],
  lastUpdated: Date.now(),
};

// ─── Last Read ────────────────────────────────────────────────────────────────
export async function saveLastRead(data: LastRead): Promise<void> {
  try {
    await AsyncStorage.setItem(QURAN_LAST_READ_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('saveLastRead error:', e);
  }
}

export async function loadLastRead(): Promise<LastRead | null> {
  try {
    const raw = await AsyncStorage.getItem(QURAN_LAST_READ_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────
export async function loadBookmarks(): Promise<QuranBookmark[]> {
  try {
    const raw = await AsyncStorage.getItem(QURAN_BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function addBookmark(bookmark: QuranBookmark): Promise<void> {
  try {
    const existing = await loadBookmarks();
    const filtered = existing.filter(
      (b) => !(b.surahNumber === bookmark.surahNumber && b.ayatNumber === bookmark.ayatNumber)
    );
    await AsyncStorage.setItem(QURAN_BOOKMARKS_KEY, JSON.stringify([bookmark, ...filtered]));
  } catch (e) {
    console.warn('addBookmark error:', e);
  }
}

export async function removeBookmark(surahNumber: number, ayatNumber: number): Promise<void> {
  try {
    const existing = await loadBookmarks();
    const filtered = existing.filter(
      (b) => !(b.surahNumber === surahNumber && b.ayatNumber === ayatNumber)
    );
    await AsyncStorage.setItem(QURAN_BOOKMARKS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('removeBookmark error:', e);
  }
}

export async function isBookmarked(surahNumber: number, ayatNumber: number): Promise<boolean> {
  const bookmarks = await loadBookmarks();
  return bookmarks.some((b) => b.surahNumber === surahNumber && b.ayatNumber === ayatNumber);
}

// ─── Khatam Tracker ───────────────────────────────────────────────────────────
export async function loadKhatamProgress(): Promise<KhatamProgress> {
  try {
    const raw = await AsyncStorage.getItem(QURAN_KHATAM_KEY);
    return raw ? { ...DEFAULT_KHATAM, ...JSON.parse(raw) } : { ...DEFAULT_KHATAM };
  } catch (e) {
    return { ...DEFAULT_KHATAM };
  }
}

export async function incrementKhatamAyats(count: number = 1): Promise<KhatamProgress> {
  const current = await loadKhatamProgress();
  const newAyatsRead = current.ayatsRead + count;
  const completions = Math.floor(newAyatsRead / current.totalAyat);
  const updated: KhatamProgress = {
    ...current,
    ayatsRead: newAyatsRead,
    completions,
    lastReadAt: Date.now(),
  };
  await AsyncStorage.setItem(QURAN_KHATAM_KEY, JSON.stringify(updated));
  return updated;
}

export async function resetKhatam(): Promise<void> {
  await AsyncStorage.setItem(QURAN_KHATAM_KEY, JSON.stringify({ ...DEFAULT_KHATAM, startedAt: Date.now() }));
}

// ─── Hifz Tracker ─────────────────────────────────────────────────────────────
export async function loadHifzProgress(): Promise<HifzProgress> {
  try {
    const raw = await AsyncStorage.getItem(QURAN_HIFZ_KEY);
    return raw ? { ...DEFAULT_HIFZ, ...JSON.parse(raw) } : { ...DEFAULT_HIFZ };
  } catch (e) {
    return { ...DEFAULT_HIFZ };
  }
}

export async function toggleParahHifz(parahNumber: number): Promise<HifzProgress> {
  const current = await loadHifzProgress();
  const isCompleted = current.completedParahs.includes(parahNumber);
  const updated: HifzProgress = {
    ...current,
    completedParahs: isCompleted
      ? current.completedParahs.filter((p) => p !== parahNumber)
      : [...current.completedParahs, parahNumber],
    lastUpdated: Date.now(),
  };
  await AsyncStorage.setItem(QURAN_HIFZ_KEY, JSON.stringify(updated));
  return updated;
}

export async function toggleSurahHifz(surahNumber: number): Promise<HifzProgress> {
  const current = await loadHifzProgress();
  const isCompleted = current.completedSurahs.includes(surahNumber);
  const updated: HifzProgress = {
    ...current,
    completedSurahs: isCompleted
      ? current.completedSurahs.filter((s) => s !== surahNumber)
      : [...current.completedSurahs, surahNumber],
    lastUpdated: Date.now(),
  };
  await AsyncStorage.setItem(QURAN_HIFZ_KEY, JSON.stringify(updated));
  return updated;
}

// ─── Daily Ayat Cache ─────────────────────────────────────────────────────────
export async function loadDailyAyat(): Promise<DailyAyatCache | null> {
  try {
    const raw = await AsyncStorage.getItem(QURAN_DAILY_AYAT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function saveDailyAyat(ayat: DailyAyatCache): Promise<void> {
  try {
    await AsyncStorage.setItem(QURAN_DAILY_AYAT_KEY, JSON.stringify(ayat));
  } catch (e) {
    console.warn('saveDailyAyat error:', e);
  }
}

// ─── Surah Cache ──────────────────────────────────────────────────────────────
export async function loadCachedSurah(surahNumber: number): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(QURAN_CACHE_PREFIX + surahNumber);
  } catch (e) {
    return null;
  }
}

export async function cacheSurah(surahNumber: number, data: string): Promise<void> {
  try {
    await AsyncStorage.setItem(QURAN_CACHE_PREFIX + surahNumber, data);
  } catch (e) {
    console.warn('cacheSurah error:', e);
  }
}

// ─── Font & Display Preferences ──────────────────────────────────────────────
export async function loadFontSize(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(QURAN_FONT_SIZE_KEY);
    return raw ? parseInt(raw) : 22;
  } catch (e) {
    return 22;
  }
}

export async function saveFontSize(size: number): Promise<void> {
  await AsyncStorage.setItem(QURAN_FONT_SIZE_KEY, size.toString());
}

export async function loadShowRoman(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(QURAN_SHOW_ROMAN_KEY);
    return raw !== null ? raw === 'true' : true;
  } catch (e) {
    return true;
  }
}

export async function saveShowRoman(show: boolean): Promise<void> {
  await AsyncStorage.setItem(QURAN_SHOW_ROMAN_KEY, show.toString());
}

// ─── Audio Playback State & Speed Preferences ────────────────────────────────
export const QURAN_AUDIO_PLAYBACK_PREFIX = '@msdl_quran_audio_pos_';
export const QURAN_AUDIO_SPEED_KEY = '@msdl_quran_audio_speed';
export const DARS_AUDIO_PLAYBACK_PREFIX = '@msdl_dars_audio_pos_';

export interface QuranAudioPlaybackState {
  surahNumber: number;
  ayatNumber: number;
  positionMillis: number;
  durationMillis?: number;
  playbackRate: number;
  timestamp: number;
}

export async function saveQuranAudioPlayback(state: QuranAudioPlaybackState): Promise<void> {
  try {
    await AsyncStorage.setItem(
      QURAN_AUDIO_PLAYBACK_PREFIX + state.surahNumber,
      JSON.stringify(state)
    );
  } catch (e) {
    console.warn('saveQuranAudioPlayback error:', e);
  }
}

export async function loadQuranAudioPlayback(surahNumber: number): Promise<QuranAudioPlaybackState | null> {
  try {
    const raw = await AsyncStorage.getItem(QURAN_AUDIO_PLAYBACK_PREFIX + surahNumber);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function savePreferredAudioSpeed(speed: number): Promise<void> {
  try {
    await AsyncStorage.setItem(QURAN_AUDIO_SPEED_KEY, speed.toString());
  } catch (e) {
    console.warn('savePreferredAudioSpeed error:', e);
  }
}

export async function loadPreferredAudioSpeed(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(QURAN_AUDIO_SPEED_KEY);
    return raw ? parseFloat(raw) : 1.0;
  } catch (e) {
    return 1.0;
  }
}

export async function saveDarsPlaybackPosition(lessonId: string, positionSeconds: number, speed: number = 1.0): Promise<void> {
  try {
    await AsyncStorage.setItem(
      DARS_AUDIO_PLAYBACK_PREFIX + lessonId,
      JSON.stringify({ positionSeconds, speed, timestamp: Date.now() })
    );
  } catch (e) {
    console.warn('saveDarsPlaybackPosition error:', e);
  }
}

export async function loadDarsPlaybackPosition(lessonId: string): Promise<{ positionSeconds: number; speed: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(DARS_AUDIO_PLAYBACK_PREFIX + lessonId);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
