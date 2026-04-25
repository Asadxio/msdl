import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/context/AuthContext';
import { sendPushToAllUsers, sendPushToUserIds } from '@/lib/pushNotifications';

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

  await addDoc(collection(db, 'notifications'), {
    title,
    message,
    user_id: userId,
    category,
    sound,
    read: {},
    created_at: serverTimestamp(),
  });

  if (userId === 'all') {
    await sendPushToAllUsers({
      title: isAnnouncement ? 'New Announcement' : title,
      body: pushBody,
      data: { type: category, sound },
    }).catch(() => {});
  } else {
    await sendPushToUserIds([userId], {
      title,
      body: pushBody,
      data: { type: 'notification', sound },
    }).catch(() => {});
  }
  return true;
}

export async function createRoleNotificationAsAdmin(
  profile: UserProfile | null,
  payload: NotificationPayload & { roles: Array<'student' | 'teacher'>; category?: string }
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
    await addDoc(collection(db, 'notifications'), {
      title,
      message,
      user_id: 'role_targeted',
      target_roles: uniqueRoles,
      target_user_ids: dedupedUserIds,
      category: payload.category || 'notification',
      sound: payload.sound || 'default',
      read: {},
      created_at: serverTimestamp(),
    });
    await sendPushToUserIds(dedupedUserIds, {
      title,
      body: message,
      data: { type: payload.category || 'notification', sound: payload.sound || 'default' },
    }).catch(() => {});
    return true;
  } catch (error) {
    console.log('[Notifications] createRoleNotificationAsAdmin ERROR', error);
    return false;
  }
}

export async function createRoleNotification(
  payload: NotificationPayload & { roles: Array<'student' | 'teacher'>; category?: string }
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
    await addDoc(collection(db, 'notifications'), {
      title,
      message,
      user_id: 'role_targeted',
      target_roles: uniqueRoles,
      target_user_ids: dedupedUserIds,
      category: payload.category || 'notification',
      sound: payload.sound || 'default',
      read: {},
      created_at: serverTimestamp(),
    });
    await sendPushToUserIds(dedupedUserIds, {
      title,
      body: message,
      data: { type: payload.category || 'notification', sound: payload.sound || 'default' },
    }).catch(() => {});
    return true;
  } catch (error) {
    console.log('[Notifications] createRoleNotification ERROR', error);
    return false;
  }
}
