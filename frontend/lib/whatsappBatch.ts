/**
 * MSLB Course-wise WhatsApp Batch Messaging Engine
 *
 * Allows Admins and Teachers to trigger WhatsApp notices and live class links
 * to all students enrolled in a specific course batch.
 */

import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { Linking } from 'react-native';
import { db } from '@/lib/firebase';
import { MADRASA_WEBSITE_URL } from '@/lib/links';

export type EnrolledStudentContact = {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  guardianPhone?: string;
};

/**
 * Resolves all active enrolled students and their contact info for a specific course.
 */
export async function fetchCourseEnrolledContacts(courseId: string): Promise<EnrolledStudentContact[]> {
  const safeCourseId = String(courseId || '').trim();
  if (!safeCourseId) return [];

  try {
    const enrollmentsQ = query(
      collection(db, 'enrollments'),
      where('course_id', '==', safeCourseId),
      where('status', '==', 'active')
    );
    const snap = await getDocs(enrollmentsQ);
    const userIds = Array.from(new Set(snap.docs.map((d) => d.data().user_id).filter(Boolean)));

    if (userIds.length === 0) return [];

    const contacts: EnrolledStudentContact[] = [];

    await Promise.all(
      userIds.map(async (uid) => {
        try {
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            const rawPhone = String(data.phone || data.phone_number || data.whatsapp || '').trim();
            const rawGuardian = String(data.guardian_phone || data.parent_phone || '').trim();
            contacts.push({
              uid,
              name: String(data.name || data.displayName || 'طالبہ').trim(),
              email: String(data.email || '').trim(),
              phone: rawPhone || undefined,
              guardianPhone: rawGuardian || undefined,
            });
          }
        } catch {
          // ignore single user lookup failure
        }
      })
    );

    return contacts;
  } catch (err) {
    console.error('[WhatsAppBatch] Failed to fetch enrolled contacts:', err);
    return [];
  }
}

/**
 * Builds a beautifully formatted Urdu/English Islamic notice for the course batch.
 */
export function buildCourseWhatsAppMessage(params: {
  courseName: string;
  teacherName?: string;
  meetUrl?: string;
  classTime?: string;
  customNote?: string;
}): string {
  const courseTitle = params.courseName.trim() || 'کورس';
  const ustaadha = (params.teacherName || '').trim();
  const link = (params.meetUrl || '').trim() || MADRASA_WEBSITE_URL;
  const time = (params.classTime || '').trim();
  const note = (params.customNote || '').trim();

  const lines: string[] = [
    '🌸 *مدرسۃ السالکات للبنات - باضابطہ اطلاع*',
    'السلام علیکم ورحمۃ اللہ وبرکاتہ',
    '',
    `محترم طالبات! آپ کے کورس *"${courseTitle}"* کا تعلیمی پیغام درج ذیل ہے:`,
  ];

  if (ustaadha) {
    lines.push(`👩‍🏫 *استادہ:* ${ustaadha}`);
  }
  if (time) {
    lines.push(`⏰ *وقت:* ${time}`);
  }
  if (note) {
    lines.push(`📝 *ہدایت / نوٹس:* ${note}`);
  }

  lines.push('');
  lines.push(`🔗 *درس / کلاس کا لنک:*`);
  lines.push(link);
  lines.push('');
  lines.push('برائے مہربانی وقت کی پابندی فرمائیں اور سبق میں لازماً شریک ہوں۔');
  lines.push('جزاکم اللہ خیرًا');
  lines.push('_مدرسۃ السالکات Lil Banat_');

  return lines.join('\n');
}


/**
 * Opens WhatsApp with the pre-filled batch notice.
 * Can be shared to a WhatsApp group or broadcast list.
 */
export async function openWhatsAppBroadcast(message: string): Promise<boolean> {
  const encoded = encodeURIComponent(message);
  const url = `whatsapp://send?text=${encoded}`;
  const webUrl = `https://api.whatsapp.com/send?text=${encoded}`;

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    } else {
      await Linking.openURL(webUrl);
      return true;
    }
  } catch (err) {
    console.error('[WhatsAppBatch] Could not open WhatsApp:', err);
    return false;
  }
}

/**
 * Opens direct chat with a specific phone number with the pre-filled message.
 */
export async function openWhatsAppDirectStudent(phone: string, message: string): Promise<boolean> {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (!cleaned) return false;

  const encoded = encodeURIComponent(message);
  const url = `whatsapp://send?phone=${cleaned}&text=${encoded}`;
  const webUrl = `https://wa.me/${cleaned}?text=${encoded}`;

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    } else {
      await Linking.openURL(webUrl);
      return true;
    }
  } catch (err) {
    console.error('[WhatsAppBatch] Could not open direct student chat:', err);
    return false;
  }
}
