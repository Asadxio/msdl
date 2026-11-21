/**
 * frontend/lib/attendanceDeduplication.test.ts
 *
 * MSLB Phase 2 P0 Remediation: Comprehensive Tests for Read-Time Attendance Deduplication
 */

import {
  deduplicateAttendanceRecords,
  getAttendanceCompositeKey,
  getRecordTimestampMillis,
  extractMillis,
  DeduplicableAttendanceRecord,
} from './attendanceDeduplication';

describe('attendanceDeduplication', () => {
  describe('extractMillis & getRecordTimestampMillis', () => {
    it('extracts millis from numbers, Dates, ISO strings, and Firestore Timestamp objects', () => {
      const nowMs = 1700000000000;
      expect(extractMillis(nowMs)).toBe(nowMs);
      expect(extractMillis(new Date(nowMs))).toBe(nowMs);
      expect(extractMillis(new Date(nowMs).toISOString())).toBe(nowMs);
      expect(extractMillis({ toMillis: () => nowMs })).toBe(nowMs);
      expect(extractMillis({ toDate: () => new Date(nowMs) })).toBe(nowMs);
      expect(extractMillis({ seconds: 1700000000, nanoseconds: 0 })).toBe(1700000000000);
      expect(extractMillis(null)).toBe(0);
      expect(extractMillis(undefined)).toBe(0);
      expect(extractMillis('invalid-date')).toBe(0);
    });

    it('prioritizes updated_at > marked_at > created_at', () => {
      const record: DeduplicableAttendanceRecord = {
        id: 'test_1',
        user_id: 'user_1',
        date: '2026-10-24',
        status: 'present',
        created_at: 1000,
        marked_at: 2000,
        updated_at: 3000,
      };
      expect(getRecordTimestampMillis(record)).toBe(3000);

      const recordWithoutUpdated = { ...record, updated_at: undefined };
      expect(getRecordTimestampMillis(recordWithoutUpdated)).toBe(2000);

      const recordWithoutMarked = { ...recordWithoutUpdated, marked_at: undefined };
      expect(getRecordTimestampMillis(recordWithoutMarked)).toBe(1000);
    });
  });

  describe('getAttendanceCompositeKey', () => {
    it('creates stable composite key formatted as {userId}_{date}_{courseId}', () => {
      expect(
        getAttendanceCompositeKey({
          id: '1',
          user_id: 'usr123',
          date: '2026-10-24',
          status: 'present',
          course_id: 'course_arabic',
        })
      ).toBe('usr123_2026-10-24_course_arabic');
    });

    it('defaults course_id to "general" if missing or empty', () => {
      expect(
        getAttendanceCompositeKey({
          id: '1',
          user_id: 'usr123',
          date: '2026-10-24',
          status: 'present',
        })
      ).toBe('usr123_2026-10-24_general');

      expect(
        getAttendanceCompositeKey({
          id: '1',
          user_id: 'usr123',
          date: '2026-10-24',
          status: 'present',
          course_id: '',
        })
      ).toBe('usr123_2026-10-24_general');
    });
  });

  describe('deduplicateAttendanceRecords', () => {
    it('handles empty and single-element arrays cleanly', () => {
      expect(deduplicateAttendanceRecords([])).toEqual([]);
      const single: DeduplicableAttendanceRecord = {
        id: 'att_u1_2026-10-24_c1',
        user_id: 'u1',
        date: '2026-10-24',
        course_id: 'c1',
        status: 'present',
      };
      const result = deduplicateAttendanceRecords([single]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('att_u1_2026-10-24_c1');
      expect(result[0].hasConflict).toBe(false);
    });

    it('preserves distinct records across different students, dates, or courses', () => {
      const records: DeduplicableAttendanceRecord[] = [
        { id: '1', user_id: 'u1', date: '2026-10-24', course_id: 'c1', status: 'present' },
        { id: '2', user_id: 'u2', date: '2026-10-24', course_id: 'c1', status: 'present' },
        { id: '3', user_id: 'u1', date: '2026-10-25', course_id: 'c1', status: 'absent' },
        { id: '4', user_id: 'u1', date: '2026-10-24', course_id: 'c2', status: 'present' },
      ];
      const result = deduplicateAttendanceRecords(records);
      expect(result).toHaveLength(4);
    });

    it('collapses matching statuses and prefers canonical deterministic ID over legacy random ID', () => {
      const legacyRandomRecord: DeduplicableAttendanceRecord = {
        id: 'RANDOM_AUTO_ID_123',
        user_id: 'student_42',
        date: '2026-10-24',
        course_id: 'fiqh_101',
        status: 'present',
        marked_by: 'live_class',
        live_class_id: 'live_room_99',
        marked_at: 1000,
      };

      const canonicalRecord: DeduplicableAttendanceRecord = {
        id: 'att_student_42_2026-10-24_fiqh_101',
        user_id: 'student_42',
        user_name: 'Fatima',
        date: '2026-10-24',
        course_id: 'fiqh_101',
        status: 'present',
        marked_by: 'teacher',
        marked_at: 1000,
      };

      const result = deduplicateAttendanceRecords([legacyRandomRecord, canonicalRecord]);
      expect(result).toHaveLength(1);
      // Canonical deterministic ID must win
      expect(result[0].id).toBe('att_student_42_2026-10-24_fiqh_101');
      // Metadata from legacy record must be merged in
      expect(result[0].live_class_id).toBe('live_room_99');
      expect(result[0].user_name).toBe('Fatima');
      expect(result[0].hasConflict).toBe(false);
      expect(result[0].conflict).toBe(false);
    });

    it('resolves conflicting status using the latest timestamp (newer record wins)', () => {
      const morningAbsentRecord: DeduplicableAttendanceRecord = {
        id: 'att_u1_2026-10-24_c1',
        user_id: 'u1',
        date: '2026-10-24',
        course_id: 'c1',
        status: 'absent',
        marked_at: 1700000000000, // 09:00 AM
      };

      const eveningPresentRecord: DeduplicableAttendanceRecord = {
        id: 'RANDOM_LEGACY_LATE',
        user_id: 'u1',
        date: '2026-10-24',
        course_id: 'c1',
        status: 'present',
        marked_at: 1700003600000, // 10:00 AM (newer)
      };

      const result = deduplicateAttendanceRecords([morningAbsentRecord, eveningPresentRecord]);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('present');
      expect(result[0].resolvedConflict).toBe(true);
      expect(result[0].hasConflict).toBe(false);
    });

    it('flags conflict when statuses conflict and timestamps are missing or equal', () => {
      const recordA: DeduplicableAttendanceRecord = {
        id: 'RANDOM_A',
        user_id: 'u1',
        date: '2026-10-24',
        course_id: 'c1',
        status: 'absent',
        // No timestamps
      };

      const recordB: DeduplicableAttendanceRecord = {
        id: 'RANDOM_B',
        user_id: 'u1',
        date: '2026-10-24',
        course_id: 'c1',
        status: 'present',
        // No timestamps
      };

      const result = deduplicateAttendanceRecords([recordA, recordB]);
      expect(result).toHaveLength(1);
      expect(result[0].hasConflict).toBe(true);
      expect(result[0].conflict).toBe(true);
      expect(result[0].conflictReason).toContain('Unresolved status conflict');
      expect(result[0].conflictingStatuses).toEqual(expect.arrayContaining(['present', 'absent']));
    });

    it('resolves cleanly among 3+ records with mixed legacy and canonical IDs', () => {
      const records: DeduplicableAttendanceRecord[] = [
        {
          id: 'LEGACY_1',
          user_id: 'u10',
          date: '2026-10-24',
          course_id: 'general',
          status: 'absent',
          marked_at: 100,
        },
        {
          id: 'LEGACY_2',
          user_id: 'u10',
          date: '2026-10-24',
          course_id: '',
          status: 'present',
          marked_at: 200,
        },
        {
          id: 'att_u10_2026-10-24_general',
          user_id: 'u10',
          date: '2026-10-24',
          course_id: 'general',
          status: 'present',
          marked_at: 200,
        },
      ];

      const result = deduplicateAttendanceRecords(records);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('att_u10_2026-10-24_general');
      expect(result[0].status).toBe('present');
      expect(result[0].hasConflict).toBe(false);
    });

    it('preserves conflict audit trail and protects authoritative marked_by from superseded records', () => {
      const earlierAbsent: DeduplicableAttendanceRecord = {
        id: 'legacy_absent_1',
        user_id: 'student_99',
        date: '2026-10-24',
        course_id: 'tajweed_1',
        status: 'absent',
        marked_by: 'system_auto',
        marked_by_name: 'Auto Absence Worker',
        marked_at: 1000,
      };

      const laterPresent: DeduplicableAttendanceRecord = {
        id: 'att_student_99_2026-10-24_tajweed_1',
        user_id: 'student_99',
        date: '2026-10-24',
        course_id: 'tajweed_1',
        status: 'present',
        marked_by: 'teacher',
        marked_by_name: 'Ustaadha Maryam',
        marked_at: 2000,
      };

      const result = deduplicateAttendanceRecords([earlierAbsent, laterPresent]);
      expect(result).toHaveLength(1);
      const winner = result[0];
      expect(winner.status).toBe('present');
      expect(winner.marked_by_name).toBe('Ustaadha Maryam');
      expect(winner.resolvedConflict).toBe(true);
      expect(winner.conflictAudit).toBeDefined();
      expect(winner.conflictAudit?.resolvedStatus).toBe('present');
      expect(winner.conflictAudit?.conflictingStatuses).toContain('absent');
      expect(winner.conflictAudit?.supersededRecords).toHaveLength(1);
      expect(winner.conflictAudit?.supersededRecords[0].id).toBe('legacy_absent_1');
      expect(winner.conflictAudit?.supersededRecords[0].status).toBe('absent');
    });

    it('treats invalid string timestamps as absent and flags unresolved conflict', () => {
      const recordA: DeduplicableAttendanceRecord = {
        id: 'rec_a',
        user_id: 'u5',
        date: '2026-10-24',
        course_id: 'c1',
        status: 'absent',
        marked_at: 'corrupted-timestamp-string',
      };
      const recordB: DeduplicableAttendanceRecord = {
        id: 'rec_b',
        user_id: 'u5',
        date: '2026-10-24',
        course_id: 'c1',
        status: 'present',
        marked_at: null,
      };

      const result = deduplicateAttendanceRecords([recordA, recordB]);
      expect(result).toHaveLength(1);
      expect(result[0].hasConflict).toBe(true);
      expect(result[0].conflict).toBe(true);
    });

    it('prevents double-counting in attendance totals, percentages, and streaks', () => {
      // 5 raw documents for the same student:
      // Day 1: 2 duplicate records (both present)
      // Day 2: 2 duplicate records (1 absent earlier, 1 present later)
      // Day 3: 1 record (absent)
      const rawRecords: DeduplicableAttendanceRecord[] = [
        { id: 'd1_a', user_id: 'u1', date: '2026-10-22', course_id: 'c1', status: 'present', marked_at: 100 },
        { id: 'd1_b', user_id: 'u1', date: '2026-10-22', course_id: 'c1', status: 'present', marked_at: 100 },
        { id: 'd2_a', user_id: 'u1', date: '2026-10-23', course_id: 'c1', status: 'absent', marked_at: 200 },
        { id: 'd2_b', user_id: 'u1', date: '2026-10-23', course_id: 'c1', status: 'present', marked_at: 300 },
        { id: 'd3_a', user_id: 'u1', date: '2026-10-24', course_id: 'c1', status: 'absent', marked_at: 400 },
      ];

      // Raw array count would be 5 (3 present, 2 absent -> 60%)
      expect(rawRecords.length).toBe(5);

      // Deduplicated array must be 3 (Day 1: present, Day 2: present, Day 3: absent -> 2/3 = 67%)
      const deduped = deduplicateAttendanceRecords(rawRecords);
      expect(deduped.length).toBe(3);

      const presentCount = deduped.filter((r) => r.status === 'present').length;
      expect(presentCount).toBe(2);
      const percentage = Math.round((presentCount / deduped.length) * 100);
      expect(percentage).toBe(67);
    });

    it('preserves multiple distinct courses attended by the same student on the same date', () => {
      const sameDayDifferentCourses: DeduplicableAttendanceRecord[] = [
        { id: 'att_u1_2026-10-24_fiqh', user_id: 'u1', date: '2026-10-24', course_id: 'fiqh', status: 'present' },
        { id: 'att_u1_2026-10-24_tajweed', user_id: 'u1', date: '2026-10-24', course_id: 'tajweed', status: 'present' },
        { id: 'att_u1_2026-10-24_arabic', user_id: 'u1', date: '2026-10-24', course_id: 'arabic', status: 'absent' },
      ];

      const result = deduplicateAttendanceRecords(sameDayDifferentCourses);
      expect(result).toHaveLength(3);
      expect(result.map((r) => r.course_id)).toEqual(['fiqh', 'tajweed', 'arabic']);
    });
  });
});
