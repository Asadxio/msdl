/**
 * frontend/lib/liveClassScoping.test.ts
 *
 * MSLB Phase 3: Scoped Live-Class Query Engine & Access Boundary Tests
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (obj: any) => obj.android || obj.default },
  AppState: { currentState: 'active', addEventListener: jest.fn() },
  Alert: { alert: jest.fn() },
}));

jest.mock('expo-constants', () => ({ default: {} }));
jest.mock('@/lib/dispatchNotification', () => ({
  dispatchNotification: jest.fn(),
}));

import { buildScopedLiveClassQueries, canCurrentUserJoinLiveClass, LiveClass } from './liveClasses';
import type { UserProfile } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebase';
import { getDoc } from 'firebase/firestore';

jest.mock('@/lib/firebase', () => ({
  auth: { currentUser: { uid: 'test_user_uid' } },
  db: {},
}));

jest.mock('firebase/firestore', () => {
  const actual = jest.requireActual('firebase/firestore');
  return {
    ...actual,
    getDoc: jest.fn(),
    doc: jest.fn((db, col, id) => ({ db, col, id })),
    collection: jest.fn((db, col) => ({ db, col })),
    query: jest.fn((col, ...clauses) => ({ col, clauses })),
    where: jest.fn((field, op, value) => ({ field, op, value })),
    orderBy: jest.fn((field, dir) => ({ field, dir })),
    onSnapshot: jest.fn(),
  };
});

describe('Phase 3: Live-Class Query Scoping Engine', () => {
  const baseAdminProfile: UserProfile = {
    uid: 'admin_123',
    email: 'admin@mslb.edu',
    name: 'Admin Ustaadha',
    role: 'admin',
    status: 'approved',
  };

  const baseTeacherProfile: UserProfile = {
    uid: 'teacher_456',
    email: 'teacher@mslb.edu',
    name: 'Teacher Aisha',
    role: 'teacher',
    status: 'approved',
  };

  const baseStudentProfile: UserProfile = {
    uid: 'student_789',
    email: 'student@mslb.edu',
    name: 'Taliba Fatima',
    role: 'student',
    status: 'approved',
  };

  describe('1. Unauthenticated and Inactive User Lifecycles', () => {
    it('returns empty query plan when userUid or profile is missing', () => {
      const plan1 = buildScopedLiveClassQueries({ userUid: undefined, profile: null });
      expect(plan1.type).toBe('empty');
      expect(plan1.queries).toHaveLength(0);

      const plan2 = buildScopedLiveClassQueries({ userUid: 'some_uid', profile: null });
      expect(plan2.type).toBe('empty');
      expect(plan2.queries).toHaveLength(0);
    });

    it('denies queries for suspended, rejected, and pending accounts', () => {
      const statuses: Array<UserProfile['status']> = ['suspended', 'rejected', 'pending'];
      for (const st of statuses) {
        const plan = buildScopedLiveClassQueries({
          userUid: 'uid_test',
          profile: { ...baseStudentProfile, status: st },
          enrolledCourseIds: ['course_quran'],
        });
        expect(plan.type).toBe('empty');
        expect(plan.queries).toHaveLength(0);
        expect(plan.reason).toContain(st);
      }
    });
  });

  describe('2. Student Scoped Queries', () => {
    it('strictly returns empty queries for students with ZERO active enrollments (no global query fallback)', () => {
      const plan = buildScopedLiveClassQueries({
        userUid: baseStudentProfile.uid,
        profile: baseStudentProfile,
        enrolledCourseIds: [],
      });
      expect(plan.type).toBe('empty');
      expect(plan.queries).toHaveLength(0);
      expect(plan.reason).toContain('No active course enrollments');
    });

    it('generates a single course-filtered query for a student with one enrolled course', () => {
      const plan = buildScopedLiveClassQueries({
        userUid: baseStudentProfile.uid,
        profile: baseStudentProfile,
        enrolledCourseIds: ['course_tajweed_101'],
      });
      expect(plan.type).toBe('student');
      expect(plan.queries).toHaveLength(1);

      const clauses = plan.queries[0].clauses;
      const courseFilter = clauses.find((c: any) => c.field === 'course_id');
      expect(courseFilter).toBeDefined();
      expect(courseFilter.op).toBe('in');
      expect(courseFilter.value).toEqual(['course_tajweed_101']);
    });

    it('chunks enrolled courses into batches of <= 25 when student has multiple courses', () => {
      const courses = Array.from({ length: 30 }, (_, i) => `course_${i + 1}`);
      const plan = buildScopedLiveClassQueries({
        userUid: baseStudentProfile.uid,
        profile: baseStudentProfile,
        enrolledCourseIds: courses,
      });
      expect(plan.type).toBe('student');
      expect(plan.queries).toHaveLength(2); // 25 + 5

      const chunk1 = plan.queries[0].clauses.find((c: any) => c.field === 'course_id').value;
      const chunk2 = plan.queries[1].clauses.find((c: any) => c.field === 'course_id').value;
      expect(chunk1).toHaveLength(25);
      expect(chunk2).toHaveLength(5);
    });

    it('applies tenant organization scoping when not default org', () => {
      const plan = buildScopedLiveClassQueries({
        userUid: baseStudentProfile.uid,
        profile: baseStudentProfile,
        enrolledCourseIds: ['course_hadith'],
        organizationId: 'custom_org_karachi',
        isDefaultOrg: false,
      });
      expect(plan.type).toBe('student');
      const clauses = plan.queries[0].clauses;
      const orgFilter = clauses.find((c: any) => c.field === 'organization_id');
      expect(orgFilter).toBeDefined();
      expect(orgFilter.op).toBe('==');
      expect(orgFilter.value).toBe('custom_org_karachi');
    });
  });

  describe('3. Teacher Scoped Queries', () => {
    it('scopes teacher queries to hosted classes plus assigned courses', () => {
      const plan = buildScopedLiveClassQueries({
        userUid: baseTeacherProfile.uid,
        profile: baseTeacherProfile,
        assignedCourseIds: ['course_fiqh_1', 'course_fiqh_2'],
      });
      expect(plan.type).toBe('teacher');
      // Query 1: hosted by teacher, Query 2: assigned courses chunk
      expect(plan.queries).toHaveLength(2);

      const hostFilter = plan.queries[0].clauses.find((c: any) => c.field === 'teacher_id');
      expect(hostFilter.value).toBe(baseTeacherProfile.uid);

      const courseFilter = plan.queries[1].clauses.find((c: any) => c.field === 'course_id');
      expect(courseFilter.value).toEqual(['course_fiqh_1', 'course_fiqh_2']);
    });

    it('only queries hosted classes if teacher has zero assigned courses (never falls back to global query)', () => {
      const plan = buildScopedLiveClassQueries({
        userUid: baseTeacherProfile.uid,
        profile: baseTeacherProfile,
        assignedCourseIds: [],
      });
      expect(plan.type).toBe('teacher');
      expect(plan.queries).toHaveLength(1);
      const hostFilter = plan.queries[0].clauses.find((c: any) => c.field === 'teacher_id');
      expect(hostFilter.value).toBe(baseTeacherProfile.uid);
    });
  });

  describe('4. Admin & Super Admin Listing', () => {
    it('authorizes administrative institutional query for admin role', () => {
      const plan = buildScopedLiveClassQueries({
        userUid: baseAdminProfile.uid,
        profile: baseAdminProfile,
      });
      expect(plan.type).toBe('admin');
      expect(plan.queries).toHaveLength(1);
    });

    it('authorizes administrative institutional query for super_admin role', () => {
      const plan = buildScopedLiveClassQueries({
        userUid: 'super_admin_uid',
        profile: { ...baseAdminProfile, role: 'super_admin' },
      });
      expect(plan.type).toBe('admin');
      expect(plan.queries).toHaveLength(1);
    });
  });

  describe('5. canCurrentUserJoinLiveClass Authorization Gate', () => {
    const liveClassMock: LiveClass = {
      id: 'class_live_1',
      course_id: 'course_quran_101',
      teacher_id: 'teacher_456',
      teacher_name: 'Teacher Aisha',
      title: 'Surah Al-Baqarah Tajweed',
      status: 'live',
      meet_url: 'https://meet.google.com/abc-defg-hij',
    };

    beforeEach(() => {
      jest.clearAllMocks();
      (auth as any).currentUser = { uid: 'student_789' };
    });

    it('allows admin and super_admin access unconditionally', async () => {
      const canAdmin = await canCurrentUserJoinLiveClass(liveClassMock, baseAdminProfile);
      expect(canAdmin).toBe(true);

      const canSuper = await canCurrentUserJoinLiveClass(liveClassMock, { ...baseAdminProfile, role: 'super_admin' });
      expect(canSuper).toBe(true);
    });

    it('denies access if user account is suspended or rejected regardless of role', async () => {
      const suspendedAdmin: UserProfile = { ...baseAdminProfile, status: 'suspended' };
      expect(await canCurrentUserJoinLiveClass(liveClassMock, suspendedAdmin)).toBe(false);

      const rejectedStudent: UserProfile = { ...baseStudentProfile, status: 'rejected' };
      expect(await canCurrentUserJoinLiveClass(liveClassMock, rejectedStudent)).toBe(false);
    });

    it('allows teacher if they are the designated host or assigned to course', async () => {
      (auth as any).currentUser = { uid: 'teacher_456' };
      const canHost = await canCurrentUserJoinLiveClass(liveClassMock, baseTeacherProfile);
      expect(canHost).toBe(true);
    });

    it('allows student with active enrollment and denies inactive/revoked enrollment', async () => {
      (auth as any).currentUser = { uid: 'student_789' };

      // Case A: Active enrollment
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          user_id: 'student_789',
          course_id: 'course_quran_101',
          status: 'active',
        }),
      });

      const canActive = await canCurrentUserJoinLiveClass(liveClassMock, baseStudentProfile);
      expect(canActive).toBe(true);

      // Case B: Inactive / Dropped enrollment
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          user_id: 'student_789',
          course_id: 'course_quran_101',
          status: 'inactive',
        }),
      });

      const canInactive = await canCurrentUserJoinLiveClass(liveClassMock, baseStudentProfile);
      expect(canInactive).toBe(false);

      // Case C: No enrollment doc found
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => false,
      });

      const canNoDoc = await canCurrentUserJoinLiveClass({ ...liveClassMock, enrollment_source: 'enrollments' } as any, baseStudentProfile);
      expect(canNoDoc).toBe(false);
    });

    it('rejects student access if live class has missing or empty course_id', async () => {
      (auth as any).currentUser = { uid: 'student_789' };
      const corruptClass = { ...liveClassMock, course_id: '' };
      const canJoin = await canCurrentUserJoinLiveClass(corruptClass, baseStudentProfile);
      expect(canJoin).toBe(false);
    });
  });
});
