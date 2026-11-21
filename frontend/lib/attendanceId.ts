/**
 * frontend/lib/attendanceId.ts
 *
 * MSLB Phase 1 P0 Remediation: Shared Deterministic Attendance Document ID Engine
 *
 * Guarantees idempotent, deterministic document IDs across:
 * - /live-class/[id].tsx (in-class attendance modal)
 * - /(tabs)/attendance.tsx (dedicated attendance screen)
 *
 * Format: att_{userId}_{date}_{courseId}
 * Timezone: Asia/Kolkata (Indian Standard Time, default institutional time zone)
 */

export const ATTENDANCE_DOC_ID_PREFIX = 'att_';
export const DEFAULT_INSTITUTIONAL_TIMEZONE = 'Asia/Kolkata';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates whether a string is a valid YYYY-MM-DD calendar date.
 */
export function isValidDateString(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (!DATE_REGEX.test(trimmed)) return false;

  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Exact calendar validity (handles leap years & month lengths)
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Formats a Date object or epoch timestamp into an institutional YYYY-MM-DD string
 * using the specified timezone (default: Asia/Kolkata).
 */
export function getInstitutionalDateString(
  dateInput: Date | number = new Date(),
  timeZone: string = DEFAULT_INSTITUTIONAL_TIMEZONE
): string {
  const dateObj = typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(dateObj.getTime())) {
    throw new Error('[attendanceId] Invalid Date input provided to getInstitutionalDateString.');
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(dateObj);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`[attendanceId] Failed to format date parts for timezone "${timeZone}".`);
  }

  return `${year}-${month}-${day}`;
}

/**
 * Generates the canonical deterministic Firestore document ID for an attendance record:
 * att_{userId}_{date}_{courseId}
 *
 * @throws Error if any key component is missing, contains slashes, or fails date validation.
 */
export function getAttendanceDocId(
  userId: unknown,
  date: unknown,
  courseId: unknown
): string {
  const cleanUid = String(userId ?? '').trim();
  const cleanDate = String(date ?? '').trim();
  const cleanCourse = String(courseId ?? '').trim();

  if (!cleanUid) {
    throw new Error('[attendanceId] userId is required and cannot be empty.');
  }
  if (cleanUid.includes('/')) {
    throw new Error('[attendanceId] userId cannot contain forward slashes.');
  }
  if (/\d{4}-\d{2}-\d{2}/.test(cleanUid)) {
    throw new Error('[attendanceId] userId cannot contain date patterns (YYYY-MM-DD).');
  }

  if (!cleanDate) {
    throw new Error('[attendanceId] date is required and cannot be empty.');
  }
  if (!isValidDateString(cleanDate)) {
    throw new Error(
      `[attendanceId] date must be a valid calendar date in YYYY-MM-DD format (received "${cleanDate}").`
    );
  }

  if (!cleanCourse) {
    throw new Error('[attendanceId] courseId is required and cannot be empty.');
  }
  if (cleanCourse.includes('/')) {
    throw new Error('[attendanceId] courseId cannot contain forward slashes.');
  }

  return `${ATTENDANCE_DOC_ID_PREFIX}${cleanUid}_${cleanDate}_${cleanCourse}`;
}

/**
 * Checks whether a Firestore document ID follows the canonical deterministic attendance pattern.
 */
export function isDeterministicAttendanceDocId(docId: string): boolean {
  if (typeof docId !== 'string' || !docId.startsWith(ATTENDANCE_DOC_ID_PREFIX)) {
    return false;
  }
  return parseAttendanceDocId(docId) !== null;
}

/**
 * Decomposes a deterministic attendance document ID into its constituent components.
 * Returns null if the docId does not conform to the canonical format.
 */
export function parseAttendanceDocId(
  docId: string
): { userId: string; date: string; courseId: string } | null {
  if (typeof docId !== 'string' || !docId.startsWith(ATTENDANCE_DOC_ID_PREFIX)) {
    return null;
  }

  const payload = docId.slice(ATTENDANCE_DOC_ID_PREFIX.length);
  // Expected: {userId}_{YYYY-MM-DD}_{courseId}
  // Non-greedy on userId ensures the first valid date delimiter anchors the parsing cleanly
  const match = payload.match(/^(.+?)_(\d{4}-\d{2}-\d{2})_(.+)$/);
  if (!match) return null;

  const [, userId, date, courseId] = match;
  if (!userId || !courseId || !isValidDateString(date)) {
    return null;
  }

  return { userId, date, courseId };
}
