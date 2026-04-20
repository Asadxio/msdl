import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/context/AuthContext';
import { sendPushToAllUsers, sendPushToUserIds } from '@/lib/pushNotifications';

export type NotificationPayload = {
  title: string;
  message: string;
  user_id?: string;
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

  await addDoc(collection(db, 'notifications'), {
    title,
    message,
    user_id: userId,
    category,
    read: {},
    created_at: serverTimestamp(),
  });

  if (userId === 'all') {
    await sendPushToAllUsers({
      title: isAnnouncement ? 'New Announcement' : title,
      body: pushBody,
      data: { type: category },
    }).catch(() => {});
  } else {
    await sendPushToUserIds([userId], {
      title,
      body: pushBody,
      data: { type: 'notification' },
    }).catch(() => {});
  }
  return true;
}
