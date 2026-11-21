/**
 * frontend/lib/attendanceId.test.ts
 *
 * Unit tests for the shared deterministic attendance document ID engine.
 */

import {
  ATTENDANCE_DOC_ID_PREFIX,
  getAttendanceDocId,
  getInstitutionalDateString,
  isValidDateString,
  isDeterministicAttendanceDocId,
  parseAttendanceDocId,
} from './attendanceId';

describe('attendanceId — Canonical Deterministic ID Engine', () => {
  describe('getAttendanceDocId', () => {
    it('generates the canonical format att_{userId}_{date}_{courseId}', () => {
      const id = getAttendanceDocId('student_123', '2026-10-24', 'alima_year1');
      expect(id).toBe('att_student_123_2026-10-24_alima_year1');
    });

    it('trims leading and trailing whitespace from components', () => {
      const id = getAttendanceDocId('  student_abc  ', '  2026-10-24  ', '  course_xyz  ');
      expect(id).toBe('att_student_abc_2026-10-24_course_xyz');
    });

    it('handles user IDs and course IDs containing underscores or hyphens', () => {
      const id = getAttendanceDocId('usr_test_99-x', '2026-05-15', 'course-fiqh_advanced-2');
      expect(id).toBe('att_usr_test_99-x_2026-05-15_course-fiqh_advanced-2');
    });

    it('throws error when userId is missing or empty', () => {
      expect(() => getAttendanceDocId('', '2026-10-24', 'course1')).toThrow(
        /userId is required/
      );
      expect(() => getAttendanceDocId(null, '2026-10-24', 'course1')).toThrow(
        /userId is required/
      );
      expect(() => getAttendanceDocId('   ', '2026-10-24', 'course1')).toThrow(
        /userId is required/
      );
    });

    it('throws error when date is missing or empty', () => {
      expect(() => getAttendanceDocId('user1', '', 'course1')).toThrow(
        /date is required/
      );
      expect(() => getAttendanceDocId('user1', null, 'course1')).toThrow(
        /date is required/
      );
    });

    it('throws error when courseId is missing or empty', () => {
      expect(() => getAttendanceDocId('user1', '2026-10-24', '')).toThrow(
        /courseId is required/
      );
      expect(() => getAttendanceDocId('user1', '2026-10-24', undefined)).toThrow(
        /courseId is required/
      );
    });

    it('rejects forward slashes in userId and courseId to prevent Firestore path collisions', () => {
      expect(() => getAttendanceDocId('user/sub', '2026-10-24', 'course1')).toThrow(
        /userId cannot contain forward slashes/
      );
      expect(() => getAttendanceDocId('user1', '2026-10-24', 'course/level1')).toThrow(
        /courseId cannot contain forward slashes/
      );
    });

    it('rejects invalid date formats or impossible calendar dates', () => {
      expect(() => getAttendanceDocId('user1', '24-10-2026', 'course1')).toThrow(
        /valid calendar date/
      );
      expect(() => getAttendanceDocId('user1', '2026/10/24', 'course1')).toThrow(
        /valid calendar date/
      );
      expect(() => getAttendanceDocId('user1', '2026-13-01', 'course1')).toThrow(
        /valid calendar date/
      );
      expect(() => getAttendanceDocId('user1', '2026-02-30', 'course1')).toThrow(
        /valid calendar date/
      );
    });
  });

  describe('isValidDateString', () => {
    it('accepts valid YYYY-MM-DD dates', () => {
      expect(isValidDateString('2026-01-01')).toBe(true);
      expect(isValidDateString('2026-12-31')).toBe(true);
      expect(isValidDateString('2024-02-29')).toBe(true); // 2024 is a leap year
    });

    it('rejects leap day on non-leap years', () => {
      expect(isValidDateString('2025-02-29')).toBe(false);
      expect(isValidDateString('2026-02-29')).toBe(false);
    });

    it('rejects invalid months, days, and types', () => {
      expect(isValidDateString('2026-00-10')).toBe(false);
      expect(isValidDateString('2026-04-31')).toBe(false); // April has 30 days
      expect(isValidDateString('2026-06-31')).toBe(false); // June has 30 days
      expect(isValidDateString('')).toBe(false);
      expect(isValidDateString(null)).toBe(false);
      expect(isValidDateString(12345)).toBe(false);
    });
  });

  describe('getInstitutionalDateString', () => {
    it('formats a date to YYYY-MM-DD in Asia/Kolkata timezone', () => {
      // 2026-10-24 at 12:00:00 UTC is 2026-10-24 at 17:30:00 IST
      const date = new Date(Date.UTC(2026, 9, 24, 12, 0, 0));
      expect(getInstitutionalDateString(date)).toBe('2026-10-24');
    });

    it('accurately resolves date rollover for early morning IST classes (previous day in UTC)', () => {
      // UTC: 2026-10-23 23:30:00 -> IST (UTC+5:30): 2026-10-24 05:00:00 (Fajr time)
      const earlyMorningIst = new Date(Date.UTC(2026, 9, 23, 23, 30, 0));
      expect(getInstitutionalDateString(earlyMorningIst, 'Asia/Kolkata')).toBe('2026-10-24');
    });

    it('accurately resolves date rollover for late night IST classes (next day in IST)', () => {
      // UTC: 2026-10-24 19:00:00 -> IST (UTC+5:30): 2026-10-25 00:30:00
      const midnightIst = new Date(Date.UTC(2026, 9, 24, 19, 0, 0));
      expect(getInstitutionalDateString(midnightIst, 'Asia/Kolkata')).toBe('2026-10-25');
    });

    it('accepts epoch millisecond timestamp as input', () => {
      const epochMs = Date.UTC(2026, 5, 10, 10, 0, 0);
      expect(getInstitutionalDateString(epochMs)).toBe('2026-06-10');
    });

    it('throws on invalid date input', () => {
      expect(() => getInstitutionalDateString(new Date('invalid'))).toThrow(
        /Invalid Date input/
      );
    });
  });

  describe('parseAttendanceDocId and isDeterministicAttendanceDocId', () => {
    it('correctly identifies and decomposes canonical deterministic doc IDs', () => {
      const docId = 'att_student99_2026-10-24_course_arabic';
      expect(isDeterministicAttendanceDocId(docId)).toBe(true);

      const parsed = parseAttendanceDocId(docId);
      expect(parsed).toEqual({
        userId: 'student99',
        date: '2026-10-24',
        courseId: 'course_arabic',
      });
    });

    it('correctly handles user and course IDs containing hyphens and underscores', () => {
      const docId = 'att_usr_sec_1-a_2026-08-12_tajweed_part-2';
      expect(isDeterministicAttendanceDocId(docId)).toBe(true);

      const parsed = parseAttendanceDocId(docId);
      expect(parsed).toEqual({
        userId: 'usr_sec_1-a',
        date: '2026-08-12',
        courseId: 'tajweed_part-2',
      });
    });

    it('correctly parses course IDs that themselves contain date patterns without confusion', () => {
      const docId = getAttendanceDocId('student_99', '2026-10-24', 'workshop_2026-06-01_batchA');
      expect(docId).toBe('att_student_99_2026-10-24_workshop_2026-06-01_batchA');

      const parsed = parseAttendanceDocId(docId);
      expect(parsed).toEqual({
        userId: 'student_99',
        date: '2026-10-24',
        courseId: 'workshop_2026-06-01_batchA',
      });
    });

    it('rejects user IDs containing date patterns to guarantee bijective round-trip parsing', () => {
      expect(() =>
        getAttendanceDocId('user_2026-01-01_hacker', '2026-10-24', 'course1')
      ).toThrow(/date patterns/);

      expect(() =>
        getAttendanceDocId('student_2026-10-24', '2026-10-24', 'course1')
      ).toThrow(/date patterns/);

      expect(() =>
        getAttendanceDocId('2026-10-24_student', '2026-10-24', 'course1')
      ).toThrow(/date patterns/);
    });

    it('guarantees round-trip bijection for all valid inputs and preserves underscores', () => {
      const validTuples = [
        { uid: 'student_alpha_1', date: '2026-10-24', cid: 'general' },
        { uid: 'student_beta-2', date: '2026-10-24', cid: 'course_arabic_level_1' },
        { uid: 'taliba_fatima', date: '2026-05-15', cid: 'recitation-2026' },
      ];

      for (const t of validTuples) {
        const docId = getAttendanceDocId(t.uid, t.date, t.cid);
        const parsed = parseAttendanceDocId(docId);
        expect(parsed).toEqual({
          userId: t.uid,
          date: t.date,
          courseId: t.cid,
        });
      }
    });

    it('returns false / null for random legacy Firestore auto-IDs', () => {
      const legacyRandomId = 'J9kL2x0OpQrst891abCd';
      expect(isDeterministicAttendanceDocId(legacyRandomId)).toBe(false);
      expect(parseAttendanceDocId(legacyRandomId)).toBe(null);
    });

    it('returns false / null for non-att prefixed or malformed IDs', () => {
      expect(isDeterministicAttendanceDocId('att_user_nodate')).toBe(false);
      expect(isDeterministicAttendanceDocId('user_2026-10-24_course')).toBe(false);
      expect(isDeterministicAttendanceDocId('')).toBe(false);
      expect(parseAttendanceDocId('att_user_2026-99-99_course')).toBe(null);
    });
  });
});
