import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';

export const AUDIO_LESSON_MAX_BYTES = 100 * 1024 * 1024;
export const AUDIO_LESSON_PAGE_SIZE = 10;
export const AUDIO_LESSON_RECOMMENDED_FORMATS = 'MP3, M4A, AAC';

const AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/aacp',
]);

const AUDIO_EXTENSIONS = new Set(['mp3', 'm4a', 'aac']);

export type AudioLesson = {
  id: string;
  title: string;
  description: string;
  course_id: string;
  teacher_id: string;
  duration: number;
  upload_date?: { toDate?: () => Date } | null;
  updated_at?: { toDate?: () => Date } | null;
  audio_url: string;
  file_size: number;
  file_name?: string;
  mime_type?: string;
  storage_path?: string;
  title_lower?: string;
};

export type AudioLessonPage = {
  lessons: AudioLesson[];
  cursor: QueryDocumentSnapshot | DocumentSnapshot | null;
  hasMore: boolean;
};

export type UploadAudioLessonInput = {
  courseId: string;
  teacherId: string;
  title: string;
  description: string;
  duration: number;
  uri: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
};

function normalizeMimeType(mimeType?: string, fileName?: string): string {
  const raw = String(mimeType || '').toLowerCase().trim();
  if (raw === 'audio/mp3') return 'audio/mpeg';
  if (raw) return raw;
  const ext = getExtension(fileName);
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'm4a') return 'audio/mp4';
  if (ext === 'aac') return 'audio/aac';
  return 'application/octet-stream';
}

function getExtension(fileName?: string): string {
  const clean = String(fileName || '').toLowerCase().split('?')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
}

function sanitizeFileName(fileName?: string): string {
  const base = String(fileName || `audio_${Date.now()}.mp3`)
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
  return base.length >= 6 ? base : `audio_${Date.now()}.mp3`;
}

function normalizeAudioLesson(id: string, raw: any): AudioLesson {
  return {
    id,
    title: String(raw?.title || 'Audio Lesson'),
    description: String(raw?.description || ''),
    course_id: String(raw?.course_id || ''),
    teacher_id: String(raw?.teacher_id || ''),
    duration: Number(raw?.duration || 0),
    upload_date: raw?.upload_date || null,
    updated_at: raw?.updated_at || null,
    audio_url: String(raw?.audio_url || ''),
    file_size: Number(raw?.file_size || 0),
    file_name: raw?.file_name ? String(raw.file_name) : '',
    mime_type: raw?.mime_type ? String(raw.mime_type) : '',
    storage_path: raw?.storage_path ? String(raw.storage_path) : '',
    title_lower: raw?.title_lower ? String(raw.title_lower) : '',
  };
}

export function validateAudioLessonFile(fileName: string, mimeType?: string, fileSize?: number): void {
  const ext = getExtension(fileName);
  const normalizedMime = normalizeMimeType(mimeType, fileName);
  if (!AUDIO_EXTENSIONS.has(ext) && !AUDIO_MIME_TYPES.has(normalizedMime)) {
    throw new Error(`Unsupported audio file. Please upload ${AUDIO_LESSON_RECOMMENDED_FORMATS} only.`);
  }
  if (typeof fileSize === 'number' && fileSize > AUDIO_LESSON_MAX_BYTES) {
    throw new Error('Audio file is too large. Maximum upload size is 100 MB.');
  }
}

export async function fetchAudioLessonsPage(
  courseId: string,
  searchText = '',
  cursor: QueryDocumentSnapshot | DocumentSnapshot | null = null,
): Promise<AudioLessonPage> {
  const cleanSearch = searchText.trim().toLowerCase();
  const constraints: any[] = [where('course_id', '==', courseId)];
  if (cleanSearch) {
    constraints.push(orderBy('title_lower'));
    constraints.push(where('title_lower', '>=', cleanSearch));
    constraints.push(where('title_lower', '<=', `${cleanSearch}\uf8ff`));
  } else {
    constraints.push(orderBy('upload_date', 'desc'));
  }
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(AUDIO_LESSON_PAGE_SIZE + 1));
  const snap = await getDocs(query(collection(db, 'audio_lessons'), ...constraints));
  const docs = snap.docs.slice(0, AUDIO_LESSON_PAGE_SIZE);
  return {
    lessons: docs.map((d) => normalizeAudioLesson(d.id, d.data())),
    cursor: docs.length ? docs[docs.length - 1] : cursor,
    hasMore: snap.docs.length > AUDIO_LESSON_PAGE_SIZE,
  };
}

export async function uploadAudioLesson(
  input: UploadAudioLessonInput,
  onProgress?: (progress: number) => void,
): Promise<string> {
  if (!auth.currentUser) throw new Error('Please sign in again before uploading.');
  validateAudioLessonFile(input.fileName, input.mimeType, input.fileSize);
  const title = input.title.trim();
  if (!title) throw new Error('Please enter an audio lesson title.');
  const mimeType = normalizeMimeType(input.mimeType, input.fileName);
  const safeName = sanitizeFileName(input.fileName);
  const storagePath = `audio_lessons/${input.courseId}/${input.teacherId}/${Date.now()}_${safeName}`;

  const uploadOnce = async (): Promise<{ downloadUrl: string; size: number }> => {
    const response = await fetch(input.uri);
    if (!response.ok) throw new Error(`Could not read selected audio file (${response.status}).`);
    const blob = await response.blob();
    if (!blob.size) throw new Error('Selected audio file is empty.');
    if (blob.size > AUDIO_LESSON_MAX_BYTES) throw new Error('Audio file is too large. Maximum upload size is 100 MB.');
    const fileRef = ref(storage, storagePath);
    const task = uploadBytesResumable(fileRef, blob, {
      contentType: mimeType,
      customMetadata: {
        course_id: input.courseId,
        teacher_id: input.teacherId,
        uploaded_by: auth.currentUser?.uid || input.teacherId,
      },
    });
    await new Promise<void>((resolve, reject) => {
      task.on('state_changed',
        (snap) => onProgress?.(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
        (error) => reject(error),
        () => resolve(),
      );
    });
    return { downloadUrl: await getDownloadURL(fileRef), size: blob.size };
  };

  let uploaded: { downloadUrl: string; size: number };
  try {
    uploaded = await uploadOnce();
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    uploaded = await uploadOnce();
  }

  const docRef = await addDoc(collection(db, 'audio_lessons'), {
    title,
    title_lower: title.toLowerCase(),
    description: input.description.trim(),
    course_id: input.courseId,
    teacher_id: input.teacherId,
    duration: Math.max(0, Math.round(input.duration || 0)),
    upload_date: serverTimestamp(),
    updated_at: serverTimestamp(),
    audio_url: uploaded.downloadUrl,
    file_size: uploaded.size,
    file_name: safeName,
    mime_type: mimeType,
    storage_path: storagePath,
  });
  onProgress?.(1);
  return docRef.id;
}

export async function updateAudioLesson(lessonId: string, updates: { title: string; description: string }): Promise<void> {
  const title = updates.title.trim();
  if (!title) throw new Error('Audio lesson title is required.');
  await updateDoc(doc(db, 'audio_lessons', lessonId), {
    title,
    title_lower: title.toLowerCase(),
    description: updates.description.trim(),
    updated_at: serverTimestamp(),
  });
}

export async function deleteAudioLesson(lesson: AudioLesson): Promise<void> {
  if (lesson.storage_path) {
    await deleteObject(ref(storage, lesson.storage_path)).catch(() => {});
  }
  await deleteDoc(doc(db, 'audio_lessons', lesson.id));
}
