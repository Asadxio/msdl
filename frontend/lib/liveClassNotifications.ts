/**
 * MSLB Live Class Notifications — 10-Minute Reminder Engine
 *
 * Dispatches automated reminders to enrolled students ~10 minutes
 * before a scheduled live class begins.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { dispatchNotification } from '@/lib/dispatchNotification';

export type LiveClassReminderInput = {
  classId: string;
  courseId: string;
  courseName: string;
  teacherName: string;
  meetUrl?: string;
};

/**
 * Sends a 10-minute countdown reminder to all students actively enrolled in the course.
 * Deduplicated via `class_reminder_10m:${classId}` to ensure it is never sent twice.
 */
export async function dispatchLiveClass10MinReminder(
  input: LiveClassReminderInput
): Promise<{ sent: boolean; recipientCount: number }> {
  const safeClassId = String(input.classId || '').trim();
  const safeCourseId = String(input.courseId || '').trim();
  if (!safeClassId || !safeCourseId) {
    return { sent: false, recipientCount: 0 };
  }

  const courseTitle = String(input.courseName || '').trim() || 'کورس';
  const ustaadhaName = String(input.teacherName || '').trim() || 'استادہ';

  try {
    // 1. Fetch active enrolled students for this course
    const enrolledQ = query(
      collection(db, 'enrollments'),
      where('course_id', '==', safeCourseId),
      where('status', '==', 'active')
    );
    const enrolledSnap = await getDocs(enrolledQ);
    const enrolledUids = Array.from(
      new Set(enrolledSnap.docs.map((d) => d.data().user_id).filter(Boolean))
    );

    if (enrolledUids.length === 0) {
      console.log('[LiveClassReminder] No enrolled students found for course:', safeCourseId);
      return { sent: false, recipientCount: 0 };
    }

    const title = '⏰ درس کا وقت قریب ہے (Class Starting in 10 Mins)';
    const body = `🌸 Sabaq Reminder: Aapki ${courseTitle} class 10 minute me shuru hone wali hai (${ustaadhaName}). Tayyar rahein!`;

    // 2. Dispatch push + in-app notification with strict deduplication
    await dispatchNotification({
      channel: 'live_classes',
      event: 'live_class_reminder',
      title,
      body,
      recipientIds: enrolledUids,
      actorId: 'system',
      route: { pathname: '/course/[id]', params: { id: safeCourseId } },
      data: {
        live_class_id: safeClassId,
        course_id: safeCourseId,
        channelId: 'announcements',
        sound: 'default',
        type: 'live_class_reminder',
      },
      dedupeId: `class_reminder_10m:${safeClassId}`,
      sendToAll: false,
    });

    console.log(`[LiveClassReminder] Successfully triggered 10-min reminder to ${enrolledUids.length} students.`);
    return { sent: true, recipientCount: enrolledUids.length };
  } catch (err) {
    console.error('[LiveClassReminder] Failed to dispatch 10-minute reminder:', err);
    return { sent: false, recipientCount: 0 };
  }
}
