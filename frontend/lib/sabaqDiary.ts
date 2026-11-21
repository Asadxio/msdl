import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  limit,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/lib/firebase';
import { withTimeout } from '@/lib/errors';
import { getAttendanceDocId } from '@/lib/attendanceId';
import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_NAME,
  getActiveOrganizationIdSync,
} from '@/lib/tenantContext';

export const SABAQ_CACHE_PREFIX = '@mslb_sabaq_diary_cache_';
export const SABAQ_OFFLINE_QUEUE_KEY = '@mslb_sabaq_offline_queue';

export type SabaqGrade =
  | 'Mumtaz'        // ممتاز (Outstanding / Excellent)
  | 'Jayyid Jiddan' // جيد جداً (Very Good)
  | 'Jayyid'        // جيد (Good)
  | 'Maqbool'       // مقبول (Passing)
  | 'Doharayein';   // دہرائیں (Repeat / Needs Practice)

export interface SabaqSectionDetail {
  text: string;         // e.g. "Surah Al-Baqarah Ayah 1-25" or "Quduri Kitab al-Nikah Fasl 1"
  grade: SabaqGrade;
  mistakes?: number;    // Attkiyan / Ghalatiyan
  juz?: number;         // 1 to 30 for Hifz students
}

export interface SabaqDiaryEntry {
  id: string;
  organization_id: string;
  institution_name: string;
  student_id: string;
  student_name: string;
  teacher_id: string;
  teacher_name: string;
  course_id?: string;
  course_name?: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'leave';
  sabaq: SabaqSectionDetail;   // Daily new portion
  sabqi: SabaqSectionDetail;   // Recent days review
  manzil: SabaqSectionDetail;  // Full Juz cycle review
  teacher_notes?: string;
  parent_viewed?: boolean;
  created_at?: Timestamp | any;
  updated_at?: Timestamp | any;
}

export const SABAQ_GRADE_CONFIG: Record<
  SabaqGrade,
  { label: string; arabic: string; color: string; bg: string; icon: string }
> = {
  Mumtaz: {
    label: 'Mumtaz (Excellent)',
    arabic: 'مُمْتَاز',
    color: '#059669',
    bg: '#ECFDF5',
    icon: 'star',
  },
  'Jayyid Jiddan': {
    label: 'Jayyid Jiddan (Very Good)',
    arabic: 'جَیِّد جِدّاً',
    color: '#2563EB',
    bg: '#EFF6FF',
    icon: 'checkmark-circle',
  },
  Jayyid: {
    label: 'Jayyid (Good)',
    arabic: 'جَیِّد',
    color: '#0D9488',
    bg: '#F0FDFA',
    icon: 'checkmark',
  },
  Maqbool: {
    label: 'Maqbool (Passing)',
    arabic: 'مَقْبُول',
    color: '#D97706',
    bg: '#FFFBEB',
    icon: 'alert-circle',
  },
  Doharayein: {
    label: 'Doharayein (Repeat)',
    arabic: 'دُہْرَائِیں',
    color: '#DC2626',
    bg: '#FEF2F2',
    icon: 'refresh-circle',
  },
};

/**
 * Record or update a student's daily Sabaq, Sabqi, Manzil entry.
 */
export async function recordSabaqEntry(params: {
  id?: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  organizationId?: string;
  institutionName?: string;
  courseId?: string;
  courseName?: string;
  date?: string; // defaults to today (YYYY-MM-DD)
  status?: 'present' | 'absent' | 'leave';
  sabaq: SabaqSectionDetail;
  sabqi: SabaqSectionDetail;
  manzil: SabaqSectionDetail;
  teacherNotes?: string;
}): Promise<string> {
  const targetOrg = params.organizationId || getActiveOrganizationIdSync() || DEFAULT_ORGANIZATION_ID;
  const targetOrgName = params.institutionName || DEFAULT_ORGANIZATION_NAME;
  const targetDate = params.date || new Date().toISOString().slice(0, 10);

  const docId = params.id || `${targetOrg}_${params.studentId}_${targetDate}`;
  const docRef = doc(db, 'sabaq_records', docId);

  const payload: SabaqDiaryEntry = {
    id: docId,
    organization_id: targetOrg,
    institution_name: targetOrgName,
    student_id: params.studentId,
    student_name: params.studentName,
    teacher_id: params.teacherId,
    teacher_name: params.teacherName,
    course_id: params.courseId || '',
    course_name: params.courseName || 'Hifz-ul-Quran / Dars',
    date: targetDate,
    status: params.status || 'present',
    sabaq: params.sabaq,
    sabqi: params.sabqi,
    manzil: params.manzil,
    teacher_notes: params.teacherNotes?.trim() || '',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  try {
    await withTimeout(
      setDoc(docRef, payload, { merge: true }),
      12000,
      'Recording daily sabaq timed out.'
    );
    // Also cache locally on success
    const existing = await getCachedStudentSabaqDiary(params.studentId);
    const existingIdx = existing.findIndex((e) => e.id === docId);
    let updated: SabaqDiaryEntry[];
    if (existingIdx >= 0) {
      updated = [...existing];
      updated[existingIdx] = payload;
    } else {
      updated = [payload, ...existing];
    }
    await cacheStudentSabaqDiary(params.studentId, updated);

    // Ghalati 2 Resolution: Dual-sync with official attendance collection
    try {
      const attCourseId = (params.courseId || 'general').trim() || 'general';
      const attDocId = getAttendanceDocId(params.studentId, targetDate, attCourseId);
      const attRef = doc(collection(db, 'attendance'), attDocId);
      await setDoc(attRef, {
        user_id: params.studentId,
        user_name: params.studentName,
        date: targetDate,
        status: params.status || 'present',
        course_id: attCourseId,
        marked_by: 'sabaq_diary',
        marked_by_uid: params.teacherId,
        marked_by_name: params.teacherName,
        organization_id: targetOrg,
        updated_at: serverTimestamp(),
      }, { merge: true });
    } catch (attErr) {
      console.warn('[SabaqDiary] Attendance dual-sync warning:', attErr);
    }
  } catch (err) {
    console.warn('[SabaqDiary] Network write failed/timed out, queuing offline:', err);
    await queueOfflineSabaqEntry(payload);
  }

  return docId;
}

/**
 * Retrieve cached Sabaq diary entries for a student from local storage
 */
export async function getCachedStudentSabaqDiary(studentId: string): Promise<SabaqDiaryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(SABAQ_CACHE_PREFIX + studentId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[SabaqDiary] Error loading cached diary:', err);
    return [];
  }
}

/**
 * Cache Sabaq diary entries for a student to local storage
 */
export async function cacheStudentSabaqDiary(studentId: string, entries: SabaqDiaryEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SABAQ_CACHE_PREFIX + studentId, JSON.stringify(entries));
  } catch (err) {
    console.warn('[SabaqDiary] Error saving cached diary:', err);
  }
}

/**
 * Queue an offline Sabaq entry to be synced when network is available
 */
export async function queueOfflineSabaqEntry(entry: SabaqDiaryEntry): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SABAQ_OFFLINE_QUEUE_KEY);
    let queue: SabaqDiaryEntry[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(queue)) queue = [];

    // Deduplicate by entry.id
    const idx = queue.findIndex((e) => e.id === entry.id);
    if (idx >= 0) {
      queue[idx] = entry;
    } else {
      queue.push(entry);
    }
    await AsyncStorage.setItem(SABAQ_OFFLINE_QUEUE_KEY, JSON.stringify(queue));

    // Also update student's local cache immediately so it shows right away
    const existing = await getCachedStudentSabaqDiary(entry.student_id);
    const existingIdx = existing.findIndex((e) => e.id === entry.id);
    let updated: SabaqDiaryEntry[];
    if (existingIdx >= 0) {
      updated = [...existing];
      updated[existingIdx] = entry;
    } else {
      updated = [entry, ...existing];
    }
    await cacheStudentSabaqDiary(entry.student_id, updated);
  } catch (err) {
    console.warn('[SabaqDiary] Error queuing offline entry:', err);
  }
}

/**
 * Get current count of queued offline entries
 */
export async function getOfflineSabaqQueueCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SABAQ_OFFLINE_QUEUE_KEY);
    if (!raw) return 0;
    const queue = JSON.parse(raw);
    return Array.isArray(queue) ? queue.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Get list of all queued offline entries
 */
export async function getOfflineSabaqQueue(): Promise<SabaqDiaryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(SABAQ_OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const queue = JSON.parse(raw);
    return Array.isArray(queue) ? queue : [];
  } catch {
    return [];
  }
}

/**
 * Flush and sync all offline queued Sabaq entries to Firestore
 */
export async function flushOfflineSabaqQueue(): Promise<{ synced: number; failed: number }> {
  try {
    const queue = await getOfflineSabaqQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    const remaining: SabaqDiaryEntry[] = [];

    for (const item of queue) {
      try {
        const docRef = doc(db, 'sabaq_records', item.id);
        const payload = {
          ...item,
          updated_at: serverTimestamp(),
        };
        await withTimeout(setDoc(docRef, payload, { merge: true }), 10000, 'Sync timed out');
        synced++;
      } catch (e) {
        remaining.push(item);
      }
    }

    await AsyncStorage.setItem(SABAQ_OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    return { synced, failed: remaining.length };
  } catch (err) {
    console.warn('[SabaqDiary] Error flushing queue:', err);
    return { synced: 0, failed: 0 };
  }
}

/**
 * Real-time subscription to a student's Sabaq diary history with instant local cache.
 */
export function subscribeToStudentSabaqDiary(
  studentId: string,
  callback: (entries: SabaqDiaryEntry[]) => void,
  orgId?: string
): () => void {
  const targetOrg = orgId || getActiveOrganizationIdSync() || DEFAULT_ORGANIZATION_ID;

  // 1. Immediately deliver cached data if available (0 ms response)
  void getCachedStudentSabaqDiary(studentId).then((cached) => {
    if (cached && cached.length > 0) {
      callback(cached);
    }
  });

  const baseQuery = query(
    collection(db, 'sabaq_records'),
    where('student_id', '==', studentId),
    where('organization_id', '==', targetOrg)
  );

  return onSnapshot(
    baseQuery,
    (snap) => {
      const list: SabaqDiaryEntry[] = [];
      snap.forEach((d) => {
        list.push(d.data() as SabaqDiaryEntry);
      });
      // Sort by date descending in memory
      list.sort((a, b) => b.date.localeCompare(a.date));
      void cacheStudentSabaqDiary(studentId, list);
      callback(list);
    },
    (err) => {
      console.warn('[SabaqDiary] Error fetching student diary (falling back to cache):', err);
      void getCachedStudentSabaqDiary(studentId).then((cached) => {
        if (cached && cached.length > 0) {
          callback(cached);
        } else {
          callback([]);
        }
      });
    }
  );
}

/**
 * Real-time subscription to all entries recorded on a specific date for a madrasa.
 */
export function subscribeToClassSabaqDiary(
  date: string,
  callback: (entries: SabaqDiaryEntry[]) => void,
  orgId?: string
): () => void {
  const targetOrg = orgId || getActiveOrganizationIdSync() || DEFAULT_ORGANIZATION_ID;

  const q = query(
    collection(db, 'sabaq_records'),
    where('organization_id', '==', targetOrg),
    where('date', '==', date)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list: SabaqDiaryEntry[] = [];
      snap.forEach((d) => {
        list.push(d.data() as SabaqDiaryEntry);
      });
      list.sort((a, b) => a.student_name.localeCompare(b.student_name));
      callback(list);
    },
    (err) => {
      console.warn('[SabaqDiary] Error fetching class diary:', err);
      callback([]);
    }
  );
}

/**
 * Format a rich Urdu + English WhatsApp message for parents.
 */
export function formatSabaqDiaryForWhatsApp(
  entry: SabaqDiaryEntry,
  madrasaName: string
): string {
  const sabaqCfg = SABAQ_GRADE_CONFIG[entry.sabaq.grade] || SABAQ_GRADE_CONFIG.Jayyid;
  const sabqiCfg = SABAQ_GRADE_CONFIG[entry.sabqi.grade] || SABAQ_GRADE_CONFIG.Jayyid;
  const manzilCfg = SABAQ_GRADE_CONFIG[entry.manzil.grade] || SABAQ_GRADE_CONFIG.Jayyid;

  const statusText =
    entry.status === 'present'
      ? 'حاضر (Present)'
      : entry.status === 'absent'
      ? 'غیر حاضر (Absent)'
      : 'رخصت (Leave)';

  return (
    `*السلام علیکم ورحمۃ اللہ وبرکاتہ*\n\n` +
    `محترم والدین!\n` +
    `*${madrasaName}* کی جانب سے آپ کی صاحبزادی کی یومیہ رپورٹ:\n\n` +
    `📋 *طالبہ کا نام (Student):* ${entry.student_name}\n` +
    `📅 *تاریخ (Date):* ${entry.date}\n` +
    `📍 *حاضری (Attendance):* ${statusText}\n\n` +
    `───────────────\n` +
    `📖 *سبق (New Lesson):*\n` +
    `${entry.sabaq.text || 'N/A'}\n` +
    `درجہ: *${sabaqCfg.arabic} — ${entry.sabaq.grade}*\n` +
    (entry.sabaq.mistakes !== undefined ? `غلطیاں/اٹکن: ${entry.sabaq.mistakes}\n` : '') +
    `\n` +
    `🔁 *سبقی (Recent Revision):*\n` +
    `${entry.sabqi.text || 'N/A'}\n` +
    `درجہ: *${sabqiCfg.arabic} — ${entry.sabqi.grade}*\n` +
    (entry.sabqi.mistakes !== undefined ? `غلطیاں/اٹکن: ${entry.sabqi.mistakes}\n` : '') +
    `\n` +
    `🌟 *منزل / دور (Manzil Revision):*\n` +
    `${entry.manzil.text || 'N/A'}` +
    (entry.manzil.juz ? ` (پارہ: ${entry.manzil.juz})` : '') +
    `\nدرجہ: *${manzilCfg.arabic} — ${entry.manzil.grade}*\n` +
    (entry.manzil.mistakes !== undefined ? `غلطیاں/اٹکن: ${entry.manzil.mistakes}\n` : '') +
    `───────────────\n` +
    (entry.teacher_notes ? `✍️ *استاذہ کا تبصرہ:* ${entry.teacher_notes}\n\n` : '') +
    `استاذہ: ${entry.teacher_name}\n` +
    `والسلام,\n` +
    `*${madrasaName}*`
  );
}
