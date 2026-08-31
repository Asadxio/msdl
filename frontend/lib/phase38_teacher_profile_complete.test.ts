import fs from 'fs';
import path from 'path';
import { canAssignRole, normalizeRole, isStaffRole } from './roles';
import { hasPermission } from './rbac';

describe('Phase 38: Teacher Profile & Complete Faculty Workspace Audit', () => {
  describe('1. Teacher Profile Screen Configuration', () => {
    it('verifies Teacher Profile identity and badging in about.tsx', () => {
      const source = fs.readFileSync(path.join(__dirname, '../app/(tabs)/about.tsx'), 'utf8');
      expect(source).toContain('Faculty Services & Profile');
      expect(source).toContain('FACULTY / USTAADHA');
      expect(source).toContain('FACULTY ID');
      expect(source).toContain('Teaching Workspace Overview');
      expect(source).toContain('Teaching & Academics');
      expect(source).toContain('Faculty Chat');
    });

    it('verifies all existing student and admin sections remain intact in about.tsx', () => {
      const source = fs.readFileSync(path.join(__dirname, '../app/(tabs)/about.tsx'), 'utf8');
      expect(source).toContain('Student Services & Profile');
      expect(source).toContain('Academic Performance');
      expect(source).toContain('Earned Achievements');
      expect(source).toContain('Pay Fees');
      expect(source).toContain('About Our Madrasa');
      expect(source).toContain('Feedback');
      expect(source).toContain('Settings');
      expect(source).toContain('Sign Out');
    });

    it('verifies Teacher role cannot access Admin tools in about.tsx', () => {
      const source = fs.readFileSync(path.join(__dirname, '../app/(tabs)/about.tsx'), 'utf8');
      expect(source).toContain("isAdmin ? (");
      expect(source).toContain("profile?.role === 'admin' || profile?.role === 'super_admin'");
    });
  });

  describe('2. Teacher Role Permissions & Boundaries', () => {
    const teacherProfile = { name: 'Ustaadha Maryam', email: 'maryam@mslb.com', role: 'teacher' as const, status: 'approved' as const };

    it('grants legitimate teaching permissions to teachers', () => {
      expect(hasPermission(teacherProfile, 'teacher.class.manage')).toBe(true);
      expect(hasPermission(teacherProfile, 'teacher.assignment.review')).toBe(true);
    });

    it('denies user administration and payment administration to teachers', () => {
      expect(hasPermission(teacherProfile, 'admin.users.manage')).toBe(false);
      expect(hasPermission(teacherProfile, 'admin.payments.review')).toBe(false);
    });
  });
});
