import {
  isValidTeacherId,
  getNextTeacherId,
  buildCanonicalTeacherProfile,
  reconcileExistingTeacherDoc,
  type TeacherProfile,
} from './teacherIdentity';
import { filterTeacherAssignedCourses } from './enrollments';
import type { Course, Teacher } from '../context/DataContext';

describe('Phase 69 — Teacher Identity, Profile & Credentials Suite', () => {
  // ─────────────────────────────────────────────────────────────────
  // 1. Institutional Teacher ID Validation
  // ─────────────────────────────────────────────────────────────────
  describe('isValidTeacherId', () => {
    it('accepts valid 4+ digit institutional Teacher IDs', () => {
      expect(isValidTeacherId('TCH-0001')).toBe(true);
      expect(isValidTeacherId('TCH-0042')).toBe(true);
      expect(isValidTeacherId('TCH-1234')).toBe(true);
      expect(isValidTeacherId('TCH-9999')).toBe(true);
      expect(isValidTeacherId('TCH-10000')).toBe(true);
    });

    it('rejects invalid or malformed Teacher IDs', () => {
      expect(isValidTeacherId('')).toBe(false);
      expect(isValidTeacherId('TCH-1')).toBe(false);
      expect(isValidTeacherId('TCH-01')).toBe(false);
      expect(isValidTeacherId('TCH-001')).toBe(false); // only 3 digits
      expect(isValidTeacherId('tch-0001')).toBe(false); // lowercase prefix
      expect(isValidTeacherId('TCH-ABCD')).toBe(false); // non-digits
      expect(isValidTeacherId('TEA-0001')).toBe(false); // wrong prefix
      expect(isValidTeacherId('12345')).toBe(false); // no prefix
      expect(isValidTeacherId(undefined as any)).toBe(false);
      expect(isValidTeacherId(null as any)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 2. Sequential & Unique Teacher ID Generator
  // ─────────────────────────────────────────────────────────────────
  describe('getNextTeacherId', () => {
    it('generates TCH-0001 when existing ID list is empty', () => {
      expect(getNextTeacherId([])).toBe('TCH-0001');
    });

    it('generates next sequential ID from consecutive existing IDs', () => {
      const existing = ['TCH-0001', 'TCH-0002', 'TCH-0003'];
      expect(getNextTeacherId(existing)).toBe('TCH-0004');
    });

    it('handles non-sequential gaps by picking max + 1', () => {
      const existing = ['TCH-0002', 'TCH-0010'];
      expect(getNextTeacherId(existing)).toBe('TCH-0011');
    });

    it('handles unordered ID lists correctly', () => {
      const existing = ['TCH-0005', 'TCH-0001', 'TCH-0003', 'TCH-0002'];
      expect(getNextTeacherId(existing)).toBe('TCH-0006');
    });

    it('ignores invalid IDs in existing list when calculating sequence', () => {
      const existing = ['INVALID', 'TCH-XYZ', 'TCH-0007', 'RANDOM-123'];
      expect(getNextTeacherId(existing)).toBe('TCH-0008');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 3. Canonical Teacher Profile Builder
  // ─────────────────────────────────────────────────────────────────
  describe('buildCanonicalTeacherProfile', () => {
    it('anchors user_uid to the exact authenticated user UID', () => {
      const profile = buildCanonicalTeacherProfile({
        user_uid: 'firebase_auth_uid_123',
        teacher_id: 'TCH-0001',
        name: 'Ustaadha Maryam',
        email: 'maryam@madrasa.org',
      });

      expect(profile.user_uid).toBe('firebase_auth_uid_123');
      expect(profile.id).toBe('firebase_auth_uid_123');
      expect(profile.teacher_id).toBe('TCH-0001');
      expect(profile.name).toBe('Ustaadha Maryam');
    });

    it('parses comma-separated strings into string arrays for qualifications & specializations', () => {
      const profile = buildCanonicalTeacherProfile({
        user_uid: 'uid_456',
        teacher_id: 'TCH-0002',
        name: 'Maulana Zayd',
        qualifications: 'Alimiyyah Degree, Fazil-e-Dars-e-Nizami, B.A. Arabic' as any,
        specializations: 'Fiqh Hanafi, Usul al-Fiqh' as any,
        languages: 'Urdu, Arabic, English' as any,
      });

      expect(profile.qualifications).toEqual([
        'Alimiyyah Degree',
        'Fazil-e-Dars-e-Nizami',
        'B.A. Arabic',
      ]);
      expect(profile.specializations).toEqual(['Fiqh Hanafi', 'Usul al-Fiqh']);
      expect(profile.languages).toEqual(['Urdu', 'Arabic', 'English']);
    });

    it('defaults status to approved and verification_status to pending (Phase 70A: credentials require explicit verification)', () => {
      const profile = buildCanonicalTeacherProfile({
        user_uid: 'uid_789',
        teacher_id: 'TCH-0003',
        name: 'Ustaadha Fatima',
      });

      expect(profile.status).toBe('approved');
      // Phase 70A: verification_status is now 'pending' by default.
      // Only an explicit Admin credential-review action may change it to 'verified'.
      expect(profile.verification_status).toBe('pending');
    });

    it('preserves islamic_qualification and experience_years accurately', () => {
      const profile = buildCanonicalTeacherProfile({
        user_uid: 'uid_101',
        teacher_id: 'TCH-0004',
        name: 'Mufti Tariq',
        islamic_qualification: 'Ifta / Mufti Sanad from Darul Uloom',
        experience_years: 12,
      });

      expect(profile.islamic_qualification).toBe('Ifta / Mufti Sanad from Darul Uloom');
      expect(profile.experience_years).toBe(12);
    });

    it('normalizes legacy courses into assigned_courses and vice-versa', () => {
      const profile = buildCanonicalTeacherProfile({
        user_uid: 'uid_102',
        teacher_id: 'TCH-0005',
        name: 'Ustaadha Zainab',
        courses: ['Tajweed Essentials', 'Quran Translation'] as any,
      });

      expect(profile.assigned_courses).toEqual(['Tajweed Essentials', 'Quran Translation']);
      expect(profile.courses).toEqual(['Tajweed Essentials', 'Quran Translation']);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 4. Safe Reconciliation for Existing Teacher Documents
  // ─────────────────────────────────────────────────────────────────
  describe('reconcileExistingTeacherDoc', () => {
    it('returns migration updates when existing doc lacks user_uid or teacher_id', () => {
      const legacyDoc: Partial<TeacherProfile> = {
        name: 'Ustaadha Khadijah',
        title: 'Senior Tajweed Teacher',
        courses: ['Tajweed Year 1'],
      };

      const result = reconcileExistingTeacherDoc(
        legacyDoc,
        'matched_user_uid_555',
        'TCH-0009'
      );

      expect(result.needsUpdate).toBe(true);
      expect(result.updates?.user_uid).toBe('matched_user_uid_555');
      expect(result.updates?.teacher_id).toBe('TCH-0009');
      expect(result.updates?.status).toBe('approved');
      // Phase 70A: reconciliation must NOT auto-verify credentials
      expect(result.updates?.verification_status).toBe('pending');
    });

    it('leaves document untouched if already canonical with matching UID and teacher_id', () => {
      const canonicalDoc: Partial<TeacherProfile> = {
        user_uid: 'auth_uid_777',
        teacher_id: 'TCH-0001',
        name: 'Ustaadha Sumra',
        status: 'approved',
        verification_status: 'approved',
      };

      const result = reconcileExistingTeacherDoc(
        canonicalDoc,
        'auth_uid_777',
        'TCH-0001'
      );

      expect(result.needsUpdate).toBe(false);
      expect(result.updates).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 5. Course Allocation Scoping & Matching
  // ─────────────────────────────────────────────────────────────────
  describe('Course Allocation Scoping (filterTeacherAssignedCourses)', () => {
    const canonicalTeacher: Teacher = {
      id: 'teacher_uid_999',
      user_uid: 'teacher_uid_999',
      teacher_id: 'TCH-0008',
      name: 'Ustaadha Sumra',
      title: 'Senior Teacher',
      assigned_courses: ['Alimiyyah Year 1'],
      courses: ['Alimiyyah Year 1'],
    };

    const courseByUid: Course = {
      id: 'c1',
      name: 'Alimiyyah Year 1',
      teacher_name: 'Ustaadha Sumra',
      teacher_id: 'teacher_uid_999',
      schedule: 'Mon-Wed',
      class_link: '',
      description: 'Test course',
    };

    const courseByTeacherId: Course = {
      id: 'c2',
      name: 'Advanced Tajweed',
      teacher_name: 'Ustaadha Sumra',
      teacher_id: 'TCH-0008',
      schedule: 'Thu-Fri',
      class_link: '',
      description: 'Test course',
    };

    const courseWithSubjectByTeacherId: Course = {
      id: 'c3',
      name: 'General Islamic Studies',
      teacher_name: 'Multiple',
      schedule: 'Daily',
      class_link: '',
      description: 'Test course',
      subjects: [
        {
          id: 'sub_1',
          name: 'Hanafi Fiqh',
          teacher_id: 'TCH-0008',
          teacher_name: 'Ustaadha Sumra',
        },
      ],
    };

    const unrelatedCourse: Course = {
      id: 'c4',
      name: 'Arabic Grammar',
      teacher_name: 'Ustaadh Tariq',
      teacher_id: 'other_teacher_uid',
      schedule: 'Daily',
      class_link: '',
      description: 'Unrelated course',
    };

    it('matches course assigned by Auth UID', () => {
      const assigned = filterTeacherAssignedCourses([courseByUid, unrelatedCourse], canonicalTeacher);
      expect(assigned.map((c) => c.id)).toContain('c1');
      expect(assigned.map((c) => c.id)).not.toContain('c4');
    });

    it('matches course assigned by institutional Teacher ID (TCH-XXXX)', () => {
      const assigned = filterTeacherAssignedCourses([courseByTeacherId, unrelatedCourse], canonicalTeacher);
      expect(assigned.map((c) => c.id)).toContain('c2');
      expect(assigned.map((c) => c.id)).not.toContain('c4');
    });

    it('matches course when teacher teaches an individual subject by Teacher ID', () => {
      const assigned = filterTeacherAssignedCourses([courseWithSubjectByTeacherId, unrelatedCourse], canonicalTeacher);
      expect(assigned.map((c) => c.id)).toContain('c3');
      expect(assigned.map((c) => c.id)).not.toContain('c4');
    });

    it('matches course by teacher.assigned_courses array name matching', () => {
      const courseNamedMatch: Course = {
        id: 'c5',
        name: 'Alimiyyah Year 1',
        teacher_name: 'Ustaadha Sumra',
        schedule: 'Mon-Wed',
        class_link: '',
        description: 'Match by assigned_courses name',
      };

      const assigned = filterTeacherAssignedCourses([courseNamedMatch], canonicalTeacher);
      expect(assigned.map((c) => c.id)).toContain('c5');
    });
  });
});
