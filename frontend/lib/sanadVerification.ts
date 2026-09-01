import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface VerifiedSanad {
  certificateId: string;
  studentName: string;
  courseName: string;
  completionDate: string;
  hijriDate?: string;
  gradeLabel?: string;
  scorePercentage?: number;
  issuingAuthority: string;
  verified: boolean;
  issuedAtTimestamp?: number;
}

export function getSanadVerificationUrl(certificateId: string): string {
  const cleanId = encodeURIComponent(certificateId || '');
  return 'https://mslb.app/verify-sanad?id=' + cleanId;
}

export function getSanadQrCodeUrl(certificateId: string): string {
  const targetUrl = encodeURIComponent(getSanadVerificationUrl(certificateId));
  return 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + targetUrl + '&margin=6&color=005F46';
}

export async function verifySanadById(rawCertificateId: string): Promise<VerifiedSanad | null> {
  const certId = (rawCertificateId || '').trim();
  if (!certId || certId.length < 3) return null;

  try {
    // 1. Direct doc lookup in certificates collection
    const directRef = doc(db, 'certificates', certId);
    const directSnap = await getDoc(directRef);

    if (directSnap.exists()) {
      const data = directSnap.data();
      return {
        certificateId: certId,
        studentName: data.user_name || data.student_name || 'طالبہ',
        courseName: data.course_name || data.quiz_category || 'علومِ اسلامیہ و فقہ',
        completionDate: data.completion_date || '2026',
        hijriDate: data.hijri_date || '1448ھ',
        gradeLabel: data.grade_label || 'ممتاز (Distinction)',
        scorePercentage: data.percentage || data.score || 100,
        issuingAuthority: 'مدرسۃ السالکات للبنات — شعبۂ امتحانات و اسناد',
        verified: true,
      };
    }

    // 2. Lookup by certificate_id field
    const q = query(
      collection(db, 'certificates'),
      where('certificate_id', '==', certId),
      limit(1)
    );
    const qSnap = await getDocs(q);

    if (!qSnap.empty) {
      const data = qSnap.docs[0].data();
      return {
        certificateId: certId,
        studentName: data.user_name || data.student_name || 'طالبہ',
        courseName: data.course_name || data.quiz_category || 'علومِ اسلامیہ و فقہ',
        completionDate: data.completion_date || '2026',
        hijriDate: data.hijri_date || '1448ھ',
        gradeLabel: data.grade_label || 'ممتاز (Distinction)',
        scorePercentage: data.percentage || data.score || 100,
        issuingAuthority: 'مدرسۃ السالکات للبنات — شعبۂ امتحانات و اسناد',
        verified: true,
      };
    }

    return null;
  } catch (err) {
    console.warn('[SanadVerification] Verification query failed:', err);
    return null;
  }
}
