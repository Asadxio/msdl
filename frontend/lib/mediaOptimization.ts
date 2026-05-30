import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type VideoPreset = 'low' | 'medium' | 'high' | 'recording';

export type OptimizedMedia = {
  uri: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationMs?: number;
  thumbnailUri?: string;
  optimizedAtMs: number;
  cacheKey: string;
  integrityHash: string;
};

const CACHE_REG_KEY = 'media_cache_registry_v1';
const UPLOAD_HEARTBEAT_KEY = 'media_upload_heartbeat_v1';
const DUP_WINDOW_MS = 2 * 60 * 1000;
const MAX_UPLOAD_RETRIES = 4;

const PRESETS: Record<VideoPreset, { maxDimension: number; quality: number; targetBitrateKbps: number }> = {
  low: { maxDimension: 640, quality: 0.45, targetBitrateKbps: 500 },
  medium: { maxDimension: 960, quality: 0.65, targetBitrateKbps: 1200 },
  high: { maxDimension: 1280, quality: 0.8, targetBitrateKbps: 2200 },
  recording: { maxDimension: 1280, quality: 0.7, targetBitrateKbps: 1800 },
};

function now() { return Date.now(); }

export function createMediaCacheKey(input: { uri: string; category: string; version?: string; sizeBytes?: number }) {
  const base = `${input.category}|${input.version || 'v1'}|${input.uri}|${input.sizeBytes || 0}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  return `media_${hash.toString(16)}`;
}

async function quickHashFromFile(uri: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(uri, { md5: true });
  if (!info.exists) return String(uri.length);
  const sizeBytes = 'size' in info ? Number(info.size || 0) : 0;
  return String(('md5' in info && info.md5) || `${sizeBytes}_${uri.length}`);
}

export async function extractMediaMetadata(uri: string): Promise<{ sizeBytes: number; width?: number; height?: number; durationMs?: number }> {
  const info = await FileSystem.getInfoAsync(uri);
  return { sizeBytes: info.exists && 'size' in info ? Number(info.size || 0) : 0 };
}

export async function generateVideoThumbnail(uri: string, captureTimeMs = 1200): Promise<{ thumbnailUri: string; generatedAtMs: number }> {
  const out = await VideoThumbnails.getThumbnailAsync(uri, { time: Math.max(0, captureTimeMs), quality: 0.65 });
  return { thumbnailUri: out.uri, generatedAtMs: now() };
}

export async function optimizeImageForUpload(uri: string, opts?: { maxDimension?: number; quality?: number; format?: 'jpeg' | 'png' | 'webp' }) {
  const maxDimension = opts?.maxDimension ?? 1600;
  const quality = opts?.quality ?? 0.72;
  const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: maxDimension } }], {
    compress: Math.min(1, Math.max(0.3, quality)),
    format: ImageManipulator.SaveFormat.JPEG,
    base64: false,
  });
  const meta = await extractMediaMetadata(result.uri);
  const integrityHash = await quickHashFromFile(result.uri);
  const cacheKey = createMediaCacheKey({ uri: result.uri, category: 'image', sizeBytes: meta.sizeBytes });
  return {
    uri: result.uri,
    mimeType: 'image/jpeg',
    sizeBytes: meta.sizeBytes,
    width: result.width,
    height: result.height,
    optimizedAtMs: now(),
    cacheKey,
    integrityHash,
  } as OptimizedMedia;
}

export async function optimizeVideoForUpload(uri: string, preset: VideoPreset = 'medium', category: 'status' | 'chat' | 'recording' | 'assignment' = 'chat') {
  const chosen = category === 'recording' ? 'recording' : preset;
  const cfg = PRESETS[chosen];
  // Expo cannot transcode video reliably across all devices without extra native stack;
  // do safe preflight + thumbnail + metadata and keep original uri for compatibility.
  const meta = await extractMediaMetadata(uri);
  const thumb = await generateVideoThumbnail(uri, 1200).catch(() => ({ thumbnailUri: '', generatedAtMs: now() }));
  const integrityHash = await quickHashFromFile(uri);
  const cacheKey = createMediaCacheKey({ uri, category: `video_${category}_${chosen}`, sizeBytes: meta.sizeBytes });
  return {
    uri,
    mimeType: 'video/mp4',
    sizeBytes: meta.sizeBytes,
    durationMs: meta.durationMs,
    thumbnailUri: thumb.thumbnailUri || undefined,
    optimizedAtMs: now(),
    cacheKey,
    integrityHash,
    metadata: { preset: chosen, maxDimension: cfg.maxDimension, targetBitrateKbps: cfg.targetBitrateKbps },
  };
}

export function validateOptimizedMedia(media: OptimizedMedia, maxBytes = 20 * 1024 * 1024) {
  if (!media.uri) throw new Error('Optimized media missing URI');
  if (!media.mimeType) throw new Error('Optimized media missing mime type');
  if (!Number.isFinite(media.sizeBytes) || media.sizeBytes <= 0 || media.sizeBytes > maxBytes) throw new Error('Optimized media size invalid');
  if (media.mimeType.startsWith('video/') && !media.thumbnailUri) throw new Error('Video thumbnail missing');
  return true;
}

export async function registerCacheEntry(key: string, ttlMs: number) {
  const raw = (await AsyncStorage.getItem(CACHE_REG_KEY)) || '{}';
  const reg = JSON.parse(raw) as Record<string, { expiresAt: number; updatedAt: number }>;
  reg[key] = { expiresAt: now() + ttlMs, updatedAt: now() };
  await AsyncStorage.setItem(CACHE_REG_KEY, JSON.stringify(reg));
}

export async function evictStaleCacheEntries() {
  const raw = (await AsyncStorage.getItem(CACHE_REG_KEY)) || '{}';
  const reg = JSON.parse(raw) as Record<string, { expiresAt: number; updatedAt: number }>;
  const t = now();
  const keys = Object.keys(reg);
  for (const k of keys) if ((reg[k]?.expiresAt || 0) < t) delete reg[k];
  await AsyncStorage.setItem(CACHE_REG_KEY, JSON.stringify(reg));
  return { remaining: Object.keys(reg).length };
}

export async function updateUploadHeartbeat(uploadId: string, state: string) {
  const raw = (await AsyncStorage.getItem(UPLOAD_HEARTBEAT_KEY)) || '{}';
  const hb = JSON.parse(raw) as Record<string, { state: string; at: number; retry: number }>;
  const prev = hb[uploadId];
  hb[uploadId] = { state, at: now(), retry: prev?.retry || 0 };
  await AsyncStorage.setItem(UPLOAD_HEARTBEAT_KEY, JSON.stringify(hb));
}

export async function scheduleRetry(uploadId: string) {
  const raw = (await AsyncStorage.getItem(UPLOAD_HEARTBEAT_KEY)) || '{}';
  const hb = JSON.parse(raw) as Record<string, { state: string; at: number; retry: number }>;
  const item = hb[uploadId] || { state: 'failed', at: now(), retry: 0 };
  if (item.retry >= MAX_UPLOAD_RETRIES) return { allowed: false, nextInMs: -1 };
  const retry = item.retry + 1;
  const nextInMs = Math.min(60_000, 600 * (2 ** retry) + Math.floor(Math.random() * 400));
  hb[uploadId] = { state: 'retrying', at: now(), retry };
  await AsyncStorage.setItem(UPLOAD_HEARTBEAT_KEY, JSON.stringify(hb));
  return { allowed: true, nextInMs };
}

export async function isDuplicateWindow(hash: string, uploadId?: string) {
  const key = `dup_${hash}`;
  const raw = await AsyncStorage.getItem(key);
  const t = now();
  let previous: { at: number; uploadId?: string } | null = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { at?: number; uploadId?: string };
      previous = { at: Number(parsed.at || 0), uploadId: parsed.uploadId };
    } catch {
      previous = { at: Number(raw), uploadId: undefined };
    }
  }
  const sameUploadRetry = Boolean(uploadId && previous?.uploadId === uploadId);
  if (previous && !sameUploadRetry && t - previous.at <= DUP_WINDOW_MS) return true;
  await AsyncStorage.setItem(key, JSON.stringify({ at: t, uploadId }));
  return false;
}

export async function clearDuplicateWindow(hash: string, uploadId?: string) {
  if (!hash || !uploadId) return;
  const key = `dup_${hash}`;
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as { uploadId?: string };
    if (parsed.uploadId === uploadId) await AsyncStorage.removeItem(key);
  } catch {
    await AsyncStorage.removeItem(key);
  }
}
