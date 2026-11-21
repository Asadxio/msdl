/**
 * frontend/lib/navigationGuard.test.ts
 *
 * Unit tests for route permission matrix and navigation guard.
 */

import { evaluateRouteAuthorization } from './navigationGuard';
import type { UserProfile } from '@/context/AuthContext';

describe('navigationGuard — evaluateRouteAuthorization', () => {
  const makeUser = (uid = 'u_123', email = 'student@example.com') => ({ uid, email });
  const makeProfile = (
    role: any = 'student',
    status: any = 'approved',
    email = 'student@example.com'
  ): UserProfile => ({
    name: 'Test User',
    email,
    role,
    status,
  });

  describe('Guest and Unauthenticated Access', () => {
    it('allows guest routes for unauthenticated users', () => {
      expect(evaluateRouteAuthorization('/auth/login', null, null)).toEqual({ allowed: true });
      expect(evaluateRouteAuthorization('/select-madrasa', null, null)).toEqual({ allowed: true });
      expect(evaluateRouteAuthorization('/register-madrasa', null, null)).toEqual({ allowed: true });
      expect(evaluateRouteAuthorization('/terms', null, null)).toEqual({ allowed: true });
      expect(evaluateRouteAuthorization('/privacy', null, null)).toEqual({ allowed: true });
      expect(evaluateRouteAuthorization('/onboarding-entry', null, null)).toEqual({ allowed: true });
    });

    it('denies protected routes for unauthenticated users and redirects to login', () => {
      expect(evaluateRouteAuthorization('/(tabs)/courses', null, null)).toEqual({
        allowed: false,
        redirectTo: '/auth/login',
        reason: 'unauthenticated',
      });
      expect(evaluateRouteAuthorization('/teacher/lessons', null, null)).toEqual({
        allowed: false,
        redirectTo: '/auth/login',
        reason: 'unauthenticated',
      });
      expect(evaluateRouteAuthorization('/admin/users', null, null)).toEqual({
        allowed: false,
        redirectTo: '/auth/login',
        reason: 'unauthenticated',
      });
    });
  });

  describe('Account Lifecycle Gating (pending, suspended, rejected)', () => {
    it('redirects pending users to /auth/pending?state=pending', () => {
      const user = makeUser();
      const profile = makeProfile('student', 'pending');
      const res = evaluateRouteAuthorization('/(tabs)/courses', user, profile);
      expect(res).toEqual({
        allowed: false,
        redirectTo: '/auth/pending?state=pending',
        reason: 'approval-pending',
      });
    });

    it('redirects suspended users to /auth/pending?state=suspended', () => {
      const user = makeUser();
      const profile = makeProfile('student', 'suspended');
      const res = evaluateRouteAuthorization('/(tabs)/courses', user, profile);
      expect(res).toEqual({
        allowed: false,
        redirectTo: '/auth/pending?state=suspended',
        reason: 'account-suspended',
      });
    });

    it('redirects rejected users to /auth/pending?state=rejected', () => {
      const user = makeUser();
      const profile = makeProfile('student', 'rejected');
      const res = evaluateRouteAuthorization('/(tabs)/courses', user, profile);
      expect(res).toEqual({
        allowed: false,
        redirectTo: '/auth/pending?state=rejected',
        reason: 'account-rejected',
      });
    });
  });

  describe('Teacher Route Protection (/teacher/*)', () => {
    const teacherRoutes = [
      '/teacher',
      '/teacher/lessons',
      '/teacher/students',
      '/teacher/assignments',
      '/teacher/progress',
      '/teacher/c_123',
    ];

    it('denies students from accessing teacher routes and redirects to /unauthorized?required=teacher', () => {
      const user = makeUser('s_1', 'student@mslb.edu');
      const profile = makeProfile('student', 'approved', 'student@mslb.edu');

      teacherRoutes.forEach((route) => {
        const res = evaluateRouteAuthorization(route, user, profile);
        expect(res).toEqual({
          allowed: false,
          redirectTo: '/unauthorized?required=teacher',
          reason: 'teacher-required',
        });
      });
    });

    it('denies moderators from accessing teacher routes', () => {
      const user = makeUser('m_1', 'mod@mslb.edu');
      const profile = makeProfile('moderator', 'approved', 'mod@mslb.edu');

      const res = evaluateRouteAuthorization('/teacher/lessons', user, profile);
      expect(res).toEqual({
        allowed: false,
        redirectTo: '/unauthorized?required=teacher',
        reason: 'teacher-required',
      });
    });

    it('allows approved teachers to access teacher routes', () => {
      const user = makeUser('t_1', 'teacher@mslb.edu');
      const profile = makeProfile('teacher', 'approved', 'teacher@mslb.edu');

      teacherRoutes.forEach((route) => {
        const res = evaluateRouteAuthorization(route, user, profile);
        expect(res).toEqual({ allowed: true });
      });
    });

    it('allows assistant_teachers to access teacher routes', () => {
      const user = makeUser('at_1', 'assistant@mslb.edu');
      const profile = makeProfile('assistant_teacher', 'approved', 'assistant@mslb.edu');

      teacherRoutes.forEach((route) => {
        const res = evaluateRouteAuthorization(route, user, profile);
        expect(res).toEqual({ allowed: true });
      });
    });

    it('allows admins and super_admins to access teacher routes', () => {
      const adminUser = makeUser('adm_1', 'admin@mslb.edu');
      const adminProfile = makeProfile('admin', 'approved', 'admin@mslb.edu');
      expect(evaluateRouteAuthorization('/teacher/lessons', adminUser, adminProfile)).toEqual({
        allowed: true,
      });

      const superUser = makeUser('sa_1', 'super@mslb.edu');
      const superProfile = makeProfile('super_admin', 'approved', 'super@mslb.edu');
      expect(evaluateRouteAuthorization('/teacher/lessons', superUser, superProfile)).toEqual({
        allowed: true,
      });
    });

    it('allows founders to access teacher routes even with student role', () => {
      const founderUser = makeUser('f_1', 'sumraftm@gmail.com');
      const founderProfile = makeProfile('student', 'approved', 'sumraftm@gmail.com');

      expect(evaluateRouteAuthorization('/teacher/lessons', founderUser, founderProfile)).toEqual({
        allowed: true,
      });
    });
  });

  describe('Admin Route Protection (/admin/*)', () => {
    it('denies teachers and students from accessing /admin/users', () => {
      const studentUser = makeUser('s_1');
      const studentProfile = makeProfile('student', 'approved');
      expect(evaluateRouteAuthorization('/admin/users', studentUser, studentProfile)).toEqual({
        allowed: false,
        redirectTo: '/unauthorized?required=admin',
        reason: 'admin-required',
      });

      const teacherUser = makeUser('t_1');
      const teacherProfile = makeProfile('teacher', 'approved');
      expect(evaluateRouteAuthorization('/admin/users', teacherUser, teacherProfile)).toEqual({
        allowed: false,
        redirectTo: '/unauthorized?required=admin',
        reason: 'admin-required',
      });
    });

    it('allows admins to access /admin/users', () => {
      const adminUser = makeUser('adm_1');
      const adminProfile = makeProfile('admin', 'approved');
      expect(evaluateRouteAuthorization('/admin/users', adminUser, adminProfile)).toEqual({
        allowed: true,
      });
    });
  });
});
