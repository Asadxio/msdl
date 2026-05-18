import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { UserProfile } from '@/context/AuthContext';
import { sendPushToUserIds } from '@/lib/pushNotifications';

export type LiveClassStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';

export type LiveClass = {
  id: string;
  course_id: string;
  lesson_id?: string;
  teacher_id: string;
  teacher_name: string;
  title: string;
  status: LiveClassStatus;
  channel_name: string;
  agora_app_id?: string;
  meet_fallback_url?: string;
  student_ids?: string[];
  enrollment_source?: 'enrollments' | 'course_student_ids' | 'none';
  token_expires_at_epoch?: number;
  started_at?: { toDate?: () => Date } | null;
  ended_at?: { toDate?: () => Date } | null;
  created_at?: { toDate?: () => Date } | null;
  updated_at?: { toDate?: () => Date } | null;
  participant_count?: number;
  recording?: {
    status: 'not_started' | 'starting' | 'recording' | 'processing' | 'ready' | 'failed';
    recording_id?: string;
    playback_url?: string;
    storage_path?: string;
  };
  screen_share?: {
    enabled: boolean;
    presenter_id?: string;
  };
};

export type LiveClassParticipant = {
  id: string;
  user_id: string;
  agora_uid: number;
  name: string;
  role: 'teacher' | 'student' | 'admin';
  joined: boolean;
  audio_enabled: boolean;
  video_enabled: boolean;
  force_muted?: boolean;
  is_speaking?: boolean;
  joined_at?: { toDate?: () => Date } | null;
  last_joined_at?: { toDate?: () => Date } | null;
  left_at?: { toDate?: () => Date } | null;
  total_duration_seconds?: number;
};

export type LiveClassCreateInput = {
  courseId: string;
  lessonId?: string;
  title: string;
  teacherId: string;
  teacherName: string;
  meetFallbackUrl?: string;
  profile: UserProfile | null;
};

export const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';
const LIVE_API_URL = process.env.EXPO_PUBLIC_LIVE_API_URL || process.env.EXPO_PUBLIC_PUSH_API_URL || '';
const LIVE_API_SETUP_MESSAGE = 'Live classes are not configured yet. Please set EXPO_PUBLIC_LIVE_API_URL in your Expo environment.';
const ENROLLMENT_LOOKUP_LIMIT = 500;
const MIN_LIVE_ATTENDANCE_SECONDS = 60;
const MAX_LIVE_ATTENDANCE_SECONDS = 4 * 60 * 60;
type JsonMap = Record<string, unknown>;

export function isLiveApiConfigured(): boolean {
  return Boolean(String(LIVE_API_URL || '').trim());
}

export function getLiveApiSetupMessage(): string {
  return LIVE_API_SETUP_MESSAGE;
}

function asMap(value: unknown): JsonMap {
  return value && typeof value === 'object' ? (value as JsonMap) : {};
}

export function getAgoraUid(uid: string): number {
  let hash = 0;
  for (let i = 0; i < uid.length; i += 1) {
    hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 2147480000) + 1;
}

export function getLiveClassChannelName(courseId: string, classId?: string): string {
  const safeCourse = String(courseId || 'course').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 48);
  const safeClass = String(classId || Date.now()).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 48);
  return `madrasa_${safeCourse}_${safeClass}`;
}

function normalizeLiveClass(id: string, raw: unknown): LiveClass {
  const data = asMap(raw);
  const recording = asMap(data.recording);
  const screenShare = asMap(data.screen_share);
  const status = data.status;
  const recordingStatus = recording.status;
  return {
    id,
    course_id: String(data.course_id || ''),
    lesson_id: data.lesson_id ? String(data.lesson_id) : '',
    teacher_id: String(data.teacher_id || ''),
    teacher_name: String(data.teacher_name || 'Teacher'),
    title: String(data.title || 'Live Class'),
    status: status === 'ended' || status === 'cancelled' || status === 'scheduled' ? status : 'live',
    channel_name: String(data.channel_name || ''),
    agora_app_id: data.agora_app_id ? String(data.agora_app_id) : '',
    meet_fallback_url: data.meet_fallback_url ? String(data.meet_fallback_url) : '',
    student_ids: Array.isArray(data.student_ids) ? data.student_ids.filter((v: unknown): v is string => typeof v === 'string') : [],
    enrollment_source: data.enrollment_source === 'enrollments' || data.enrollment_source === 'course_student_ids' || data.enrollment_source === 'none' ? data.enrollment_source : undefined,
    token_expires_at_epoch: Number(data.token_expires_at_epoch || 0) || undefined,
    started_at: (data.started_at as LiveClass['started_at']) || null,
    ended_at: (data.ended_at as LiveClass['ended_at']) || null,
    created_at: (data.created_at as LiveClass['created_at']) || null,
    updated_at: (data.updated_at as LiveClass['updated_at']) || null,
    participant_count: Number(data.participant_count || 0),
    recording: { status: recordingStatus === 'starting' || recordingStatus === 'recording' || recordingStatus === 'processing' || recordingStatus === 'ready' || recordingStatus === 'failed' ? recordingStatus : 'not_started' },
    screen_share: screenShare.enabled === true ? { enabled: true, presenter_id: String(screenShare.presenter_id || '') } : { enabled: false },
  };
}

export function normalizeLiveClassParticipant(id: string, raw: unknown): LiveClassParticipant {
  const data = asMap(raw);
  return {
    id,
    user_id: String(data.user_id || id),
    agora_uid: Number(data.agora_uid || 0),
    name: String(data.name || 'Participant'),
    role: data.role === 'admin' || data.role === 'teacher' ? data.role : 'student',
    joined: data.joined === true,
    audio_enabled: data.audio_enabled !== false,
    video_enabled: data.video_enabled !== false,
    force_muted: data.force_muted === true,
    is_speaking: data.is_speaking === true,
    joined_at: (data.joined_at as LiveClassParticipant['joined_at']) || null,
    last_joined_at: (data.last_joined_at as LiveClassParticipant['last_joined_at']) || null,
    left_at: (data.left_at as LiveClassParticipant['left_at']) || null,
    total_duration_seconds: Number(data.total_duration_seconds || 0),
  };
}

async function getEligibleStudentIds(courseId: string): Promise<{ ids: string[]; source: LiveClass['enrollment_source'] }> {
  const courseSnap = await getDoc(doc(db, 'courses', courseId)).catch(() => null);
  const courseStudentIds: string[] = courseSnap?.exists() && Array.isArray(courseSnap.data()?.student_ids)
    ? courseSnap.data()?.student_ids.filter((v: unknown): v is string => typeof v === 'string')
    : [];
  if (courseStudentIds.length > 0) {
    return { ids: Array.from(new Set(courseStudentIds)).slice(0, ENROLLMENT_LOOKUP_LIMIT), source: 'course_student_ids' };
  }

  const enrollmentSnap = await getDocs(query(
    collection(db, 'enrollments'),
    where('course_id', '==', courseId),
    where('status', '==', 'active'),
    limit(ENROLLMENT_LOOKUP_LIMIT),
  )).catch(() => null);
  const enrollmentIds = enrollmentSnap?.docs
    .map((d) => String(asMap(d.data()).user_id || ''))
    .filter(Boolean) || [];
  if (enrollmentIds.length > 0) {
    return { ids: Array.from(new Set(enrollmentIds)), source: 'enrollments' };
  }

  return { ids: [], source: 'none' };
}

export async function startLiveClass(input: LiveClassCreateInput): Promise<string> {
  if (!input.teacherId || !input.courseId) throw new Error('Missing teacher or course.');
  if (input.profile?.role !== 'teacher' && input.profile?.role !== 'admin') {
    throw new Error('Only teachers/admins can start live classes.');
  }
  const activeSnap = await getDocs(query(
    collection(db, 'live_classes'),
    where('course_id', '==', input.courseId),
    where('status', '==', 'live'),
    limit(1),
  ));
  if (!activeSnap.empty) return activeSnap.docs[0].id;

  const { ids: studentIds, source } = await getEligibleStudentIds(input.courseId);
  const ref = doc(collection(db, 'live_classes'));
  await setDoc(ref, {
    course_id: input.courseId,
    lesson_id: input.lessonId || '',
    teacher_id: input.teacherId,
    teacher_name: input.teacherName || 'Teacher',
    title: input.title || 'Live Class',
    status: 'live',
    channel_name: getLiveClassChannelName(input.courseId, ref.id),
    agora_app_id: AGORA_APP_ID,
    meet_fallback_url: input.meetFallbackUrl || '',
    student_ids: studentIds,
    enrollment_source: source,
    participant_count: 0,
    recording: { status: 'not_started', recording_id: '', playback_url: '', storage_path: '' },
    screen_share: { enabled: false, presenter_id: '' },
    started_at: serverTimestamp(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  if (studentIds.length > 0) {
    await addDoc(collection(db, 'notifications'), {
      title: 'Live Class Started',
      message: `${input.title || 'Live class'} has started. Join from the app now.`,
      user_id: 'role_targeted',
      target_user_ids: studentIds,
      target_roles: ['student'],
      category: 'live_class_started',
      sound: 'default',
      read: {},
      created_at: serverTimestamp(),
    }).catch(() => {});
    await sendPushToUserIds(studentIds, {
      title: 'Live Class Started',
      body: `${input.title || 'Live class'} is live now.`,
      data: { type: 'live_class_started', live_class_id: ref.id, course_id: input.courseId, channelId: 'announcements' },
    }).catch(() => {});
  }
  return ref.id;
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

export function subscribeLiveClass(classId: string, callback: (liveClass: LiveClass | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'live_classes', classId), (snap) => {
    callback(snap.exists() ? normalizeLiveClass(snap.id, snap.data()) : null);
  }, () => callback(null));
}

export function subscribeLiveParticipants(classId: string, callback: (participants: LiveClassParticipant[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'live_classes', classId, 'participants'), orderBy('joined_at', 'asc')), (snap) => {
    callback(snap.docs.map((d) => normalizeLiveClassParticipant(d.id, d.data())));
  }, () => callback([]));
}


type LiveClassTokenResponse = {
  appId: string;
  rtcToken: string;
  expiresAtEpoch: number;
  agoraUid: number;
  channelName: string;
};

function getLiveApiBaseUrl(): string {
  return LIVE_API_URL.replace(/\/$/, '');
}

async function requestLiveBackend<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const baseUrl = getLiveApiBaseUrl();
  if (!baseUrl) throw new Error(LIVE_API_SETUP_MESSAGE);
  if (!auth.currentUser) throw new Error('Please sign in again.');
  const idToken = await auth.currentUser.getIdToken();
  const runFetch = () => fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  let response: Response | null = await runFetch().catch(() => null);
  if (!response) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    response = await runFetch();
  }
  const payload = await response.json().catch((): Record<string, unknown> => ({}));
  if (!response.ok) {
    const detail = typeof payload.detail === 'string' ? payload.detail : '';
    throw new Error(detail || `Live API request failed (${response.status})`);
  }
  return payload as T;
}

export async function requestLiveClassToken(classId: string): Promise<LiveClassTokenResponse> {
  const payload = await requestLiveBackend<any>('/api/live-class/token', { live_class_id: classId });
  return {
    appId: String(payload.app_id || ''),
    rtcToken: String(payload.rtc_token || ''),
    expiresAtEpoch: Number(payload.expires_at_epoch || 0),
    agoraUid: Number(payload.agora_uid || 0),
    channelName: String(payload.channel_name || ''),
  };
}

export async function startCloudRecording(classId: string): Promise<Record<string, unknown>> {
  const payload = await requestLiveBackend<any>('/api/live-class/recording/start', { live_class_id: classId });
  return payload.recording || {};
}

export async function stopCloudRecording(classId: string): Promise<Record<string, unknown>> {
  const payload = await requestLiveBackend<any>('/api/live-class/recording/stop', { live_class_id: classId });
  return payload.recording || {};
}

export async function markParticipantJoined(classId: string, profile: UserProfile, userId: string, agoraUid = getAgoraUid(userId)): Promise<void> {
  const participantRef = doc(db, 'live_classes', classId, 'participants', userId);
  await setDoc(participantRef, {
    user_id: userId,
    agora_uid: agoraUid,
    name: profile.name || 'Participant',
    role: profile.role || 'student',
    joined: true,
    audio_enabled: true,
    video_enabled: true,
    force_muted: false,
    joined_at: serverTimestamp(),
    last_joined_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  }, { merge: true });
  await addDoc(collection(db, 'live_classes', classId, 'attendance_events'), {
    user_id: userId,
    event: 'join',
    at: serverTimestamp(),
  }).catch(() => {});
}

export async function markParticipantLeft(classId: string, userId: string, joinedAt?: Date | null): Promise<void> {
  const now = new Date();
  const duration = joinedAt ? Math.min(MAX_LIVE_ATTENDANCE_SECONDS, Math.max(0, Math.round((now.getTime() - joinedAt.getTime()) / 1000))) : 0;
  await setDoc(doc(db, 'live_classes', classId, 'participants', userId), {
    joined: false,
    audio_enabled: false,
    video_enabled: false,
    left_at: serverTimestamp(),
    total_duration_seconds: increment(duration),
    updated_at: serverTimestamp(),
  }, { merge: true });
  await addDoc(collection(db, 'live_classes', classId, 'attendance_events'), {
    user_id: userId,
    event: 'leave',
    duration_seconds: duration,
    at: serverTimestamp(),
  }).catch(() => {});
}

export async function updateParticipantMediaState(
  classId: string,
  userId: string,
  updates: Partial<Pick<LiveClassParticipant, 'audio_enabled' | 'video_enabled' | 'force_muted' | 'is_speaking'>>,
): Promise<void> {
  await updateDoc(doc(db, 'live_classes', classId, 'participants', userId), {
    ...updates,
    updated_at: serverTimestamp(),
  });
}

function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function endLiveClassAndSyncAttendance(classId: string, liveClass: LiveClass, endedBy: UserProfile | null): Promise<void> {
  if (endedBy?.role !== 'teacher' && endedBy?.role !== 'admin') throw new Error('Only teacher/admin can end class.');
  const markerUid = auth.currentUser?.uid || liveClass.teacher_id;
  const participantSnap = await getDocs(collection(db, 'live_classes', classId, 'participants'));
  const batch = writeBatch(db);
  const now = new Date();
  const date = getDateKey(now);
  const eligibleStudentIds = new Set(liveClass.student_ids || []);
  participantSnap.docs.forEach((participantDoc) => {
    const p = normalizeLiveClassParticipant(participantDoc.id, participantDoc.data());
    const joinedAt = p.last_joined_at?.toDate ? p.last_joined_at.toDate() : null;
    const liveDuration = p.joined && joinedAt ? Math.max(0, Math.round((now.getTime() - joinedAt.getTime()) / 1000)) : 0;
    const totalDuration = Math.min(MAX_LIVE_ATTENDANCE_SECONDS, Math.max(0, Number(p.total_duration_seconds || 0) + liveDuration));
    batch.set(participantDoc.ref, {
      joined: false,
      audio_enabled: false,
      video_enabled: false,
      left_at: Timestamp.fromDate(now),
      total_duration_seconds: totalDuration,
      updated_at: serverTimestamp(),
    }, { merge: true });
    if (p.role === 'student' && eligibleStudentIds.has(p.user_id) && totalDuration >= MIN_LIVE_ATTENDANCE_SECONDS) {
      batch.set(doc(db, 'attendance', `${p.user_id}_${date}`), {
        user_id: p.user_id,
        user_name: p.name,
        user_email: '',
        date,
        status: 'present',
        marked_by: 'live_class',
        marked_by_uid: markerUid,
        marked_by_name: endedBy?.name || liveClass.teacher_name,
        live_class_id: classId,
        course_id: liveClass.course_id,
        duration_seconds: totalDuration,
        marked_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }, { merge: true });
    }
  });
  batch.set(doc(db, 'live_classes', classId), {
    status: 'ended',
    participant_count: 0,
    ended_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
}

export async function canCurrentUserJoinLiveClass(liveClass: LiveClass, profile: UserProfile | null): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid || !profile) return false;
  if (profile.role === 'admin') return true;
  if (profile.role === 'teacher') return liveClass.teacher_id === uid;
  if (Array.isArray(liveClass.student_ids) && liveClass.student_ids.includes(uid)) return true;
  const enrollmentSnap = await getDocs(query(
    collection(db, 'enrollments'),
    where('course_id', '==', liveClass.course_id),
    where('user_id', '==', uid),
    where('status', '==', 'active'),
    limit(1),
  )).catch(() => null);
  return !!enrollmentSnap && !enrollmentSnap.empty;
}
