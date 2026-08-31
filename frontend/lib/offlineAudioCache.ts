/**
 * offlineAudioCache.ts — Phase 41
 * Manages local caching and offline storage of Madrasa class audio recordings
 * using modern Expo FileSystem (Paths, File, Directory).
 */
import { Paths, File, Directory } from 'expo-file-system';

function getRecordingsDir(): Directory {
  const dir = new Directory(Paths.document, 'mslb_recordings');
  if (!dir.exists) {
    try {
      dir.create({ intermediates: true, idempotent: true });
    } catch {
      // directory might already exist
    }
  }
  return dir;
}

function getRecordingFile(recordingId: string): File {
  const safeId = recordingId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = getRecordingsDir();
  return new File(dir, `${safeId}.m4a`);
}

/**
 * Get the local file path for a given recording ID
 */
export function getLocalAudioUri(recordingId: string): string {
  const file = getRecordingFile(recordingId);
  return file.uri;
}

/**
 * Checks if a recording has been downloaded to local device storage
 */
export async function isAudioCached(recordingId: string): Promise<boolean> {
  try {
    const file = getRecordingFile(recordingId);
    return Boolean(file.exists && file.size > 0);
  } catch {
    return false;
  }
}

/**
 * Returns the playable URI (local file:// if cached, otherwise remote https:// URL)
 */
export async function getPlayableAudioUri(recordingId: string, remoteUrl: string): Promise<string> {
  const cached = await isAudioCached(recordingId);
  if (cached) {
    return getLocalAudioUri(recordingId);
  }
  return remoteUrl;
}

/**
 * Downloads a recording file to device storage with progress tracking
 */
export async function downloadAudioForOffline(
  recordingId: string,
  remoteUrl: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const file = getRecordingFile(recordingId);
  onProgress?.(10);

  try {
    onProgress?.(30);
    const downloadedFile = await File.downloadFileAsync(remoteUrl, file, { idempotent: true });
    onProgress?.(90);

    if (!downloadedFile.exists) {
      throw new Error('Download failed: file not written to storage.');
    }

    onProgress?.(100);
    return downloadedFile.uri;
  } catch (err: any) {
    onProgress?.(0);
    throw new Error(err?.message || 'Failed to download audio recording.');
  }
}

/**
 * Deletes a cached recording from local device storage to free up disk space
 */
export async function deleteCachedAudio(recordingId: string): Promise<void> {
  try {
    const file = getRecordingFile(recordingId);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // best-effort cleanup
  }
}

/**
 * Gets the size in Megabytes of a downloaded file
 */
export async function getCachedAudioSizeMb(recordingId: string): Promise<number> {
  try {
    const file = getRecordingFile(recordingId);
    if (file.exists && typeof file.size === 'number') {
      return Number((file.size / (1024 * 1024)).toFixed(1));
    }
    return 0;
  } catch {
    return 0;
  }
}
