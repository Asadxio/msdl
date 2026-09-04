import { getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/context/AuthContext';
import { dispatchNotification } from '@/lib/dispatchNotification';

export type NotificationPayload = {
  title: string;
  message: string;
  user_id?: string;
  sound?: 'default';
};

export async function createNotificationAsAdmin(
  profile: UserProfile | null,
  payload: NotificationPayload
): Promise<boolean> {
  if (profile?.role !== 'admin') return false;
  const title = payload.title.trim();
  const message = payload.message.trim();
  const userId = (payload.user_id || 'all').trim() || 'all';
  if (!title || !message) return false;

  const titleLower = title.toLowerCase();
  const isAnnouncement = titleLower.includes('announcement');
  const isClassReminder = titleLower.includes('class reminder') || titleLower.includes('reminder');
  const pushBody = isClassReminder ? 'Class reminder received. Open app for details.' : message;
  const category = isClassReminder ? 'class_reminder' : (isAnnouncement ? 'announcement' : 'notification');
  const sound = payload.sound || 'default';
  const channel = category === 'class_reminder' ? 'announcements' : 'default';

  await dispatchNotification({
    channel: 'announcements',
    event: isAnnouncement ? 'announcement_posted' : 'system_alert',
    title: isAnnouncement ? 'New Announcement' : title,
    body: pushBody,
    recipientIds: userId === 'all' ? [] : [userId],
    data: { sound, channelId: channel },
    dedupeId: `admin:${category}:${userId}:${title.toLowerCase().slice(0, 24)}`,
    sendToAll: userId === 'all',
  }).catch(() => {});
  return true;
}

export async function createRoleNotificationAsAdmin(
  profile: UserProfile | null,
  payload: NotificationPayload & { roles: ('student' | 'teacher')[]; category?: string }
): Promise<boolean> {
  if (profile?.role !== 'admin') return false;
  const title = payload.title.trim();
  const message = payload.message.trim();
  const safeRoles = Array.isArray(payload.roles) ? payload.roles : [];
  if (!title || !message || safeRoles.length === 0) return false;
  try {
    const uniqueRoles = Array.from(new Set(safeRoles));
    const roleSnapshots = await Promise.all(uniqueRoles.map(async (role) => getDocs(query(
      collection(db, 'users'),
      where('role', '==', role),
      where('status', '==', 'approved'),
    ))));
    const userIds = roleSnapshots.flatMap((snap) => snap.docs.map((d) => d.id)).filter(Boolean);
    const dedupedUserIds = Array.from(new Set(userIds));
    if (dedupedUserIds.length === 0) return false;
    await dispatchNotification({
      channel: 'announcements',
      event: payload.category === 'announcement' ? 'announcement_posted' : 'system_alert',
      title,
      body: message,
      recipientIds: dedupedUserIds,
      data: { sound: payload.sound || 'default', channelId: 'announcements' },
      dedupeId: `role_notice:${title.toLowerCase().slice(0, 20)}:${Date.now()}`,
    }).catch(() => {});
    return true;
  } catch (error) {
    console.log('[Notifications] createRoleNotificationAsAdmin ERROR', error);
    return false;
  }
}

export async function createRoleNotification(
  payload: NotificationPayload & { roles: ('student' | 'teacher')[]; category?: string }
): Promise<boolean> {
  const title = payload.title.trim();
  const message = payload.message.trim();
  const safeRoles = Array.isArray(payload.roles) ? payload.roles : [];
  if (!title || !message || safeRoles.length === 0) return false;
  try {
    const uniqueRoles = Array.from(new Set(safeRoles));
    const roleSnapshots = await Promise.all(uniqueRoles.map(async (role) => getDocs(query(
      collection(db, 'users'),
      where('role', '==', role),
      where('status', '==', 'approved'),
    ))));
    const userIds = roleSnapshots.flatMap((snap) => snap.docs.map((d) => d.id)).filter(Boolean);
    const dedupedUserIds = Array.from(new Set(userIds));
    if (dedupedUserIds.length === 0) return false;
    await dispatchNotification({
      channel: 'announcements',
      event: payload.category === 'announcement' ? 'announcement_posted' : 'system_alert',
      title,
      body: message,
      recipientIds: dedupedUserIds,
      data: { sound: payload.sound || 'default', channelId: 'announcements' },
      dedupeId: `role_notice:${title.toLowerCase().slice(0, 20)}:${Date.now()}`,
    }).catch(() => {});
    return true;
  } catch (error) {
    console.log('[Notifications] createRoleNotification ERROR', error);
    return false;
  }
}

/**
 * Dispatches a one-time welcome push & in-app notification to a newly registered student.
 * Idempotent via dedupeId `welcome:${userId}` — guaranteed to run strictly once per user.
 */
export async function dispatchWelcomeNotification(
  userId: string,
  studentName?: string
): Promise<boolean> {
  const safeUid = String(userId || '').trim();
  if (!safeUid) return false;

  const displayName = String(studentName || '').trim() || 'طالبہ';
  const title = '🌸 مدرسۃ السالکات میں خوش آمدید (Welcome!)';
  const body = `السلام علیکم ${displayName}! مدرسۃ السالکات میں آپ کا خیر مقدم ہے۔ (Welcome to Madrasatu-s-Salikat! Your learning journey begins today. Explore your courses & lessons.)`;

  try {
    await dispatchNotification({
      channel: 'announcements',
      event: 'system_alert',
      title,
      body,
      recipientIds: [safeUid],
      actorId: 'system',
      route: { pathname: '/(tabs)/courses' },
      data: {
        sound: 'default',
        channelId: 'announcements',
        category: 'welcome',
        screen: '/(tabs)/courses',
      },
      dedupeId: `welcome:${safeUid}`,
      sendToAll: false,
    });
    return true;
  } catch (error) {
    console.log('[Notifications] dispatchWelcomeNotification ERROR', error);
    return false;
  }
}

