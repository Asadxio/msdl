import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  limit,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { UserProfile } from '@/context/AuthContext';
import { dispatchNotification } from '@/lib/dispatchNotification';
import { ENROLLMENT_DOC_ID_SEPARATOR, allowsLegacyCourseAccessWhenEnrollmentMissing, getEnrollmentDocId, isActiveEnrollmentForUserCourse } from '@/lib/enrollments';

export type LiveClassStatus = 'scheduled' | 'waiting_room' | 'live' | 'paused' | 'reconnecting' | 'ended' | 'cancelled';

export type RecitationQueueItem = {
  uid: string;
  name: string;
  status: 'waiting' | 'speaking' | 'done';
  requested_at_ms: number;
};

export type LiveClass = {
  id: string;
  course_id: string;
  lesson_id?: string;
  teacher_id: string;
  teacher_name: string;
  title: string;
  status: LiveClassStatus;
  meet_url: string;
  purdah_mode_enabled?: boolean;
  active_board_view?: 'mushaf' | 'makharij' | 'whiteboard' | 'notes';
  current_ayah_or_page?: string | number;
  highlighted_words?: string[];
  active_speaker_name?: string;
  active_speaker_uid?: string;
  recitation_queue?: RecitationQueueItem[];
  started_at?: { toDate?: () => Date } | null;
  ended_at?: { toDate?: () => Date } | null;
  created_at?: { toDate?: () => Date } | null;
  updated_at?: { toDate?: () => Date } | null;
};

export type LiveClassCreateInput = {
  courseId: string;
  lessonId?: string;
  title: string;
  teacherId: string;
  teacherName: string;
  meetUrl: string;
  profile: UserProfile | null;
  purdahModeEnabled?: boolean;
};

export function normalizeLiveClass(id: string, data: any): LiveClass {
  return { id, ...data } as LiveClass;
}

export async function canCurrentUserJoinLiveClass(liveClass: LiveClass, profile: UserProfile | null): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid || !profile) return false;
  if (profile.role === 'admin') return true;
  if (profile.role === 'teacher') return liveClass.teacher_id === uid;
  const enrollmentId = getEnrollmentDocId(uid, liveClass.course_id);
  if (!enrollmentId || enrollmentId === ENROLLMENT_DOC_ID_SEPARATOR) return false;
  const enrollmentSnap = await getDoc(doc(db, 'enrollments', enrollmentId)).catch(() => null);
  if (enrollmentSnap?.exists()) return isActiveEnrollmentForUserCourse(enrollmentSnap.data(), uid, liveClass.course_id);
  return profile.role === 'student' && allowsLegacyCourseAccessWhenEnrollmentMissing((liveClass as any).enrollment_source);
}

export async function startLiveClass(input: LiveClassCreateInput): Promise<string> {
  if (input.profile?.role !== 'admin' && input.profile?.role !== 'super_admin' && input.profile?.role !== 'teacher') {
    throw new Error('Only admins and teachers can start live classes');
  }

  const meetRegex = /^https?:\/\/(meet\.google\.com\/[a-z0-9\-]+|meet\.google\.com\/lookup\/[a-z0-9\-]+)(?:\?.*)?$/i;
  if (!meetRegex.test(input.meetUrl.trim())) {
    throw new Error('Invalid Google Meet URL. Please provide a valid link (e.g. https://meet.google.com/abc-defg-hij)');
  }

  const activeQ = query(
    collection(db, 'live_classes'),
    where('course_id', '==', input.courseId),
    where('status', '==', 'live'),
    limit(1)
  );
  const activeDocs = await getDocs(activeQ);
  if (!activeDocs.empty) {
    throw new Error('A live class is already running for this course.');
  }

  const docRef = await addDoc(collection(db, 'live_classes'), {
    course_id: input.courseId,
    lesson_id: input.lessonId || null,
    teacher_id: input.teacherId,
    teacher_name: input.teacherName,
    title: input.title,
    status: 'live',
    meet_url: input.meetUrl.trim(),
    purdah_mode_enabled: input.purdahModeEnabled !== false,
    active_board_view: 'mushaf',
    current_ayah_or_page: 1,
    highlighted_words: [],
    recitation_queue: [],
    started_at: serverTimestamp(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  try {
    const enrolledQ = query(
      collection(db, 'enrollments'),
      where('course_id', '==', input.courseId),
      where('status', '==', 'active')
    );
    const enrolledDocs = await getDocs(enrolledQ);
    const enrolledUids = enrolledDocs.docs.map(d => d.data().user_id).filter(Boolean);

    await dispatchNotification({
      channel: 'live_classes',
      event: 'live_class_started',
      title: '🔴 Live Class Started',
      body: `${input.teacherName} has started a live class for ${input.title}. Tap to join now!`,
      recipientIds: enrolledUids,
      sendToAll: false,
      route: { pathname: '/course/[id]', params: { id: input.courseId } },
    });
  } catch (err) {
    console.error('Failed to send live class push notification:', err);
  }

  return docRef.id;
}

export async function updatePurdahBoardState(
  classId: string,
  updates: {
    active_board_view?: 'mushaf' | 'makharij' | 'whiteboard' | 'notes';
    current_ayah_or_page?: string | number;
    highlighted_words?: string[];
    active_speaker_name?: string;
    active_speaker_uid?: string;
  }
): Promise<void> {
  const ref = doc(db, 'live_classes', classId);
  await updateDoc(ref, {
    ...updates,
    updated_at: serverTimestamp(),
  });
}

export async function raiseHandForRecitation(
  classId: string,
  student: { uid: string; name: string }
): Promise<void> {
  const ref = doc(db, 'live_classes', classId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const currentQueue: RecitationQueueItem[] = snap.data().recitation_queue || [];
  if (currentQueue.some((q) => q.uid === student.uid)) return;

  const newQueue = [
    ...currentQueue,
    {
      uid: student.uid,
      name: student.name,
      status: 'waiting' as const,
      requested_at_ms: Date.now(),
    },
  ];

  await updateDoc(ref, {
    recitation_queue: newQueue,
    updated_at: serverTimestamp(),
  });
}

export async function grantMicrophone(
  classId: string,
  targetUid: string,
  targetName: string
): Promise<void> {
  const ref = doc(db, 'live_classes', classId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const currentQueue: RecitationQueueItem[] = snap.data().recitation_queue || [];
  const updatedQueue = currentQueue.map((item) => ({
    ...item,
    status: item.uid === targetUid ? ('speaking' as const) : item.status === 'speaking' ? ('waiting' as const) : item.status,
  }));

  await updateDoc(ref, {
    recitation_queue: updatedQueue,
    active_speaker_name: targetName,
    active_speaker_uid: targetUid,
    updated_at: serverTimestamp(),
  });
}

export async function lowerHandRecitation(
  classId: string,
  targetUid: string
): Promise<void> {
  const ref = doc(db, 'live_classes', classId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const currentQueue: RecitationQueueItem[] = snap.data().recitation_queue || [];
  const updatedQueue = currentQueue.filter((item) => item.uid !== targetUid);

  const activeUid = snap.data().active_speaker_uid;
  const isTargetActive = activeUid === targetUid;

  await updateDoc(ref, {
    recitation_queue: updatedQueue,
    ...(isTargetActive ? { active_speaker_name: '', active_speaker_uid: '' } : {}),
    updated_at: serverTimestamp(),
  });
}

export async function endLiveClass(classId: string, profile: UserProfile | null): Promise<void> {
  if (profile?.role !== 'admin' && profile?.role !== 'super_admin' && profile?.role !== 'teacher') {
    throw new Error('Only admins and teachers can end live classes');
  }
  const ref = doc(db, 'live_classes', classId);
  await updateDoc(ref, {
    status: 'ended',
    ended_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
}

export async function setLiveClassStatus(classId: string, status: LiveClassStatus): Promise<void> {
  const ref = doc(db, 'live_classes', classId);
  await updateDoc(ref, {
    status,
    updated_at: serverTimestamp(),
  });
}

export function subscribeLiveClass(classId: string, onUpdate: (data: LiveClass | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'live_classes', classId), (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(normalizeLiveClass(snapshot.id, snapshot.data()));
    } else {
      onUpdate(null);
    }
  });
}

export function subscribeActiveLiveClass(courseId: string, callback: (liveClass: LiveClass | null) => void): Unsubscribe {
  const q = query(
    collection(db, 'live_classes'),
    where('course_id', '==', courseId),
    where('status', '==', 'live'),
    limit(1),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.empty ? null : normalizeLiveClass(snap.docs[0].id, snap.docs[0].data()));
  }, () => callback(null));
}

export function subscribeLiveClasses(courseId: string, onUpdate: (classes: LiveClass[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'live_classes'),
    where('course_id', '==', courseId),
    orderBy('created_at', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const classes = snapshot.docs.map((d) => normalizeLiveClass(d.id, d.data()));
    onUpdate(classes);
  });
}
