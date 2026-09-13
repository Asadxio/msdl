/**
 * storageCleaner.ts
 * Storage & Cache Cleaner engine for Madrasatu-s-Salikat.
 * Safely calculates and reclaims disk storage used by offline Quran audios,
 * temporary file caches, and disposable data without affecting user sessions or Quran bookmarks.
 */

import { Paths, Directory, File } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DOWNLOADED_SURAHS_INDEX_KEY } from './quranAudioDownloader';
import { clearQuizCounts } from './lmsHardening';

export interface StorageBreakdown {
  quranAudioBytes: number;
  quranAudioCount: number;
  cacheBytes: number;
  cacheFileCount: number;
  tempStorageCount: number;
  totalDisposableBytes: number;
}

export const DISPOSABLE_ASYNC_KEYS = [
  'library_recently_viewed_books',
  'cached_announcements',
  'offline_library_manifest_temp',
  '@mslb_temp_search_history',
  '@mslb_query_cache_v1',
];

/**
 * Formats raw bytes into human-readable strings (e.g. "42.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Calculates current disk consumption of Quran offline audios and app cache.
 */
export async function getAppStorageBreakdown(): Promise<StorageBreakdown> {
  let quranAudioBytes = 0;
  let quranAudioCount = 0;
  let cacheBytes = 0;
  let cacheFileCount = 0;

  // 1. Inspect Quran offline audios
  try {
    const quranDir = new Directory(Paths.document, 'mslb_quran_audio');
    if (quranDir.exists) {
      const items = quranDir.list();
      for (const item of items) {
        if (item instanceof File && item.exists) {
          quranAudioCount++;
          quranAudioBytes += item.size || 0;
        }
      }
    }
  } catch (err) {
    console.log('[StorageCleaner] Error inspecting Quran audio dir:', err);
  }

  // 2. Inspect Cache directory
  try {
    const cacheDir = Paths.cache;
    if (cacheDir.exists) {
      const items = cacheDir.list();
      for (const item of items) {
        if (item instanceof File && item.exists) {
          cacheFileCount++;
          cacheBytes += item.size || 0;
        }
      }
    }
  } catch (err) {
    console.log('[StorageCleaner] Error inspecting cache dir:', err);
  }

  return {
    quranAudioBytes,
    quranAudioCount,
    cacheBytes,
    cacheFileCount,
    tempStorageCount: DISPOSABLE_ASYNC_KEYS.length,
    totalDisposableBytes: quranAudioBytes + cacheBytes,
  };
}

/**
 * Clears downloaded offline Quran audio files.
 * Preserves student reading bookmarks, Khatam counters, and notes.
 */
export async function clearQuranAudioStorage(): Promise<{ freedBytes: number; deletedCount: number }> {
  let freedBytes = 0;
  let deletedCount = 0;

  try {
    const quranDir = new Directory(Paths.document, 'mslb_quran_audio');
    if (quranDir.exists) {
      const items = quranDir.list();
      for (const item of items) {
        try {
          if (item instanceof File && item.exists) {
            freedBytes += item.size || 0;
            item.delete();
            deletedCount++;
          }
        } catch {}
      }
    }
    // Reset the downloaded audio index in AsyncStorage
    await AsyncStorage.removeItem(DOWNLOADED_SURAHS_INDEX_KEY);
  } catch (err) {
    console.log('[StorageCleaner] Error clearing Quran audios:', err);
  }

  return { freedBytes, deletedCount };
}

/**
 * Clears temporary image and network cache files from Paths.cache
 */
export async function clearAppCacheDirectory(): Promise<{ freedBytes: number; deletedCount: number }> {
  let freedBytes = 0;
  let deletedCount = 0;

  try {
    const cacheDir = Paths.cache;
    if (cacheDir.exists) {
      const items = cacheDir.list();
      for (const item of items) {
        try {
          if (item instanceof File && item.exists) {
            freedBytes += item.size || 0;
            item.delete();
            deletedCount++;
          }
        } catch {}
      }
    }
    // Also clean disposable keys in AsyncStorage
    await AsyncStorage.multiRemove(DISPOSABLE_ASYNC_KEYS).catch(() => {});
    await clearQuizCounts().catch(() => {});
  } catch (err) {
    console.log('[StorageCleaner] Error clearing app cache dir:', err);
  }

  return { freedBytes, deletedCount };
}

/**
 * Cleans all disposable data (both Quran audios and temporary cache) safely.
 */
export async function clearAllDisposableStorage(): Promise<{ totalFreedBytes: number }> {
  const quranResult = await clearQuranAudioStorage();
  const cacheResult = await clearAppCacheDirectory();
  return {
    totalFreedBytes: quranResult.freedBytes + cacheResult.freedBytes,
  };
}
