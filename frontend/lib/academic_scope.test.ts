import {
  getEnrollmentDocId,
  isActiveEnrollmentForUserCourse,
  filterEnrolledCourses,
  filterTeacherAssignedCourses,
} from './enrollments';

describe('Phase 39: MSLB Academic Scoping Architecture', () => {
  const sampleCourses = [
    {
      id: 'course_darse_nizami_1',
      name: 'Dars-e-Nizami Year 1',
      teacher_name: 'Ustaadha Sumra',
      teacher_id: 'teacher_sumra_uid',
      subjects: [
        { id: 'sub_tajweed', name: 'Tajweed', teacher_id: 'teacher_sumra_uid', teacher_name: 'Ustaadha Sumra' },
        { id: 'sub_fiqh', name: 'Fiqh', teacher_id: 'teacher_sumra_uid', teacher_name: 'Ustaadha Sumra' },
        { id: 'sub_hadith', name: 'Hadith', teacher_id: 'teacher_fatima_uid', teacher_name: 'Ustaadha Fatima' },
        { id: 'sub_arabic', name: 'Arabic', teacher_id: 'teacher_ayesha_uid', teacher_name: 'Ustaadha Ayesha' },
      ],
    },
    {
      id: 'course_tajweed_mastery',
      name: 'Tajweed Mastery Quran Recitation',
      teacher_name: 'Ustaadha Fatima',
      teacher_id: 'teacher_fatima_uid',
      subjects: [],
    },
    {
      id: 'course_arabic_grammar',
      name: 'Classical Arabic Grammar',
      teacher_name: 'Ustaadha Ayesha',
      teacher_id: 'teacher_ayesha_uid',
      subjects: [],
    },
  ];

  describe('Deterministic Enrollment Document ID', () => {
    it('generates format userId:courseId', () => {
      const docId = getEnrollmentDocId('student_123', 'course_darse_nizami_1');
      expect(docId).toBe('student_123:course_darse_nizami_1');
    });

    it('trims whitespace', () => {
      const docId = getEnrollmentDocId('  student_123  ', '  course_darse_nizami_1  ');
      expect(docId).toBe('student_123:course_darse_nizami_1');
    });
  });

  describe('Active Enrollment Validator', () => {
    it('returns true for active matching enrollment', () => {
      const enrollment = {
        user_id: 'student_123',
        course_id: 'course_darse_nizami_1',
        status: 'active',
      };
      expect(isActiveEnrollmentForUserCourse(enrollment, 'student_123', 'course_darse_nizami_1')).toBe(true);
    });

    it('returns false for cancelled enrollment', () => {
      const enrollment = {
        user_id: 'student_123',
        course_id: 'course_darse_nizami_1',
        status: 'cancelled',
      };
      expect(isActiveEnrollmentForUserCourse(enrollment, 'student_123', 'course_darse_nizami_1')).toBe(false);
    });

    it('returns false for different course', () => {
      const enrollment = {
        user_id: 'student_123',
        course_id: 'course_other',
        status: 'active',
      };
      expect(isActiveEnrollmentForUserCourse(enrollment, 'student_123', 'course_darse_nizami_1')).toBe(false);
    });
  });

  describe('Student Course Scoping', () => {
    it('filters courses to only those with active user enrollment', () => {
      const userEnrollments = {
        course_darse_nizami_1: true,
      };
      const enrolled = filterEnrolledCourses(sampleCourses, userEnrollments);
      expect(enrolled.length).toBe(1);
      expect(enrolled[0].id).toBe('course_darse_nizami_1');
    });

    it('returns empty array when student has no active enrollments', () => {
      const userEnrollments = {};
      const enrolled = filterEnrolledCourses(sampleCourses, userEnrollments);
      expect(enrolled.length).toBe(0);
    });
  });

  describe('Teacher Subject & Class Assignment Scoping', () => {
    it('matches teacher by teacher_id', () => {
      const teacher = { id: 'teacher_sumra_uid', name: 'Ustaadha Sumra' };
      const assigned = filterTeacherAssignedCourses(sampleCourses, teacher, 'teacher_sumra_uid');
      expect(assigned.some(c => c.id === 'course_darse_nizami_1')).toBe(true);
    });

    it('matches teacher by assigned subject in multi-subject class (Hadith -> Ustaadha Fatima)', () => {
      const teacher = { id: 'teacher_fatima_uid', name: 'Ustaadha Fatima' };
      const assigned = filterTeacherAssignedCourses(sampleCourses, teacher, 'teacher_fatima_uid');
      expect(assigned.some(c => c.id === 'course_darse_nizami_1')).toBe(true);
      expect(assigned.some(c => c.id === 'course_tajweed_mastery')).toBe(true);
      expect(assigned.some(c => c.id === 'course_arabic_grammar')).toBe(false);
    });

    it('matches teacher by assigned subject in multi-subject class (Arabic -> Ustaadha Ayesha)', () => {
      const teacher = { id: 'teacher_ayesha_uid', name: 'Ustaadha Ayesha' };
      const assigned = filterTeacherAssignedCourses(sampleCourses, teacher, 'teacher_ayesha_uid');
      expect(assigned.some(c => c.id === 'course_darse_nizami_1')).toBe(true);
      expect(assigned.some(c => c.id === 'course_arabic_grammar')).toBe(true);
      expect(assigned.some(c => c.id === 'course_tajweed_mastery')).toBe(false);
    });

    it('matches teacher by assigned_courses array', () => {
      const teacher = {
        id: 'teacher_other',
        name: 'Ustaadha Zainab',
        assigned_courses: ['course_arabic_grammar'],
      };
      const assigned = filterTeacherAssignedCourses(sampleCourses, teacher, 'teacher_other');
      expect(assigned.length).toBe(1);
      expect(assigned[0].id).toBe('course_arabic_grammar');
    });
  });
});
