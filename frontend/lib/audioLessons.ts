/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { auth, db } from '@/lib/firebase';

export const AUDIO_LESSON_PAGE_SIZE = 10;
export const AUDIO_LESSON_MAX_BYTES = 100 * 1024 * 1024; // Keeping to avoid TS errors
export const AUDIO_LESSON_RECOMMENDED_FORMATS = 'URLs'; // Keeping to avoid TS errors

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
  // Deprecated in text-only migration
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
  const title = input.title.trim();
  if (!title) throw new Error('Please enter an audio lesson title.');
  const uri = input.uri.trim();
  if (!uri) throw new Error('Please enter a valid URL.');

  const docRef = await addDoc(collection(db, 'audio_lessons'), {
    title,
    title_lower: title.toLowerCase(),
    description: input.description.trim(),
    course_id: input.courseId,
    teacher_id: input.teacherId,
    duration: Math.max(0, Math.round(input.duration || 0)),
    upload_date: serverTimestamp(),
    updated_at: serverTimestamp(),
    audio_url: uri,
    file_size: 0,
    file_name: 'External Audio',
    mime_type: 'audio/mpeg',
    storage_path: '',
  });

  onProgress?.(100);
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
  await deleteDoc(doc(db, 'audio_lessons', lesson.id));
}
