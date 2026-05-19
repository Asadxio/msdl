import { canAssignRole, normalizeRole } from './roles';

describe('roles security boundaries', () => {
  it('falls back invalid role to student', () => {
    expect(normalizeRole('root')).toBe('student');
  });

  it('prevents admin from assigning admin/super_admin/moderator/assistant_teacher', () => {
    expect(canAssignRole('admin', 'admin')).toBe(false);
    expect(canAssignRole('admin', 'super_admin')).toBe(false);
    expect(canAssignRole('admin', 'moderator')).toBe(false);
    expect(canAssignRole('admin', 'assistant_teacher')).toBe(false);
  });

  it('allows super_admin elevation actions', () => {
    expect(canAssignRole('super_admin', 'admin')).toBe(true);
    expect(canAssignRole('super_admin', 'super_admin')).toBe(true);
  });
});
