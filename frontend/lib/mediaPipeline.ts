import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDownloadURL, ref, uploadBytesResumable, UploadTask } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { optimizeImageForUpload, optimizeVideoForUpload, validateOptimizedMedia, registerCacheEntry, updateUploadHeartbeat, scheduleRetry, isDuplicateWindow } from '@/lib/mediaOptimization';

export type MediaCategory = 'chat' | 'status' | 'profile' | 'assignment' | 'course' | 'recording';
export type MediaState = 'queued' | 'uploading' | 'paused' | 'failed' | 'completed' | 'cancelled';

export type MediaUploadRequest = {
  uploadId: string;
  uri: string;
  path: string;
  contentType: string;
  category: MediaCategory;
  maxBytes?: number;
};

export type MediaUploadProgress = {
  uploadId: string;
  state: MediaState;
  progress: number;
  error?: string;
  downloadUrl?: string;
};

const STORE_KEY = 'media_upload_queue_v1';
const DEFAULT_MAX = 20 * 1024 * 1024;
const activeTasks = new Map<string, UploadTask>();

function classifyMediaError(err: any): string {
  const code = String(err?.code || 'unknown');
  if (code.includes('unauthorized')) return 'Permission denied for media upload.';
  if (code.includes('quota-exceeded')) return 'Storage quota exceeded. Please retry later.';
  if (code.includes('retry-limit-exceeded')) return 'Network unstable. Upload retry limit reached.';
  if (code.includes('canceled')) return 'Upload cancelled.';
  return String(err?.message || 'Upload failed.');
}

async function loadQueue(): Promise<MediaUploadRequest[]> {
  const raw = await AsyncStorage.getItem(STORE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as MediaUploadRequest[]; } catch { return []; }
}

async function saveQueue(queue: MediaUploadRequest[]) {
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(queue.slice(-200)));
}

export async function enqueueMediaUpload(req: MediaUploadRequest) {
  const queue = await loadQueue();
  if (!queue.find((q) => q.uploadId === req.uploadId)) queue.push(req);
  await saveQueue(queue);
}

export async function removeQueuedUpload(uploadId: string) {
  const queue = await loadQueue();
  await saveQueue(queue.filter((q) => q.uploadId !== uploadId));
}

export async function runMediaUpload(
  req: MediaUploadRequest,
  onProgress?: (p: MediaUploadProgress) => void,
): Promise<string> {
  if (!req.uri || !req.path || req.path.includes('//')) throw new Error('Invalid media upload request.');
  await enqueueMediaUpload(req);

  const ext = req.path.toLowerCase();
  const isVideo = req.contentType.startsWith('video/') || ext.endsWith('.mp4') || ext.endsWith('.mov');
  const optimized = isVideo ? await optimizeVideoForUpload(req.uri, req.category === 'recording' ? 'recording' : 'medium', (req.category as any)) : await optimizeImageForUpload(req.uri, { quality: req.category === 'chat' ? 0.65 : 0.72 });
  validateOptimizedMedia(optimized, req.maxBytes || DEFAULT_MAX);
  const dup = await isDuplicateWindow(optimized.integrityHash);
  if (dup) throw new Error('Duplicate upload suppressed.');

  const res = await fetch(optimized.uri);
  if (!res.ok) throw new Error(`Could not read media file (${res.status}).`);
  const blob = await res.blob();
  if (!blob || !blob.size) throw new Error('Media file is empty/corrupted.');
  if (blob.size > (req.maxBytes || DEFAULT_MAX)) throw new Error('Media file too large for upload policy.');

  const fileRef = ref(storage, req.path);
  const task = uploadBytesResumable(fileRef, blob, {
    contentType: req.contentType,
    customMetadata: {
      upload_id: req.uploadId,
      category: req.category,
      uploaded_at_ms: String(Date.now()),
      integrity_hash: optimized.integrityHash,
      optimized_cache_key: optimized.cacheKey,
    },
  });
  activeTasks.set(req.uploadId, task);

  try {
    await new Promise<void>((resolve, reject) => {
      task.on('state_changed',
        (snap) => {
          const ratio = snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0;
          const state: MediaState = snap.state === 'paused' ? 'paused' : 'uploading';
          updateUploadHeartbeat(req.uploadId, state).catch(() => {});
          onProgress?.({ uploadId: req.uploadId, state, progress: ratio });
        },
        (err) => reject(err),
        () => resolve(),
      );
    });
    const url = await getDownloadURL(fileRef);
    registerCacheEntry(optimized.cacheKey, 24 * 3600 * 1000).catch(() => {});
    onProgress?.({ uploadId: req.uploadId, state: 'completed', progress: 1, downloadUrl: url });
    await removeQueuedUpload(req.uploadId);
    activeTasks.delete(req.uploadId);
    return url;
  } catch (err) {
    const msg = classifyMediaError(err);
    scheduleRetry(req.uploadId).catch(() => {});
    onProgress?.({ uploadId: req.uploadId, state: 'failed', progress: 0, error: msg });
    activeTasks.delete(req.uploadId);
    throw new Error(msg);
  }
}

export function pauseMediaUpload(uploadId: string) {
  activeTasks.get(uploadId)?.pause();
}

export function resumeMediaUpload(uploadId: string) {
  activeTasks.get(uploadId)?.resume();
}

export async function cancelMediaUpload(uploadId: string) {
  activeTasks.get(uploadId)?.cancel();
  activeTasks.delete(uploadId);
  await removeQueuedUpload(uploadId);
}

export async function recoverQueuedUploads() {
  return loadQueue();
}
