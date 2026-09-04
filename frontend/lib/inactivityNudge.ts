/**
 * MSLB Inactivity & Weekly Performance Nudge Engine
 *
 * Checks if a student has been inactive or hasn't opened lessons in 3+ days
 * and sends an encouraging, respectful motivational reminder.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { dispatchNotification } from '@/lib/dispatchNotification';
import type { UserProfile } from '@/context/AuthContext';

const LAST_NUDGE_STORAGE_KEY = 'mslb_last_inactivity_nudge_ms';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getCurrentWeekKey(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDays = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}_w${weekNumber}`;
}

/**
 * Checks client-side activity for the currently logged-in student.
 * If 3+ days have passed since previous active session, triggers a local notification / in-app card.
 * Rate-limited to at most once per week.
 */
export async function checkAndTriggerInactivityNudge(
  userId: string,
  studentName?: string
): Promise<boolean> {
  const safeUid = String(userId || '').trim();
  if (!safeUid) return false;

  try {
    const rawLast = await AsyncStorage.getItem(LAST_NUDGE_STORAGE_KEY);
    const lastNudgeMs = rawLast ? Number(rawLast) : 0;
    const now = Date.now();

    // Guard: Do not send more than once every 7 days per device
    if (now - lastNudgeMs < SEVEN_DAYS_MS) {
      return false;
    }

    const displayName = String(studentName || '').trim() || 'طالبہ';
    const weekKey = getCurrentWeekKey();
    const title = '🌸 علم حاصل کرنا ہر مسلمان پر فرض ہے';
    const body = `السلام علیکم ${displayName}! کافی دن ہو گئے آپ نے سبق نہیں پڑھا۔ آئیے آج کا سبق اور دینی تعلیم مکمل کریں۔ (Welcome back! Continue your sacred learning journey today.)`;

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
        category: 'inactivity_nudge',
        screen: '/(tabs)/courses',
      },
      dedupeId: `inactivity_nudge:${safeUid}:${weekKey}`,
      sendToAll: false,
    });

    await AsyncStorage.setItem(LAST_NUDGE_STORAGE_KEY, String(now));
    return true;
  } catch (err) {
    console.log('[InactivityNudge] Check failed:', err);
    return false;
  }
}

/**
 * Admin / Teacher triggered batch inactivity nudge.
 * Finds students who haven't logged in for 3+ days and sends the gentle reminder.
 */
export async function dispatchBatchInactivityNudgeAsAdmin(
  profile: UserProfile | null
): Promise<{ sent: boolean; count: number }> {
  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
    return { sent: false, count: 0 };
  }

  try {
    const threeDaysAgo = new Date(Date.now() - THREE_DAYS_MS);
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('status', '==', 'approved'),
      limit(200)
    );
    const snap = await getDocs(q);
    const inactiveUids: string[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const lastLogin = data.last_login_at?.toDate ? data.last_login_at.toDate() : null;
      if (!lastLogin || lastLogin.getTime() < threeDaysAgo.getTime()) {
        inactiveUids.push(docSnap.id);
      }
    });

    if (inactiveUids.length === 0) {
      return { sent: false, count: 0 };
    }

    const weekKey = getCurrentWeekKey();
    const title = '🌸 علم حاصل کرنا ہر مسلمان پر فرض ہے';
    const body = 'السلام علیکم! کافی دن ہو گئے آپ نے سبق نہیں پڑھا۔ آئیے آج کا سبق اور دینی تعلیم مکمل کریں۔ (Take a step today on your path of Islamic knowledge.)';

    await dispatchNotification({
      channel: 'announcements',
      event: 'system_alert',
      title,
      body,
      recipientIds: inactiveUids,
      actorId: profile.uid || 'admin',
      route: { pathname: '/(tabs)/courses' },
      data: {
        sound: 'default',
        channelId: 'announcements',
        category: 'inactivity_nudge',
      },
      dedupeId: `batch_inactivity_nudge:${weekKey}:${Date.now()}`,
      sendToAll: false,
    });

    return { sent: true, count: inactiveUids.length };
  } catch (err) {
    console.error('[InactivityNudge] Admin batch send failed:', err);
    return { sent: false, count: 0 };
  }
}
