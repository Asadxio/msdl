/**
 * adminExportService.ts
 *
 * Provides 1-Click Excel / CSV Export for:
 * 1. Student Attendance Register (Full log with Present/Absent counts & %)
 * 2. Student Quiz Marks & Exam Results (Student names, scores, totals, percentages, status, dates)
 *
 * Utilizes Expo FileSystem & Sharing with UTF-8 BOM for flawless opening in Microsoft Excel.
 */

import { collection, getDocs, orderBy, query, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Share, Platform } from 'react-native';

export type ExportType = 'attendance' | 'quiz_marks';

/**
 * Helper to escape CSV values properly for Microsoft Excel & Google Sheets
 */
function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Fetch and generate 1-Click Attendance CSV Export
 */
export async function generateAttendanceCsv(): Promise<string> {
  // 1. Fetch attendance records
  const attSnap = await getDocs(
    query(collection(db, 'attendance'), orderBy('date', 'desc'), limit(5000))
  );

  // 2. Fetch users map for accurate names & emails
  const usersSnap = await getDocs(collection(db, 'users'));
  const userMap = new Map<string, { name: string; email: string }>();
  usersSnap.forEach((d) => {
    const u = d.data();
    userMap.set(d.id, {
      name: u.name || u.displayName || 'طالبہ (Student)',
      email: u.email || '',
    });
  });

  // 3. Fetch courses map for friendly names
  const coursesSnap = await getDocs(collection(db, 'courses'));
  const courseMap = new Map<string, string>();
  coursesSnap.forEach((d) => {
    courseMap.set(d.id, d.data().name || d.id);
  });

  const headers = [
    'Date (تاریخ)',
    'Student Name (طالبہ کا نام)',
    'Student Email',
    'Student UID',
    'Course / Class (کلاس)',
    'Attendance Status (حاضری)',
    'Marked By (اندراج کنندہ)',
    'Time Recorded (وقت)',
  ];

  const rows: string[] = [];

  attSnap.forEach((docSnap) => {
    const d = docSnap.data();
    const uInfo = userMap.get(d.user_id) || {
      name: d.user_name || 'Student',
      email: d.user_email || '',
    };
    const courseTitle = courseMap.get(d.course_id) || d.course_id || 'عام حاضری (General)';
    const statusStr = d.status === 'present' ? 'حاضر (Present)' : 'غیر حاضر (Absent)';
    const markedByStr = d.marked_by_name || d.marked_by || 'معلمہ / ایڈمن';
    let timeStr = '';
    try {
      const dt = d.marked_at?.toDate ? d.marked_at.toDate() : d.created_at?.toDate ? d.created_at.toDate() : null;
      timeStr = dt ? dt.toLocaleString() : '';
    } catch {
      timeStr = '';
    }

    rows.push(
      [
        escapeCsvCell(d.date || ''),
        escapeCsvCell(uInfo.name),
        escapeCsvCell(uInfo.email),
        escapeCsvCell(d.user_id || ''),
        escapeCsvCell(courseTitle),
        escapeCsvCell(statusStr),
        escapeCsvCell(markedByStr),
        escapeCsvCell(timeStr),
      ].join(',')
    );
  });

  // UTF-8 Byte Order Mark (\uFEFF) ensures Urdu & Arabic render perfectly in Microsoft Excel
  return '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
}

/**
 * Fetch and generate 1-Click Quiz Marks & Examination Results CSV
 * 12.5: Supports optional courseId filter
 */
export async function generateQuizMarksCsv(courseId?: string): Promise<string> {
  // 1. Fetch quiz_results (optionally filtered by course_id)
  const baseQuery = courseId
    ? query(collection(db, 'quiz_results'), where('course_id', '==', courseId), orderBy('created_at', 'desc'), limit(5000))
    : query(collection(db, 'quiz_results'), orderBy('created_at', 'desc'), limit(5000));

  let quizSnap;
  try {
    quizSnap = await getDocs(baseQuery);
  } catch {
    // Fallback without orderBy in case of compound index requirement
    const fallbackQuery = courseId
      ? query(collection(db, 'quiz_results'), where('course_id', '==', courseId), limit(5000))
      : query(collection(db, 'quiz_results'), limit(5000));
    quizSnap = await getDocs(fallbackQuery);
  }

  // 2. Fetch users map
  const usersSnap = await getDocs(collection(db, 'users'));
  const userMap = new Map<string, { name: string; email: string }>();
  usersSnap.forEach((d) => {
    const u = d.data();
    userMap.set(d.id, {
      name: u.name || u.displayName || 'طالبہ (Student)',
      email: u.email || '',
    });
  });

  const headers = [
    'Student Name (طالبہ کا نام)',
    'Student Email',
    'Student UID',
    'Course ID (کورس آئی ڈی)',
    'Quiz Category / Subject (مضمون)',
    'Obtained Marks (حاصل کردہ نمبر)',
    'Total Marks (کل نمبر)',
    'Percentage % (فیصد)',
    'Grade / Sanad Status (درجہ / سند کی حیثیت)',
    'Submission Date (تاریخ)',
  ];

  const rows: string[] = [];

  quizSnap.forEach((docSnap) => {
    const d = docSnap.data();
    const uInfo = userMap.get(d.user_id) || {
      name: d.user_name || 'Student',
      email: d.user_email || '',
    };
    const score = Number(d.score || 0);
    const total = Number(d.total_questions || 0);
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;

    let gradeStr = 'Needs Revision (اعادہ درکار)';
    if (pct >= 90) gradeStr = 'Mumtaz (ممتاز - Distinction)';
    else if (pct >= 80) gradeStr = 'Jayyid Jiddan (جید جداً - Very Good)';
    else if (pct >= 65) gradeStr = 'Jayyid (جید - Good)';
    else if (pct >= 50) gradeStr = 'Maqbool (مقبول - Pass)';

    let dateStr = '';
    try {
      const dt = d.created_at?.toDate ? d.created_at.toDate() : null;
      dateStr = dt ? dt.toLocaleString() : '';
    } catch {
      dateStr = '';
    }

    rows.push(
      [
        escapeCsvCell(uInfo.name),
        escapeCsvCell(uInfo.email),
        escapeCsvCell(d.user_id || ''),
        escapeCsvCell(d.course_id || 'عام / جنرل'),
        escapeCsvCell(d.category || 'عام دینی سوالات'),
        escapeCsvCell(score),
        escapeCsvCell(total),
        escapeCsvCell(`${pct}%`),
        escapeCsvCell(gradeStr),
        escapeCsvCell(dateStr),
      ].join(',')
    );
  });

  return '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
}

/**
 * 1-Click Export & Share Handler
 * Saves CSV to device file system and opens native share dialog (WhatsApp, Drive, Email, Excel).
 * 12.5: Accepts optional courseId and courseName for course-specific exports
 */
export async function exportAdminCsvAndShare(
  type: 'attendance' | 'quiz_marks',
  courseId?: string,
  courseName?: string,
): Promise<void> {
  const isAttendance = type === 'attendance';
  const csvData = isAttendance ? await generateAttendanceCsv() : await generateQuizMarksCsv(courseId);

  const timestamp = new Date().toISOString().slice(0, 10);
  const cleanCourse = courseName ? courseName.replace(/[^a-zA-Z0-9_-]/g, '_') : '';
  const fileName = isAttendance
    ? `MSLB_Students_Attendance_${timestamp}.csv`
    : courseId
    ? `MSLB_Quiz_${cleanCourse || courseId}_${timestamp}.csv`
    : `MSLB_Quiz_Marks_Results_${timestamp}.csv`;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
    }
    return;
  }

  const filePath = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(filePath, csvData, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const dialogTitle = isAttendance
    ? 'Download / Share Student Attendance Sheet'
    : courseName
    ? `Download / Share Quiz Marks for "${courseName}"`
    : 'Download / Share Quiz Marks & Examination Sheet';

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/csv',
      dialogTitle,
      UTI: 'public.comma-separated-values-text',
    });
  } else {
    await Share.share({
      title: dialogTitle,
      message: `Madrasatu-s-Salikat Lil Banat Excel Report:\n${fileName}`,
    });
  }
}
