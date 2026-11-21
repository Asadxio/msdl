/**
 * classRecording.ts — Phase P0.1 (Strict On-Device Recording)
 * Live Class Audio Recording Engine
 *
 * CRITICAL PURDAH & PRIVACY POLICY:
 * Recordings remain exclusively on each teacher's own Android device.
 * Class audio is NEVER uploaded to Firebase Storage, Google Drive, or any remote service.
 * Audio is saved to persistent application document storage (Paths.document / documentDirectory).
 *
 * NOTICE:
 * Because recordings are strictly on-device, device loss, application data clearing,
 * or application uninstall will permanently remove local recordings.
 */
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { withTimeout } from '@/lib/errors';
import { LIVE_OPS } from '@/lib/liveOpsConfig';
import { DEFAULT_ORGANIZATION_ID } from '@/lib/tenantContext';

// ─── Constants & Paths ────────────────────────────────────────────────────────
// Persistent application document storage subfolder
export const LOCAL_RECORDINGS_DIR = `${FileSystem.documentDirectory}mslb_teacher_recordings/`;
export const CATALOG_FILE_NAME = 'catalog.json';
const STORAGE_KEY_PREFIX = '@mslb_teacher_recordings_v1_';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ClassRecordingMeta = {
  classId: string;
  classTitle: string;
  courseId: string;
  teacherId: string;
  teacherName: string;
  organizationId?: string;
  durationSec?: number;
};

export type SavedRecording = {
  id: string;
  title: string;
  description: string;
  file_url: string; // Persistent local file:// URI on teacher's device
  file_uri?: string; // Persistent local file:// URI
  storage_path: string; // Kept empty / local marker for compatibility
  course_id: string;
  class_id: string;
  teacher_id: string;
  teacher_name: string;
  organization_id: string;
  duration_sec: number;
  size_bytes: number;
  is_local_only?: boolean;
  recorded_at?: any;
  created_at?: any;
};

export type LocalRecordingItem = SavedRecording;

export type DeleteRecordingResult = {
  success: boolean;
  firestoreDeleted: boolean;
  storageDeleted: boolean;
  localDeleted?: boolean;
  storageError?: string;
};

// ─── Directory Management ────────────────────────────────────────────────────

/**
 * Ensures the persistent document storage directory exists.
 */
export async function ensureLocalRecordingsDir(): Promise<string> {
  const dir = LOCAL_RECORDINGS_DIR;
  try {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch (err) {
    console.warn('[classRecording] Error ensuring recordings dir:', err);
  }
  return dir;
}

function getCatalogUri(): string {
  return `${LOCAL_RECORDINGS_DIR}${CATALOG_FILE_NAME}`;
}

function getStorageKey(teacherUid?: string): string {
  const uid = (teacherUid || auth.currentUser?.uid || 'default').trim();
  return `${STORAGE_KEY_PREFIX}${uid}`;
}

// ─── Permission ───────────────────────────────────────────────────────────────

export async function requestMicPermission(): Promise<boolean> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ─── Recording Start ──────────────────────────────────────────────────────────

export async function startClassRecording(): Promise<Audio.Recording> {
  if (LIVE_OPS.emergencyRecordingDisabled) {
    throw new Error('Recording service is temporarily disabled by administrator.');
  }

  const granted = await requestMicPermission();
  if (!granted) throw new Error('Microphone permission is required to record the class.');

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording } = await Audio.Recording.createAsync({
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
    android: {
      extension: '.m4a',
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    ios: {
      extension: '.m4a',
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
  });

  return recording;
}

// ─── Recording Stop + Save (Strictly On-Device) ────────────────────────────────

/**
 * Stops class recording and saves it EXCLUSIVELY to persistent application document storage.
 * Audio is NEVER uploaded to Firebase Storage or any remote service.
 */
export async function stopAndSaveRecording(
  recording: Audio.Recording,
  meta: ClassRecordingMeta,
  onProgress?: (progress: number) => void,
): Promise<SavedRecording> {
  if (!auth.currentUser) throw new Error('Must be signed in to save a recording.');

  try {
    await recording.stopAndUnloadAsync();
  } finally {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
  }

  const tempUri = recording.getURI();
  if (!tempUri) throw new Error('Recording URI is missing — could not save.');

  // Validate temp file exists and is readable
  const tempInfo = await FileSystem.getInfoAsync(tempUri);
  if (!tempInfo.exists || (tempInfo.size ?? 0) === 0) {
    throw new Error('Recorded audio file is empty or missing from device cache.');
  }

  const status = await recording.getStatusAsync().catch(() => null);
  const measuredSec = Math.round(((status as any)?.durationMillis ?? 0) / 1000);
  const durationSec = measuredSec > 0 ? measuredSec : (meta.durationSec ?? 0);

  onProgress?.(20);

  // Authoritative Course & Tenant Verification
  if (!meta.courseId) {
    throw new Error('Course ID is required to save recording.');
  }
  const courseSnap = await withTimeout(
    getDoc(doc(db, 'courses', meta.courseId)),
    10000,
    'Course verification timed out'
  );
  if (!courseSnap.exists()) {
    throw new Error(`Authoritative course "${meta.courseId}" not found. Cannot save recording.`);
  }
  const courseData = courseSnap.data();
  const authoritativeOrgId = courseData?.organization_id || DEFAULT_ORGANIZATION_ID;

  if (meta.organizationId && meta.organizationId !== authoritativeOrgId) {
    throw new Error(
      `Tenant mismatch: course belongs to organization "${authoritativeOrgId}", but context specified "${meta.organizationId}".`
    );
  }

  onProgress?.(40);

  // Ensure persistent document storage directory exists
  const targetDir = await ensureLocalRecordingsDir();

  // Generate unique, collision-resistant local filename
  const dateStr = new Date().toISOString().split('T')[0];
  const safeTitle = meta.classTitle.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40);
  const uniqueEntropy = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const fileName = `${dateStr}_${safeTitle}_${uniqueEntropy}.m4a`;
  const persistentFileUri = `${targetDir}${fileName}`;

  onProgress?.(60);

  // Copy audio file from temp cache to persistent document storage
  await FileSystem.copyAsync({
    from: tempUri,
    to: persistentFileUri,
  });

  // Verify persistent file
  const persistentInfo = await FileSystem.getInfoAsync(persistentFileUri);
  if (!persistentInfo.exists || (persistentInfo.size ?? 0) === 0) {
    throw new Error('Failed to verify persistent on-device audio file.');
  }
  const sizeBytes = persistentInfo.size || 0;

  // Cleanup temporary cache file
  await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});

  onProgress?.(80);

  const localRecordingId = `rec_local_${uniqueEntropy}`;
  const title = `${meta.classTitle} — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const record: SavedRecording = {
    id: localRecordingId,
    title,
    description: `On-device class recording by ${meta.teacherName}`,
    file_url: persistentFileUri,
    file_uri: persistentFileUri,
    storage_path: `recordings/${fileName}`, // Maintained as local file reference
    course_id: meta.courseId,
    class_id: meta.classId,
    teacher_id: meta.teacherId,
    teacher_name: meta.teacherName,
    organization_id: authoritativeOrgId,
    duration_sec: durationSec,
    size_bytes: sizeBytes,
    is_local_only: true,
    recorded_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  // Persist metadata locally in teacher's AsyncStorage and local catalog file
  await saveLocalMetadata(record);

  onProgress?.(100);

  return record;
}

// ─── Local Metadata Persistence & Indexing ────────────────────────────────────

async function saveLocalMetadata(record: SavedRecording): Promise<void> {
  const teacherUid = record.teacher_id;
  const storageKey = getStorageKey(teacherUid);

  try {
    // 1. Update AsyncStorage
    const raw = await AsyncStorage.getItem(storageKey);
    const existingList: SavedRecording[] = raw ? JSON.parse(raw) : [];
    const updatedList = [record, ...existingList.filter((r) => r.id !== record.id)];
    await AsyncStorage.setItem(storageKey, JSON.stringify(updatedList));

    // 2. Update persistent file-based catalog
    await syncCatalogToFile(updatedList);
  } catch (err) {
    console.warn('[classRecording] Error saving local metadata:', err);
  }
}

async function syncCatalogToFile(records: SavedRecording[]): Promise<void> {
  try {
    const catalogUri = getCatalogUri();
    await FileSystem.writeAsStringAsync(catalogUri, JSON.stringify(records, null, 2));
  } catch (err) {
    console.warn('[classRecording] Error syncing catalog.json:', err);
  }
}

/**
 * Retrieves all on-device class recordings saved on this device for the teacher.
 * Automatically verifies physical file existence and cleans up or annotates missing records.
 */
export async function getLocalClassRecordings(teacherUid?: string): Promise<SavedRecording[]> {
  const storageKey = getStorageKey(teacherUid);
  let records: SavedRecording[] = [];

  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw) {
      records = JSON.parse(raw);
    } else {
      // Recovery attempt from catalog.json
      const catalogUri = getCatalogUri();
      const catalogInfo = await FileSystem.getInfoAsync(catalogUri);
      if (catalogInfo.exists) {
        const fileContent = await FileSystem.readAsStringAsync(catalogUri);
        records = JSON.parse(fileContent);
        await AsyncStorage.setItem(storageKey, JSON.stringify(records));
      }
    }
  } catch (err) {
    console.warn('[classRecording] Error reading local recordings:', err);
  }

  // Verify file existence on device storage
  const verified: SavedRecording[] = [];
  for (const item of records) {
    try {
      const uri = item.file_uri || item.file_url;
      if (uri) {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists && (info.size ?? 0) > 0) {
          verified.push({
            ...item,
            size_bytes: info.size ?? item.size_bytes,
          });
        }
      }
    } catch {
      // File inaccessible or deleted from outside the app
    }
  }

  return verified;
}

/**
 * Recovers on-device recordings by scanning the persistent directory for orphaned files.
 */
export async function recoverLocalRecordingsFromDisk(teacherUid?: string): Promise<SavedRecording[]> {
  const dir = await ensureLocalRecordingsDir();
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) return [];

  const files = await FileSystem.readDirectoryAsync(dir);
  const audioFiles = files.filter((f) => f.endsWith('.m4a'));
  const existing = await getLocalClassRecordings(teacherUid);
  const existingUris = new Set(existing.map((r) => r.file_uri || r.file_url));

  const recovered: SavedRecording[] = [...existing];

  for (const f of audioFiles) {
    const fileUri = `${dir}${f}`;
    if (!existingUris.has(fileUri)) {
      const info = await FileSystem.getInfoAsync(fileUri);
      if (!info.exists || (info.size ?? 0) === 0) continue;
      const title = f.replace(/\.m4a$/, '').replace(/_/g, ' ');
      const newRec: SavedRecording = {
        id: `rec_local_recovered_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: `Recovered: ${title}`,
        description: 'Recovered local recording from device storage',
        file_url: fileUri,
        file_uri: fileUri,
        storage_path: `recordings/${f}`,
        course_id: '',
        class_id: '',
        teacher_id: teacherUid || auth.currentUser?.uid || 'recovered',
        teacher_name: 'Teacher (Local)',
        organization_id: DEFAULT_ORGANIZATION_ID,
        duration_sec: 0,
        size_bytes: info.size ?? 0,
        is_local_only: true,
        created_at: new Date().toISOString(),
      };
      recovered.push(newRec);
    }
  }

  if (recovered.length > existing.length) {
    const storageKey = getStorageKey(teacherUid);
    await AsyncStorage.setItem(storageKey, JSON.stringify(recovered)).catch(() => {});
    await syncCatalogToFile(recovered).catch(() => {});
  }

  return recovered;
}

// ─── Recording Cancel / Discard ───────────────────────────────────────────────

export async function cancelClassRecording(recording: Audio.Recording): Promise<void> {
  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    if (uri) {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
  } finally {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
  }
}

// ─── Delete Recording (Local & Cloud Backwards Compatibility) ─────────────────

/**
 * Deletes a local class recording from the teacher's persistent device storage.
 */
export async function deleteLocalClassRecording(
  recordingId: string,
  teacherUid?: string
): Promise<boolean> {
  const storageKey = getStorageKey(teacherUid);
  try {
    const records = await getLocalClassRecordings(teacherUid);
    const target = records.find((r) => r.id === recordingId);
    if (target) {
      const uri = target.file_uri || target.file_url;
      if (uri) {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
    }
    const filtered = records.filter((r) => r.id !== recordingId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(filtered));
    await syncCatalogToFile(filtered);
    return true;
  } catch (err) {
    console.warn('[classRecording] Error deleting local recording:', err);
    return false;
  }
}

/**
 * Universal delete helper: handles local on-device deletion or legacy cloud deletion.
 * Note: Never deletes cloud recordings unless explicitly passed a cloud recording ID.
 */
export async function deleteClassRecording(
  recordingId: string,
  storagePath?: string,
): Promise<DeleteRecordingResult> {
  // If it is an on-device local recording
  if (recordingId.startsWith('rec_local_')) {
    const success = await deleteLocalClassRecording(recordingId);
    return {
      success,
      firestoreDeleted: false,
      storageDeleted: false,
      localDeleted: success,
    };
  }

  // Legacy cloud recording deletion (for backwards compatibility with pre-P0.1 recordings)
  // Deletes from Firestore metadata; does not perform any new uploads.
  try {
    await withTimeout(
      deleteDoc(doc(db, 'recordings', recordingId)),
      10000,
      'Deleting legacy cloud recording timed out'
    );
  } catch (err: any) {
    return {
      success: false,
      firestoreDeleted: false,
      storageDeleted: false,
      storageError: err?.message,
    };
  }

  return {
    success: true,
    firestoreDeleted: true,
    storageDeleted: true,
  };
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
