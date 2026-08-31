/**
 * classRecording.ts — Phase 40
 * Live Class Audio Recording Engine
 * Teacher-only: records class mic → Firebase Storage → Firestore `recordings` collection
 */
import { Audio } from 'expo-av';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db, storage } from '@/lib/firebase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ClassRecordingMeta = {
  classId: string;
  classTitle: string;
  courseId: string;
  teacherId: string;
  teacherName: string;
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

  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

  const uri = recording.getURI();
  if (!uri) throw new Error('Recording URI is missing — could not save.');

  const status = await recording.getStatusAsync().catch(() => null);
  const durationSec = Math.round(((status as any)?.durationMillis ?? 0) / 1000);

  onProgress?.(10);

  const response = await fetch(uri);
  const blob = await response.blob();
  const sizeBytes = blob.size;

  onProgress?.(30);

  const dateStr = new Date().toISOString().split('T')[0];
  const safeTitle = meta.classTitle.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40);
  const fileName = `${dateStr}_${safeTitle}.m4a`;
  const storagePath = `recordings/${meta.classId}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, blob, { contentType: 'audio/mp4' });
  onProgress?.(80);

  const fileUrl = await getDownloadURL(storageRef);
  onProgress?.(90);

  const title = `${meta.classTitle} — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const docRef = await addDoc(collection(db, 'recordings'), {
    title,
    description: `Live class recording by ${meta.teacherName}`,
    file_url: fileUrl,
    storage_path: storagePath,
    course_id: meta.courseId,
    class_id: meta.classId,
    teacher_id: meta.teacherId,
    teacher_name: meta.teacherName,
    duration_sec: durationSec,
    size_bytes: sizeBytes,
    recorded_at: serverTimestamp(),
    created_at: serverTimestamp(),
  });

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
    duration_sec: durationSec,
    size_bytes: sizeBytes,
  };
}

// ─── Delete Recording ─────────────────────────────────────────────────────────

export async function deleteClassRecording(
  recordingId: string,
  storagePath: string,
): Promise<void> {
  await deleteDoc(doc(db, 'recordings', recordingId));
  if (storagePath) {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef).catch(() => {});
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
