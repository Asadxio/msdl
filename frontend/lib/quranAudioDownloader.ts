/**
 * quranAudioDownloader.ts — MSDL Feature 1
 * Manages 1-Tap Offline Audio Downloads for Quran Surahs (Urdu Translation & Recitation).
 * Uses modern Expo FileSystem (Paths, File, Directory).
 */
import { Paths, File, Directory } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFullSurahUrduAudioUrl } from './quranApi';

export const DOWNLOADED_SURAHS_INDEX_KEY = '@msdl_downloaded_surahs_index';

export interface DownloadedSurahMeta {
  surahNumber: number;
  surahName: string;
  sizeBytes: number;
  sizeMb: number;
  downloadedAt: number;
  localUri: string;
}

/**
 * Ensures and returns the dedicated offline Quran audio directory
 */
function getQuranAudioDir(): Directory {
  const dir = new Directory(Paths.document, 'mslb_quran_audio');
  if (!dir.exists) {
    try {
      dir.create({ intermediates: true, idempotent: true });
    } catch {
      // directory might already exist
    }
  }
  return dir;
}

/**
 * Get File handle for a specific Surah audio file
 */
function getSurahAudioFile(surahNumber: number): File {
  const sStr = String(surahNumber).padStart(3, '0');
  const dir = getQuranAudioDir();
  return new File(dir, `surah_${sStr}.mp3`);
}

/**
 * Checks if a Surah audio is already downloaded and present on disk
 */
export async function isSurahAudioDownloaded(surahNumber: number): Promise<boolean> {
  try {
    const file = getSurahAudioFile(surahNumber);
    return Boolean(file.exists && file.size && file.size > 1024);
  } catch {
    return false;
  }
}

/**
 * Returns playable audio URI: local file:// URI if downloaded, otherwise remote CDN URL
 */
export async function getPlayableSurahAudioUri(surahNumber: number): Promise<{ uri: string; isOffline: boolean }> {
  const isDownloaded = await isSurahAudioDownloaded(surahNumber);
  if (isDownloaded) {
    const file = getSurahAudioFile(surahNumber);
    return { uri: file.uri, isOffline: true };
  }
  return { uri: getFullSurahUrduAudioUrl(surahNumber), isOffline: false };
}

/**
 * Gets the size in Megabytes of a downloaded Surah
 */
export async function getSurahAudioSizeMb(surahNumber: number): Promise<number> {
  try {
    const file = getSurahAudioFile(surahNumber);
    if (file.exists && typeof file.size === 'number') {
      return Number((file.size / (1024 * 1024)).toFixed(1));
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Downloads a complete Surah audio file with progress callbacks (0% to 100%)
 */
export async function downloadSurahAudio(
  surahNumber: number,
  surahName: string,
  onProgress?: (progressPercent: number) => void
): Promise<DownloadedSurahMeta> {
  const file = getSurahAudioFile(surahNumber);
  const remoteUrl = getFullSurahUrduAudioUrl(surahNumber);

  try {
    onProgress?.(20);
    let downloadedFile: any;
    try {
      downloadedFile = await File.downloadFileAsync(remoteUrl, file, { idempotent: true });
    } catch (primaryErr) {
      console.warn(`[QuranDownloader] Primary archive download failed for Surah ${surahNumber}, trying CDN fallback:`, primaryErr);
      const sStr = String(surahNumber).padStart(3, '0');
      const fallbackUrl = `https://server8.mp3quran.net/afs/${sStr}.mp3`;
      downloadedFile = await File.downloadFileAsync(fallbackUrl, file, { idempotent: true });
    }
    onProgress?.(85);

    if (!downloadedFile.exists || !downloadedFile.size) {
      throw new Error('Audio file verification failed after download.');
    }

    const sizeBytes = downloadedFile.size || 0;
    const sizeMb = Number((sizeBytes / (1024 * 1024)).toFixed(1));

    const meta: DownloadedSurahMeta = {
      surahNumber,
      surahName,
      sizeBytes,
      sizeMb,
      downloadedAt: Date.now(),
      localUri: downloadedFile.uri,
    };

    // Update AsyncStorage Index
    await saveToDownloadedIndex(meta);

    onProgress?.(100);
    return meta;
  } catch (err: any) {
    onProgress?.(0);
    // Cleanup if incomplete
    try {
      if (file.exists) file.delete();
    } catch {}
    throw new Error(err?.message || `Failed to download audio for Surah ${surahNumber}`);
  }
}

/**
 * Deletes a downloaded Surah audio from device to free disk space
 */
export async function deleteDownloadedSurahAudio(surahNumber: number): Promise<void> {
  try {
    const file = getSurahAudioFile(surahNumber);
    if (file.exists) {
      file.delete();
    }
    await removeFromDownloadedIndex(surahNumber);
  } catch (err) {
    console.warn('deleteDownloadedSurahAudio error:', err);
  }
}

/**
 * Helper: Save metadata entry to downloaded index
 */
async function saveToDownloadedIndex(meta: DownloadedSurahMeta): Promise<void> {
  try {
    const existing = await getAllDownloadedSurahs();
    const filtered = existing.filter((item) => item.surahNumber !== meta.surahNumber);
    const updated = [meta, ...filtered];
    await AsyncStorage.setItem(DOWNLOADED_SURAHS_INDEX_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('saveToDownloadedIndex error:', err);
  }
}

/**
 * Helper: Remove metadata entry from downloaded index
 */
async function removeFromDownloadedIndex(surahNumber: number): Promise<void> {
  try {
    const existing = await getAllDownloadedSurahs();
    const updated = existing.filter((item) => item.surahNumber !== surahNumber);
    await AsyncStorage.setItem(DOWNLOADED_SURAHS_INDEX_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('removeFromDownloadedIndex error:', err);
  }
}

/**
 * Retrieves all currently indexed downloaded Surahs
 */
export async function getAllDownloadedSurahs(): Promise<DownloadedSurahMeta[]> {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADED_SURAHS_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Calculates total storage consumed by all downloaded Surah audio files
 */
export async function getTotalOfflineStorageMb(): Promise<number> {
  const surahs = await getAllDownloadedSurahs();
  const total = surahs.reduce((sum, item) => sum + (item.sizeMb || 0), 0);
  return Number(total.toFixed(1));
}
