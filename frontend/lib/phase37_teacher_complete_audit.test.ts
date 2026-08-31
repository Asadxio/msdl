import fs from 'fs';
import path from 'path';
import { canAssignRole, normalizeRole, isStaffRole } from './roles';
import { hasPermission } from './rbac';
import { canSendMessage, canInitiateDirectChat } from './chatPermissions';

describe('Phase 37: Teacher Role Complete Audit & Workspace Hardening', () => {
  const teacherProfile = {
    name: 'Ustaadha Fatima',
    email: 'fatima@mslb.com',
    role: 'teacher' as const,
    status: 'approved' as const,
  };

  const studentProfile = {
    name: 'Aisha Student',
    email: 'aisha@mslb.com',
    role: 'student' as const,
    status: 'approved' as const,
  };

  const adminProfile = {
    name: 'Admin Principal',
    email: 'admin@mslb.com',
    role: 'admin' as const,
    status: 'approved' as const,
  };

  describe('1. Teacher RBAC & Role Boundaries', () => {
    it('recognizes Teacher as a legitimate staff role', () => {
      expect(isStaffRole('teacher')).toBe(true);
      expect(isStaffRole('assistant_teacher')).toBe(true);
      expect(isStaffRole('student')).toBe(false);
    });

    it('normalizes teacher role correctly', () => {
      expect(normalizeRole('teacher', 'test')).toBe('teacher');
      expect(normalizeRole('assistant_teacher', 'test')).toBe('assistant_teacher');
    });

    it('prevents teachers from modifying admin or system roles', () => {
      expect(canAssignRole('teacher', 'admin', 'user123', 'teacher123')).toBe(false);
      expect(canAssignRole('teacher', 'super_admin', 'user123', 'teacher123')).toBe(false);
      expect(canAssignRole('teacher', 'student', 'user123', 'teacher123')).toBe(false);
    });

    it('allows admins to assign teacher role but blocks self-escalation', () => {
      expect(canAssignRole('admin', 'teacher', 'user123', 'admin123')).toBe(true);
      expect(canAssignRole('student', 'teacher', 'user123', 'user123')).toBe(false);
    });
  });

  describe('2. Teacher Dashboard Integration', () => {
    it('verifies TeacherDashboard component is rendered in HomeScreen', () => {
      const source = fs.readFileSync(path.join(__dirname, '../app/(tabs)/index.tsx'), 'utf8');
      expect(source).toContain('TeacherDashboard');
      expect(source).toContain("profile?.role === 'teacher'");
      expect(source).toContain("profile?.role === 'assistant_teacher'");
    });

    it('verifies TeacherDashboard contains all primary teaching features', () => {
      const source = fs.readFileSync(path.join(__dirname, '../components/teacher/TeacherDashboard.tsx'), 'utf8');
      expect(source).toContain('Teaching Overview');
      expect(source).toContain('My Courses');
      expect(source).toContain('Live Classes');
      expect(source).toContain('Attendance Log');
      expect(source).toContain('Submissions');
      expect(source).toContain('Teaching Actions');
      expect(source).toContain('Assigned Courses');
      expect(source).toContain('Mark Attendance');
      expect(source).toContain('Faculty & Student Chat');
      expect(source).toContain('Live Class Schedule');
      expect(source).toContain('Pending Evaluations');
    });
  });

  describe('3. Teacher Universal Chat Integration', () => {
    it('allows Teacher to communicate with Students, Teachers, and Admins', () => {
      expect(
        canInitiateDirectChat(
          { uid: 'teacher_1', role: 'teacher', status: 'approved' },
          { id: 'student_1', role: 'student', status: 'approved' }
        )
      ).toBe(true);

      expect(
        canInitiateDirectChat(
          { uid: 'teacher_1', role: 'teacher', status: 'approved' },
          { id: 'teacher_2', role: 'teacher', status: 'approved' }
        )
      ).toBe(true);

      expect(
        canInitiateDirectChat(
          { uid: 'teacher_1', role: 'teacher', status: 'approved' },
          { id: 'admin_1', role: 'admin', status: 'approved' }
        )
      ).toBe(true);
    });

    it('prevents self-chatting', () => {
      expect(
        canInitiateDirectChat(
          { uid: 'teacher_1', role: 'teacher', status: 'approved' },
          { id: 'teacher_1', role: 'teacher', status: 'approved' }
        )
      ).toBe(false);
    });

    it('allows teacher to post in participatory chats', () => {
      expect(
        canSendMessage(
          { uid: 'teacher_1', role: 'teacher', status: 'approved' },
          { id: 'chat_1', type: 'direct', participants: ['teacher_1', 'student_1'] }
        )
      ).toBe(true);
    });
  });

  describe('4. Firestore Security Rules Alignment', () => {
    it('verifies isApprovedVerifiedUser includes all approved institutional users', () => {
      const rules = fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8');
      expect(rules).toContain("get(/databases/$(database)/documents/users/$(request.auth.uid)).data.status == 'approved'");
    });

    it('verifies audio_lessons and live_classes permissions for teachers', () => {
      const rules = fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8');
      expect(rules).toContain('isApprovedTeacher()');
      expect(rules).toContain('isTeacherOrAdmin()');
    });
  });
});
