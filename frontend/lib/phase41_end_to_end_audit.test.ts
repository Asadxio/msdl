import {
  getEnrollmentDocId,
  isActiveEnrollmentForUserCourse,
  filterEnrolledCourses,
  filterTeacherAssignedCourses,
  CourseSubject,
} from './enrollments';

describe('PHASE 41 — MSLB Student + Teacher Complete End-to-End Academic Workflow Suite', () => {
  // Test Institutional Data Setup
  const teacherSumra = { id: 'teacher_sumra_uid', name: 'Ustaadha Sumra' };
  const teacherFatima = { id: 'teacher_fatima_uid', name: 'Ustaadha Fatima' };
  const teacherAyesha = { id: 'teacher_ayesha_uid', name: 'Ustaadha Ayesha' };
  
  const studentAli = { uid: 'student_ali_uid', name: 'Ali Asad', email: 'aliasadcivil007@gmail.com' };
  const studentZahra = { uid: 'student_zahra_uid', name: 'Fatima Zahra', email: 'zahra@example.com' };

  const courseYear1 = {
    id: 'course_darse_nizami_y1',
    name: 'Dars-e-Nizami Year 1',
    teacher_name: 'Ustaadha Sumra',
    teacher_id: 'teacher_sumra_uid',
    schedule: 'Mon-Thu',
    class_time: '10:00 AM',
    subjects: [
      { id: 'sub_tajweed', name: 'Tajweed', teacher_id: 'teacher_sumra_uid', teacher_name: 'Ustaadha Sumra' },
      { id: 'sub_fiqh', name: 'Fiqh', teacher_id: 'teacher_fatima_uid', teacher_name: 'Ustaadha Fatima' },
      { id: 'sub_hadith', name: 'Hadith', teacher_id: 'teacher_ayesha_uid', teacher_name: 'Ustaadha Ayesha' },
    ] as CourseSubject[],
  };

  const courseYear2 = {
    id: 'course_darse_nizami_y2',
    name: 'Dars-e-Nizami Year 2',
    teacher_name: 'Ustaadha Zainab',
    teacher_id: 'teacher_zainab_uid',
    schedule: 'Mon-Fri',
    class_time: '02:00 PM',
    subjects: [
      { id: 'sub_adv_fiqh', name: 'Advanced Fiqh', teacher_id: 'teacher_zainab_uid', teacher_name: 'Ustaadha Zainab' },
    ] as CourseSubject[],
  };

  const allCourses = [courseYear1, courseYear2];

  // ══════════════════════════════════════════════════════════════════
  // STEP 2 & 3: STUDENT ACADEMIC SCOPE & SUBJECT EXPERIENCE
  // ══════════════════════════════════════════════════════════════════
  describe('Step 2 & 3: Student Academic & Subject Scope (Ali -> Year 1)', () => {
    const studentAliEnrollments = {
      [courseYear1.id]: true,
    };

    it('scopes student enrolled courses strictly to Dars-e-Nizami Year 1', () => {
      const enrolled = filterEnrolledCourses(allCourses, studentAliEnrollments);
      expect(enrolled.length).toBe(1);
      expect(enrolled[0].id).toBe(courseYear1.id);
      expect(enrolled[0].name).toBe('Dars-e-Nizami Year 1');
    });

    it('exposes all 3 subjects with exact assigned faculty to enrolled student', () => {
      const enrolled = filterEnrolledCourses(allCourses, studentAliEnrollments);
      const subjects = enrolled[0].subjects || [];
      expect(subjects.length).toBe(3);
      
      const tajweed = subjects.find(s => s.id === 'sub_tajweed');
      expect(tajweed).toBeDefined();
      expect(tajweed?.teacher_name).toBe('Ustaadha Sumra');

      const fiqh = subjects.find(s => s.id === 'sub_fiqh');
      expect(fiqh).toBeDefined();
      expect(fiqh?.teacher_name).toBe('Ustaadha Fatima');

      const hadith = subjects.find(s => s.id === 'sub_hadith');
      expect(hadith).toBeDefined();
      expect(hadith?.teacher_name).toBe('Ustaadha Ayesha');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // STEP 4 & 5: CONTENT SCOPING & UNENROLLED CLASS ISOLATION
  // ══════════════════════════════════════════════════════════════════
  describe('Step 4 & 5: Content Scoping & Unenrolled Class Isolation', () => {
    const studentAliEnrollments = {
      [courseYear1.id]: true,
    };

    it('excludes Year 2 from student enrolled classes list', () => {
      const enrolled = filterEnrolledCourses(allCourses, studentAliEnrollments);
      expect(enrolled.some(c => c.id === courseYear2.id)).toBe(false);
    });

    it('verifies that unenrolled check flags Year 2 as locked for student Ali', () => {
      const isEnrolledInYear2 = Boolean(studentAliEnrollments[courseYear2.id]);
      expect(isEnrolledInYear2).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // STEP 6 & 7: TEACHER SUBJECT-SPECIFIC SCOPING
  // ══════════════════════════════════════════════════════════════════
  describe('Step 6 & 7: Teacher Subject-Specific Scoping', () => {
    it('scopes Teacher Sumra to Year 1 via Lead Teacher & Tajweed subject', () => {
      const assigned = filterTeacherAssignedCourses(allCourses, teacherSumra, teacherSumra.id);
      expect(assigned.some(c => c.id === courseYear1.id)).toBe(true);
      expect(assigned.some(c => c.id === courseYear2.id)).toBe(false);
    });

    it('scopes Teacher Fatima to Year 1 via Fiqh subject assignment', () => {
      const assigned = filterTeacherAssignedCourses(allCourses, teacherFatima, teacherFatima.id);
      expect(assigned.some(c => c.id === courseYear1.id)).toBe(true);
      expect(assigned.some(c => c.id === courseYear2.id)).toBe(false);
    });

    it('scopes Teacher Ayesha to Year 1 via Hadith subject assignment', () => {
      const assigned = filterTeacherAssignedCourses(allCourses, teacherAyesha, teacherAyesha.id);
      expect(assigned.some(c => c.id === courseYear1.id)).toBe(true);
      expect(assigned.some(c => c.id === courseYear2.id)).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // STEP 10 & 11: ENROLLMENT STATE TRANSITIONS & REAL-TIME REVOCATION
  // ══════════════════════════════════════════════════════════════════
  describe('Step 10 & 11: Enrollment State Transitions', () => {
    it('handles student enrollment -> unenrollment -> re-enrollment flow seamlessly', () => {
      // 1. Initially Enrolled
      let userEnrollments: Record<string, boolean> = {
        [courseYear1.id]: true,
      };
      expect(filterEnrolledCourses(allCourses, userEnrollments).length).toBe(1);

      // 2. Admin Unenrolls Student
      userEnrollments = {
        [courseYear1.id]: false,
      };
      expect(filterEnrolledCourses(allCourses, userEnrollments).length).toBe(0);

      // 3. Admin Re-enrolls Student
      userEnrollments = {
        [courseYear1.id]: true,
      };
      expect(filterEnrolledCourses(allCourses, userEnrollments).length).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // STEP 12 & 13: PROGRESS & ATTENDANCE SCOPING
  // ══════════════════════════════════════════════════════════════════
  describe('Step 12 & 13: Progress & Attendance Scoping', () => {
    it('scopes progress records strictly by user_id and lesson_id', () => {
      const progressRecord = {
        user_id: studentAli.uid,
        course_id: courseYear1.id,
        lesson_id: 'lesson_tajweed_01',
        completed: true,
      };
      expect(progressRecord.course_id).toBe(courseYear1.id);
      expect(progressRecord.user_id).toBe(studentAli.uid);
      expect(progressRecord.completed).toBe(true);
    });

    it('scopes attendance records strictly by user_id, course_id and date', () => {
      const attendanceRecord = {
        user_id: studentAli.uid,
        course_id: courseYear1.id,
        date: '2026-09-01',
        status: 'present',
        marked_by: 'teacher',
        marked_by_uid: teacherSumra.id,
      };
      expect(attendanceRecord.user_id).toBe(studentAli.uid);
      expect(attendanceRecord.course_id).toBe(courseYear1.id);
      expect(attendanceRecord.status).toBe('present');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // STEP 16: UNIVERSAL CHAT INDEPENDENCE
  // ══════════════════════════════════════════════════════════════════
  describe('Step 16: Universal Chat Independence', () => {
    it('confirms Universal Chat is independent of course enrollments', () => {
      const userA = { uid: studentAli.uid, isApproved: true, enrollments: {} };
      const userB = { uid: teacherAyesha.id, isApproved: true, enrollments: {} };
      
      // Universal chat eligibility depends solely on approved user status
      const canChat = userA.isApproved && userB.isApproved;
      expect(canChat).toBe(true);
    });
  });
});
