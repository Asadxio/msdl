/**
 * classRecording.ts — Phase 40
 * Live Class Audio Recording Engine
 * Teacher-only: records class mic → Firebase Storage → Firestore `recordings` collection
 */
import { Audio } from 'expo-av';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, storage } from '@/lib/firebase';
import { withTimeout } from '@/lib/errors';
import { LIVE_OPS } from '@/lib/liveOpsConfig';
import { DEFAULT_ORGANIZATION_ID } from '@/lib/tenantContext';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ClassRecordingMeta = {
  classId: string;
  classTitle: string;
  courseId: string;
  teacherId: string;
  teacherName: string;
  organizationId?: string; // Phase 57: Authoritative tenant context
};

export type SavedRecording = {
  id: string;
  title: string;
  description: string;
  file_url: string;
  storage_path: string;
  course_id: string;
  class_id: string;
  teacher_id: string;
  teacher_name: string;
  organization_id: string; // Phase 57: Stamped authoritative organization
  duration_sec: number;
  size_bytes: number;
};


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

// ─── Recording Stop + Save ────────────────────────────────────────────────────

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

  const uri = recording.getURI();
  if (!uri) throw new Error('Recording URI is missing — could not save.');

  const status = await recording.getStatusAsync().catch(() => null);
  const durationSec = Math.round(((status as any)?.durationMillis ?? 0) / 1000);

  onProgress?.(10);

  // 1. Authoritative Course & Tenant Verification (Server/Trust Boundary)
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

  // Strict cross-tenant rejection: if caller context specified an organization, it MUST match the course's org
  if (meta.organizationId && meta.organizationId !== authoritativeOrgId) {
    throw new Error(
      `Tenant mismatch: course belongs to organization "${authoritativeOrgId}", but context specified "${meta.organizationId}". Cross-tenant creation rejected.`
    );
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  const sizeBytes = blob.size;

  onProgress?.(30);

  const dateStr = new Date().toISOString().split('T')[0];
  const safeTitle = meta.classTitle.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40);
  const fileName = `${dateStr}_${safeTitle}.m4a`;
  // Canonical tenant-scoped storage path
  const storagePath = `organizations/${authoritativeOrgId}/courses/${meta.courseId}/recordings/${meta.classId}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  await withTimeout(
    uploadBytes(storageRef, blob, { contentType: 'audio/mp4' }),
    60000,
    'Audio upload timed out after 60s. Please check your internet connection.'
  );
  onProgress?.(80);

  const fileUrl = await withTimeout(
    getDownloadURL(storageRef),
    15000,
    'Retrieving audio download URL timed out.'
  );
  onProgress?.(90);

  const title = `${meta.classTitle} — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const docRef = await withTimeout(
    addDoc(collection(db, 'recordings'), {
      title,
      description: `Live class recording by ${meta.teacherName}`,
      file_url: fileUrl,
      storage_path: storagePath,
      course_id: meta.courseId,
      class_id: meta.classId,
      teacher_id: meta.teacherId,
      teacher_name: meta.teacherName,
      organization_id: authoritativeOrgId, // Stamped authoritative tenant
      duration_sec: durationSec,
      size_bytes: sizeBytes,
      status: 'published',
      recorded_at: serverTimestamp(),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    }),
    15000,
    'Saving recording metadata timed out.'
  );

  onProgress?.(100);

  return {
    id: docRef.id,
    title,
    description: `Live class recording by ${meta.teacherName}`,
    file_url: fileUrl,
    storage_path: storagePath,
    course_id: meta.courseId,
    class_id: meta.classId,
    teacher_id: meta.teacherId,
    teacher_name: meta.teacherName,
    organization_id: authoritativeOrgId,
    duration_sec: durationSec,
    size_bytes: sizeBytes,
  };
}


// ─── Delete Recording ─────────────────────────────────────────────────────────

export async function deleteClassRecording(
  recordingId: string,
  storagePath: string,
): Promise<void> {
  await withTimeout(
    deleteDoc(doc(db, 'recordings', recordingId)),
    10000,
    'Deleting recording document timed out'
  );
  if (storagePath) {
    const storageRef = ref(storage, storagePath);
    await withTimeout(
      deleteObject(storageRef),
      10000,
      'Deleting recording storage object timed out'
    ).catch(() => {});
  }
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
