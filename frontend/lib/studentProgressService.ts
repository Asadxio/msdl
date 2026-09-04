/**
 * studentProgressService.ts — Phase 46 Progress Enhancements
 *
 * Implements:
 * 4.1 Attendance progress stats
 * 4.2 Study streak counter calculation
 * 4.3 Weekly study goal persistence and progress calculation
 * 4.4 Student academic progress export to Excel/CSV & Share
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const WEEKLY_GOAL_STORAGE_KEY = '@msdl_student_weekly_goal_v1';

export interface WeeklyGoalConfig {
  targetQuizzes: number;
  updatedAt: string;
}

export interface StudyStreakResult {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  isActiveToday: boolean;
}

export interface AttendanceProgressSummary {
  totalSessions: number;
  presentSessions: number;
  absentSessions: number;
  attendancePct: number;
  status: 'optimal' | 'warning' | 'critical';
}

/**
 * 4.2 Study streak calculation
 */
export function calculateStudyStreak(activityDates: string[]): StudyStreakResult {
  if (!activityDates || activityDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      isActiveToday: false,
    };
  }

  const uniqueDates = Array.from(
    new Set(
      activityDates
        .filter((d) => Boolean(d) && typeof d === 'string')
        .map((d) => d.slice(0, 10))
    )
  ).sort((a, b) => b.localeCompare(a));

  if (uniqueDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      isActiveToday: false,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const isActiveToday = uniqueDates[0] === today;
  const isStartingFromYesterday = uniqueDates[0] === yesterday;

  let currentStreak = 0;
  if (isActiveToday || isStartingFromYesterday) {
    let checkDate = new Date(uniqueDates[0]);
    currentStreak = 1;

    for (let i = 1; i < uniqueDates.length; i++) {
      const prevExpectedDate = new Date(checkDate);
      prevExpectedDate.setDate(prevExpectedDate.getDate() - 1);
      const expectedStr = prevExpectedDate.toISOString().slice(0, 10);

      if (uniqueDates[i] === expectedStr) {
        currentStreak++;
        checkDate = prevExpectedDate;
      } else {
        break;
      }
    }
  }

  let longestStreak = currentStreak;
  let tempStreak = 1;
  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const d1 = new Date(uniqueDates[i]);
    const d2 = new Date(uniqueDates[i + 1]);
    const diffDays = Math.round((d1.getTime() - d2.getTime()) / (1000 * 3600 * 24));
    if (diffDays === 1) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 1;
    }
  }

  return {
    currentStreak,
    longestStreak,
    lastActiveDate: uniqueDates[0],
    isActiveToday,
  };
}

/**
 * 4.3 Weekly Goal Persistence
 */
export async function loadWeeklyGoal(uid: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(`${WEEKLY_GOAL_STORAGE_KEY}_${uid}`);
    if (!raw) return 5;
    const parsed: WeeklyGoalConfig = JSON.parse(raw);
    return parsed.targetQuizzes || 5;
  } catch {
    return 5;
  }
}

export async function saveWeeklyGoal(uid: string, targetQuizzes: number): Promise<void> {
  try {
    const config: WeeklyGoalConfig = {
      targetQuizzes: Math.max(1, Math.min(50, targetQuizzes)),
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(`${WEEKLY_GOAL_STORAGE_KEY}_${uid}`, JSON.stringify(config));
  } catch (err) {
    console.warn('[studentProgressService] saveWeeklyGoal error:', err);
  }
}

/**
 * Count activities in current calendar week
 */
export function getQuizzesThisWeek(quizDates: string[]): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const distanceToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - distanceToMonday);
  monday.setHours(0, 0, 0, 0);

  const startOfWeekIso = monday.toISOString().slice(0, 10);

  return quizDates.filter((d) => d && d.slice(0, 10) >= startOfWeekIso).length;
}

function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * 4.4 Student Academic Progress Export
 */
export async function exportStudentProgressCsv(params: {
  studentName: string;
  studentEmail: string;
  overallAccuracy: number;
  totalAttempts: number;
  streakDays: number;
  attendance: AttendanceProgressSummary;
  quizResults: Array<{
    category?: string;
    score?: number;
    total_questions?: number;
    created_at?: { toDate?: () => Date };
  }>;
}): Promise<void> {
  const { studentName, studentEmail, overallAccuracy, totalAttempts, streakDays, attendance, quizResults } = params;

  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push(escapeCsvCell('MADRASATU-S-SALIKAT LIL BANAT (MSLB) - STUDENT PROGRESS REPORT'));
  lines.push(escapeCsvCell(`Report Date: ${today}`));
  lines.push(escapeCsvCell(`Student Name: ${studentName || 'Student'}`));
  lines.push(escapeCsvCell(`Student Email: ${studentEmail || 'N/A'}`));
  lines.push('');

  lines.push(escapeCsvCell('--- EXECUTIVE SUMMARY & KEY STATS ---'));
  lines.push(
    [
      escapeCsvCell('Overall Accuracy (%)'),
      escapeCsvCell('Quizzes Completed'),
      escapeCsvCell('Study Streak (Days)'),
      escapeCsvCell('Attendance Rate (%)'),
      escapeCsvCell('Present Sessions'),
      escapeCsvCell('Total Sessions'),
    ].join(',')
  );
  lines.push(
    [
      escapeCsvCell(`${overallAccuracy}%`),
      escapeCsvCell(totalAttempts),
      escapeCsvCell(streakDays),
      escapeCsvCell(`${attendance.attendancePct}%`),
      escapeCsvCell(attendance.presentSessions),
      escapeCsvCell(attendance.totalSessions),
    ].join(',')
  );
  lines.push('');

  lines.push(escapeCsvCell('--- QUIZ RESULTS & EXAMINATION HISTORY ---'));
  lines.push(
    [
      escapeCsvCell('#'),
      escapeCsvCell('Date (تاریخ)'),
      escapeCsvCell('Category / Subject (مضمون)'),
      escapeCsvCell('Score Obtained'),
      escapeCsvCell('Total Questions'),
      escapeCsvCell('Percentage (%)'),
      escapeCsvCell('Status'),
    ].join(',')
  );

  quizResults.forEach((q, idx) => {
    let dateStr = 'Recent';
    try {
      if (q.created_at?.toDate) {
        dateStr = q.created_at.toDate().toISOString().slice(0, 10);
      }
    } catch {
      dateStr = 'Recent';
    }

    const total = q.total_questions || 0;
    const score = q.score || 0;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const status = pct >= 60 ? 'کامیاب (Passed)' : 'توجہ طلب (Needs Revision)';

    lines.push(
      [
        escapeCsvCell(idx + 1),
        escapeCsvCell(dateStr),
        escapeCsvCell(q.category || 'General Quiz'),
        escapeCsvCell(score),
        escapeCsvCell(total),
        escapeCsvCell(`${pct}%`),
        escapeCsvCell(status),
      ].join(',')
    );
  });

  const csvContent = '\uFEFF' + lines.join('\n');
  const safeName = (studentName || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `MSLB_My_Progress_${safeName}_${today}.csv`;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
    }
    return;
  }

  const filePath = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(filePath, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/csv',
      dialogTitle: 'Export My Progress Report',
      UTI: 'public.comma-separated-values-text',
    });
  }
}