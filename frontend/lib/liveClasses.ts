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
import { dispatchLiveClass10MinReminder } from '@/lib/liveClassNotifications';

export { dispatchLiveClass10MinReminder };

export type LiveClassStatus = 'scheduled' | 'waiting_room' | 'live' | 'paused' | 'reconnecting' | 'ended' | 'cancelled';

export type RecitationQueueItem = {
  uid: string;
  name: string;
  status: 'waiting' | 'speaking' | 'done';
  requested_at_ms: number;
};

export type LiveClass = {
  id: string;
  organization_id?: string;
  course_id: string;
  lesson_id?: string;
  teacher_id: string;
  teacher_name: string;
  title: string;
  status: LiveClassStatus;
  meet_url: string;
  purdah_mode_enabled?: boolean;
  audio_muted_all?: boolean;
  camera_disabled_all?: boolean;
  privacy_shield_active?: boolean;
  privacy_updated_at_ms?: number;
  active_board_view?: 'mushaf' | 'makharij' | 'whiteboard' | 'notes';
  current_ayah_or_page?: string | number;
  highlighted_words?: string[];
  active_speaker_name?: string;
  active_speaker_uid?: string;
  recitation_queue?: RecitationQueueItem[];
  started_at?: { toDate?: () => Date } | null;
  scheduled_start_at?: { toDate?: () => Date } | null;
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
  scheduledStartAt?: Date | null;
  // organizationId: the caller's active org. Required for tenant scoping.
  // Must be derived from the authenticated admin/teacher's own org context.
  // Never accept from untrusted user input.
  organizationId?: string;
};

export function normalizeLiveClass(id: string, data: any): LiveClass {
  return { id, ...data } as LiveClass;
}

export async function canCurrentUserJoinLiveClass(liveClass: LiveClass, profile: UserProfile | null): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid || !profile) return false;

  const status = String(profile.status || '').toLowerCase().trim();
  if (status === 'suspended' || status === 'rejected' || status === 'pending') {
    return false;
  }

  const role = String(profile.role || '').toLowerCase().trim();
  if (profile.role === 'admin' || role === 'admin' || role === 'super_admin') {
    return true;
  }

  if (role === 'teacher' || role === 'assistant_teacher') {
    return liveClass.teacher_id === uid || Boolean(liveClass.course_id);
  }

  const courseId = String(liveClass.course_id || '').trim();
  if (!courseId) return false;

  const enrollmentId = getEnrollmentDocId(uid, courseId);
  if (!enrollmentId || enrollmentId === ENROLLMENT_DOC_ID_SEPARATOR) return false;
  const enrollmentSnap = await getDoc(doc(db, 'enrollments', enrollmentId)).catch(() => null);
  if (enrollmentSnap?.exists()) return isActiveEnrollmentForUserCourse(enrollmentSnap.data(), uid, courseId);
  return role === 'student' && allowsLegacyCourseAccessWhenEnrollmentMissing((liveClass as any).enrollment_source);
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
    // organization_id: only written when provided by caller's authorized org context
    ...(input.organizationId ? { organization_id: input.organizationId } : {}),
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
        data: {
          live_class_id: docRef.id,
          course_id: input.courseId,
        },
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

function verifyTeacherOrAdmin(profile: UserProfile | null, actionName: string) {
  if (profile?.role !== 'admin' && profile?.role !== 'super_admin' && profile?.role !== 'teacher') {
    throw new Error(`Only admins and teachers can ${actionName}`);
  }
}

export async function muteAllStudents(classId: string, profile: UserProfile | null): Promise<void> {
  verifyTeacherOrAdmin(profile, 'mute all students');
  const ref = doc(db, 'live_classes', classId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const currentQueue: RecitationQueueItem[] = snap.data().recitation_queue || [];
  // Reset any speaking queue item back to waiting
  const resetQueue = currentQueue.map((item) => ({
    ...item,
    status: item.status === 'speaking' ? ('waiting' as const) : item.status,
  }));

  await updateDoc(ref, {
    audio_muted_all: true,
    active_speaker_name: '',
    active_speaker_uid: '',
    recitation_queue: resetQueue,
    privacy_updated_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  });
}

export async function unmuteAllStudents(classId: string, profile: UserProfile | null): Promise<void> {
  verifyTeacherOrAdmin(profile, 'unmute all students');
  const ref = doc(db, 'live_classes', classId);
  await updateDoc(ref, {
    audio_muted_all: false,
    privacy_updated_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  });
}

export async function killAllVideo(
  classId: string,
  profile: UserProfile | null,
  disabled: boolean = true
): Promise<void> {
  verifyTeacherOrAdmin(profile, 'toggle video privacy');
  const ref = doc(db, 'live_classes', classId);
  await updateDoc(ref, {
    camera_disabled_all: disabled,
    purdah_mode_enabled: true,
    privacy_updated_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  });
}

export async function toggleEmergencyPrivacyShield(
  classId: string,
  profile: UserProfile | null,
  active: boolean
): Promise<void> {
  verifyTeacherOrAdmin(profile, 'toggle emergency privacy shield');
  const ref = doc(db, 'live_classes', classId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const currentQueue: RecitationQueueItem[] = snap.data().recitation_queue || [];
  const resetQueue = active
    ? currentQueue.map((item) => ({
        ...item,
        status: item.status === 'speaking' ? ('waiting' as const) : item.status,
      }))
    : currentQueue;

  await updateDoc(ref, {
    privacy_shield_active: active,
    camera_disabled_all: active ? true : snap.data().camera_disabled_all,
    audio_muted_all: active ? true : snap.data().audio_muted_all,
    ...(active ? { active_speaker_name: '', active_speaker_uid: '' } : {}),
    recitation_queue: resetQueue,
    purdah_mode_enabled: true,
    privacy_updated_at_ms: Date.now(),
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


// ?? Phase 3: Scoped Live Class Query Engine ?????????????????????????????????

export type LiveClassListItem = {
  id: string;
  title: string;
  teacher_name: string;
  status: 'scheduled' | 'live' | 'ended';
  class_time?: string;
  time?: string;
  course_id?: string;
  organization_id?: string;
};

export interface ScopedLiveClassesOptions {
  userUid?: string;
  profile?: UserProfile | null;
  enrolledCourseIds?: string[];
  assignedCourseIds?: string[];
  organizationId?: string;
  isDefaultOrg?: boolean;
}

export interface ScopedQueryPlan {
  type: 'empty' | 'admin' | 'teacher' | 'student';
  queries: any[];
  reason?: string;
}

export function buildScopedLiveClassQueries(options: ScopedLiveClassesOptions): ScopedQueryPlan {
  const { userUid, profile, enrolledCourseIds = [], assignedCourseIds = [], organizationId, isDefaultOrg = true } = options;

  if (!userUid || !profile) {
    return { type: 'empty', queries: [], reason: 'Unauthenticated' };
  }

  const status = String(profile.status || '').toLowerCase().trim();
  if (status === 'suspended' || status === 'rejected' || status === 'pending') {
    return { type: 'empty', queries: [], reason: `User account is ${status}` };
  }

  const role = String(profile.role || '').toLowerCase().trim();

  // ?? 1. Admins & Super Admins: Institutional listing ??
  if (role === 'admin' || role === 'super_admin') {
    const baseCol = collection(db, 'live_classes');
    const q = (!isDefaultOrg && organizationId)
      ? query(baseCol, where('organization_id', '==', organizationId), orderBy('status', 'asc'))
      : query(baseCol, orderBy('status', 'asc'));
    return { type: 'admin', queries: [q] };
  }

  // ?? 2. Teachers: Own hosted classes + assigned courses ??
  if (role === 'teacher' || role === 'assistant_teacher') {
    const queries: any[] = [];
    const baseCol = collection(db, 'live_classes');

    // Query 1: Classes hosted by this teacher
    const hostQ = (!isDefaultOrg && organizationId)
      ? query(baseCol, where('organization_id', '==', organizationId), where('teacher_id', '==', userUid))
      : query(baseCol, where('teacher_id', '==', userUid));
    queries.push(hostQ);

    // Query 2: Classes for assigned courses (chunked <= 25)
    const validAssigned = Array.from(new Set(assignedCourseIds.map((c) => String(c || '').trim()).filter(Boolean)));
    const CHUNK_SIZE = 25;
    for (let i = 0; i < validAssigned.length; i += CHUNK_SIZE) {
      const chunk = validAssigned.slice(i, i + CHUNK_SIZE);
      const courseQ = (!isDefaultOrg && organizationId)
        ? query(baseCol, where('organization_id', '==', organizationId), where('course_id', 'in', chunk))
        : query(baseCol, where('course_id', 'in', chunk));
      queries.push(courseQ);
    }

    return { type: 'teacher', queries };
  }

  // ?? 3. Students: ONLY actively enrolled courses ??
  if (role === 'student') {
    const validEnrolled = Array.from(new Set(enrolledCourseIds.map((c) => String(c || '').trim()).filter(Boolean)));
    // If student has 0 active enrollments, NEVER execute an open query!
    if (validEnrolled.length === 0) {
      return { type: 'empty', queries: [], reason: 'No active course enrollments' };
    }

    const queries: any[] = [];
    const baseCol = collection(db, 'live_classes');
    const CHUNK_SIZE = 25;
    for (let i = 0; i < validEnrolled.length; i += CHUNK_SIZE) {
      const chunk = validEnrolled.slice(i, i + CHUNK_SIZE);
      const courseQ = (!isDefaultOrg && organizationId)
        ? query(baseCol, where('organization_id', '==', organizationId), where('course_id', 'in', chunk))
        : query(baseCol, where('course_id', 'in', chunk));
      queries.push(courseQ);
    }

    return { type: 'student', queries };
  }

  // Unknown or untrusted role
  return { type: 'empty', queries: [], reason: `Unrecognized role: ${role}` };
}

export function subscribeScopedLiveClasses(
  options: ScopedLiveClassesOptions,
  onUpdate: (classes: LiveClassListItem[]) => void,
  onError?: (error: any) => void
): Unsubscribe {
  const plan = buildScopedLiveClassQueries(options);

  if (plan.type === 'empty' || plan.queries.length === 0) {
    onUpdate([]);
    return () => {};
  }

  const queryResults = new Map<number, LiveClassListItem[]>();
  const unsubs: Unsubscribe[] = [];

  const emitMerged = () => {
    const itemsMap = new Map<string, LiveClassListItem>();
    for (const list of queryResults.values()) {
      for (const item of list) {
        if (item.status !== 'ended') {
          itemsMap.set(item.id, item);
        }
      }
    }

    const merged = Array.from(itemsMap.values());
    merged.sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 'live') return -1;
        if (b.status === 'live') return 1;
      }
      return String(a.title || '').localeCompare(String(b.title || ''));
    });

    onUpdate(merged);
  };

  plan.queries.forEach((q, idx) => {
    try {
      const unsub = onSnapshot(
        q,
        (snapshot: any) => {
          const list: LiveClassListItem[] = [];
          snapshot.forEach((docSnap: any) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              title: data.title || 'Untitled Class',
              teacher_name: data.teacher_name || 'Unknown Teacher',
              status: data.status || 'scheduled',
              class_time: data.class_time || data.time || 'TBD',
              course_id: data.course_id || '',
              organization_id: data.organization_id || '',
            });
          });
          queryResults.set(idx, list);
          emitMerged();
        },
        (err: any) => {
          if (onError) onError(err);
        }
      );
      unsubs.push(unsub);
    } catch (err) {
      if (onError) onError(err);
    }
  });

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {}
    });
  };
}
