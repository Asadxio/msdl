import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { logger } from '@/lib/logger';

export type NotificationChannel =
  | 'chat'
  | 'story'
  | 'live_class'
  | 'calls'
  | 'assignments'
  | 'announcements'
  | 'attendance'
  | 'admin';

export type AppNotificationType =
  | 'chat_message'
  | 'incoming_call'
  | 'missed_call'
  | 'live_class_started'
  | 'live_class_reminder'
  | 'status_reaction'
  | 'status_comment'
  | 'assignment_alert'
  | 'attendance_alert'
  | 'announcement';

export type NotificationPreferences = {
  channels: Record<NotificationChannel, boolean>;
  muted_chat_ids: string[];
  quiet_hours: { enabled: boolean; start_minute: number; end_minute: number };
  sound_enabled: boolean;
  vibration_enabled: boolean;
  updated_at_ms: number;
};

const DEFAULT_PREFS: NotificationPreferences = {
  channels: {
    chat: true,
    story: true,
    live_class: true,
    calls: true,
    assignments: true,
    announcements: true,
    attendance: true,
    admin: true,
  },
  muted_chat_ids: [],
  quiet_hours: { enabled: false, start_minute: 1320, end_minute: 420 },
  sound_enabled: true,
  vibration_enabled: true,
  updated_at_ms: Date.now(),
};

const eventSeen = new Set<string>();

export function dedupeNotificationEvent(key: string): boolean {
  const safe = String(key || '').trim();
  if (!safe) return false;
  if (eventSeen.has(safe)) return true;
  eventSeen.add(safe);
  if (eventSeen.size > 300) {
    const it = eventSeen.values();
    for (let i = 0; i < 80; i += 1) {
      const next = it.next();
      if (next.done) break;
      eventSeen.delete(next.value);
    }
  }
  return false;
}

export function resolveRouteFromNotificationData(data: Record<string, unknown>): string | null {
  const directUrl = String(data.url || data.route || '').trim();
  if (directUrl && directUrl.startsWith('/')) return directUrl;
  if (data.type === 'prayer_alarm') return '/prayer-times';
  const callId = String(data.call_id || '').trim();
  if (callId) return `/call/${callId}`;
  const chatId = String(data.chat_id || '').trim();
  if (chatId) return `/chat/${chatId}`;
  const classId = String(data.live_class_id || '').trim();
  if (classId) return `/live-class/${classId}`;
  const courseId = String(data.course_id || '').trim();
  if (courseId) return `/course/${courseId}`;
  const statusId = String(data.status_id || '').trim();
  if (statusId) return '/status';
  return '/notifications';
}


export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const uid = String(userId || '').trim();
  if (!uid) return { ...DEFAULT_PREFS };
  const snap = await getDoc(doc(db, 'user_notification_settings', uid)).catch(() => null);
  if (!snap?.exists()) return { ...DEFAULT_PREFS };
  const data = snap.data() as any;
  return {
    channels: { ...DEFAULT_PREFS.channels, ...(data.channels || {}) },
    muted_chat_ids: Array.isArray(data.muted_chat_ids) ? data.muted_chat_ids.filter((v: unknown) => typeof v === 'string') : [],
    quiet_hours: {
      enabled: Boolean(data.quiet_hours?.enabled),
      start_minute: Number(data.quiet_hours?.start_minute ?? DEFAULT_PREFS.quiet_hours.start_minute),
      end_minute: Number(data.quiet_hours?.end_minute ?? DEFAULT_PREFS.quiet_hours.end_minute),
    },
    sound_enabled: data.sound_enabled !== false,
    vibration_enabled: data.vibration_enabled !== false,
    updated_at_ms: Number(data.updated_at_ms || 0) || Date.now(),
  };
}

export async function updateNotificationPreferences(userId: string, patch: Partial<NotificationPreferences>): Promise<void> {
  const uid = String(userId || '').trim();
  if (!uid) return;
  await setDoc(doc(db, 'user_notification_settings', uid), {
    ...patch,
    updated_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  }, { merge: true });
}

export async function shouldDeliverNotification(userId: string, channel: NotificationChannel, data: Record<string, unknown> = {}): Promise<boolean> {
  const prefs = await getNotificationPreferences(userId);
  if (prefs.channels[channel] === false) return false;
  const chatId = String(data.chat_id || '').trim();
  if (chatId && prefs.muted_chat_ids.includes(chatId)) return false;
  if (prefs.quiet_hours.enabled) {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const start = prefs.quiet_hours.start_minute;
    const end = prefs.quiet_hours.end_minute;
    const inQuiet = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    if (inQuiet && channel !== 'calls') return false;
  }
  return true;
}

export async function createNotificationRecord(input: {
  user_id: string;
  title: string;
  message: string;
  category: string;
  data?: Record<string, unknown>;
  dedupe_id: string;
}): Promise<boolean> {
  const dedupe = String(input.dedupe_id || '').trim();
  if (!dedupe) return false;
  const markerRef = doc(db, 'notification_dedupe', dedupe);
  const marker = await getDoc(markerRef).catch(() => null);
  if (marker?.exists()) return false;
  await setDoc(markerRef, { created_at: serverTimestamp(), created_at_ms: Date.now(), user_id: input.user_id }, { merge: true }).catch((err) => {
    logger.warn('Failed to write notification_dedupe marker', err);
  });
  await addDoc(collection(db, 'notifications'), {
    title: input.title,
    message: input.message,
    user_id: input.user_id,
    category: input.category,
    data: input.data || {},
    dedupe_id: dedupe,
    read: {},
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
  });
  return true;
}


export function getCurrentUserId(): string {
  return String(auth.currentUser?.uid || '');
}
