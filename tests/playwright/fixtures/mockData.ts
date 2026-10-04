/**
 * Mock Data & Fixtures for Playwright E2E Tests
 * Madrasatu-s-Salikat Lil Banat
 */

export const TEST_USERS = {
  STUDENT_A: {
    uid: 'student_zainab_101',
    email: 'zainab.student@mslb.edu',
    password: 'Password@123',
    name: 'Zainab Bint Ali',
    role: 'student',
    status: 'approved',
    organization_id: 'mslb-main',
    enrolledCourseIds: ['course_tajweed_71'],
  },
  STUDENT_B: {
    uid: 'student_maryam_102',
    email: 'maryam.student@mslb.edu',
    password: 'Password@123',
    name: 'Maryam Bint Imran',
    role: 'student',
    status: 'approved',
    organization_id: 'mslb-main',
    enrolledCourseIds: ['course_fiqh_rabiya'],
  },
  TEACHER: {
    uid: 'teacher_fatima_uid',
    teacher_id: 'TCH-7101',
    email: 'fatima.teacher@mslb.edu',
    password: 'Password@123',
    name: 'Ustaadha Fatima',
    role: 'teacher',
    status: 'approved',
    organization_id: 'mslb-main',
    assignedCourseIds: ['course_tajweed_71'],
  },
  ADMIN: {
    uid: 'admin_super_uid',
    email: 'admin@mslb.edu',
    password: 'Password@123',
    name: 'Idara Admin',
    role: 'admin',
    status: 'approved',
    organization_id: 'mslb-main',
  },
  PENDING_STUDENT: {
    uid: 'student_pending_999',
    email: 'pending.student@mslb.edu',
    password: 'Password@123',
    name: 'Amina Khatoon',
    role: 'student',
    status: 'pending',
    organization_id: 'mslb-main',
    enrolledCourseIds: [],
  },
};

export const TEST_COURSES = {
  COURSE_A: {
    id: 'course_tajweed_71',
    name: 'Advanced Quranic Tajweed & Hifz',
    arabic_name: 'التجويد والحفظ المتقدم',
    description: 'Comprehensive rules of Tajweed, Makharij, and Sifaat for advanced students.',
    fees_amount: 500,
    fees_amount_paise: 50000,
    teacher_id: 'teacher_fatima_uid',
    teacher_name: 'Ustaadha Fatima',
    subjects: [
      { id: 'subj_makharij', name: 'Makharij & Sifaat', lessons_count: 12 },
      { id: 'subj_ahkam', name: 'Ahkam Nun & Mim Sakin', lessons_count: 10 },
    ],
    modules: [
      { id: 'mod_1', title: 'Introduction to Articulation Points' },
      { id: 'mod_2', title: 'Characteristics of Letters (Sifaat)' },
    ],
  },
  COURSE_B: {
    id: 'course_fiqh_rabiya',
    name: 'Fiqh & Usul-ul-Fiqh - Rabiya',
    arabic_name: 'الفقه وأصول الفقه',
    description: 'Classical Hanafi Jurisprudence covering Taharat, Salah, and Sawm.',
    fees_amount: 500,
    fees_amount_paise: 50000,
    teacher_id: 'teacher_sumra_01',
    teacher_name: 'Ustaadha Sumra Fatma',
    subjects: [
      { id: 'subj_taharat', name: 'Kitab al-Taharah', lessons_count: 15 },
      { id: 'subj_salah', name: 'Kitab al-Salah', lessons_count: 20 },
    ],
  },
  SHORT_COURSE_FREE: {
    id: 'course_short_tajweed',
    name: 'Short Tajweed Essentials (Free)',
    arabic_name: 'أساسيات التجويد',
    description: 'Foundational Tajweed rules for beginners — 100% Free.',
    fees_amount: 0,
    fees_amount_paise: 0,
    teacher_id: 'teacher_fatima_uid',
    teacher_name: 'Ustaadha Fatima',
  },
};

export const TEST_SANAD = {
  id: 'SANAD-2026-001',
  student_name: 'Zainab Bint Ali',
  course_name: 'Advanced Quranic Tajweed & Hifz',
  serial: 'MSLB-TJWD-2026-089',
  completion_date: '15 Sha\'ban 1447 AH / February 2026',
  issued_by: 'Madrasatu-s-Salikat Lil Banat',
  status: 'verified',
};
