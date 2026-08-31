import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface QuizCertificateData {
  id?: string;
  certificateId: string;
  userId: string;
  studentName: string;
  quizCategory: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  issueDateGregorian: string;
  issueDateHijri: string;
  gradeLabel: string;
  createdAtMs: number;
}

const HIJRI_MONTHS: Record<string, string> = {
  "Dhuʻl-Qiʻdah": 'Zul Qidah',
  "Dhu’l-Qi’dah": 'Zul Qidah',
  "Dhuʻl-Hijjah": 'Zul Hijjah',
  "Dhu’l-Hijjah": 'Zul Hijjah',
  'Dhu al-Hijjah': 'Zul Hijjah',
  'Rabiʻ I': 'Rabi al-Awwal',
  'Rabi’ I': 'Rabi al-Awwal',
  'Rabiʻ II': 'Rabi al-Thani',
  'Rabi’ II': 'Rabi al-Thani',
};

export function formatHijriDate(date: Date = new Date()): string {
  try {
    const raw = new Intl.DateTimeFormat('en-TN-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
    return Object.entries(HIJRI_MONTHS).reduce((value, [from, to]) => value.replace(from, to), raw);
  } catch {
    return '1447 AH';
  }
}

export function formatGregorianDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function generateCertificateSerialId(userId: string, category: string): string {
  const cleanCat = category.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'GEN';
  const year = new Date().getFullYear();
  const randomSalt = Math.random().toString(36).slice(2, 6).toUpperCase();
  const userPrefix = (userId || 'USR').slice(-3).toUpperCase();
  return `MSLB-QZ-${year}-${cleanCat}-${userPrefix}${randomSalt}`;
}

export function getGradeLabel(percentage: number): string {
  if (percentage >= 90) return 'Distinction (Mumtaz - ممتاز)';
  if (percentage >= 80) return 'Excellent (Jayyid Jiddan - جيد جدا)';
  if (percentage >= 70) return 'Very Good (Jayyid - جيد)';
  return 'Pass (Maqbool - مقبول)';
}

/**
 * Saves or updates a quiz certificate in Firestore
 */
export async function saveQuizCertificate(
  userId: string,
  studentName: string,
  quizCategory: string,
  score: number,
  totalQuestions: number,
): Promise<QuizCertificateData> {
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const certificateId = generateCertificateSerialId(userId, quizCategory);
  const now = new Date();
  const issueDateGregorian = formatGregorianDate(now);
  const issueDateHijri = formatHijriDate(now);
  const gradeLabel = getGradeLabel(percentage);

  const certData: QuizCertificateData = {
    certificateId,
    userId,
    studentName: studentName.trim() || 'Student',
    quizCategory,
    score,
    totalQuestions,
    percentage,
    issueDateGregorian,
    issueDateHijri,
    gradeLabel,
    createdAtMs: Date.now(),
  };

  try {
    const docRef = await addDoc(collection(db, 'certificates'), {
      certificate_id: certificateId,
      user_id: userId,
      user_name: certData.studentName,
      course_name: `Quiz: ${quizCategory}`,
      type: 'quiz_assessment',
      quiz_category: quizCategory,
      score,
      total_questions: totalQuestions,
      percentage,
      grade_label: gradeLabel,
      completion_date: issueDateGregorian,
      hijri_date: issueDateHijri,
      created_at: serverTimestamp(),
    });

    return { ...certData, id: docRef.id };
  } catch (err) {
    console.warn('[saveQuizCertificate] Firestore write failed, returning local cert data:', err);
    return certData;
  }
}
