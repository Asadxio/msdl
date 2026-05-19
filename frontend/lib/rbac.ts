import type { UserProfile } from '@/context/AuthContext';

export type AppRole = 'super_admin' | 'admin' | 'moderator' | 'teacher' | 'assistant_teacher' | 'student';
export type Permission =
  | 'admin.dashboard.read'
  | 'admin.users.manage'
  | 'admin.users.bulk'
  | 'admin.academics.manage'
  | 'admin.payments.review'
  | 'admin.analytics.read'
  | 'moderation.reports.read'
  | 'moderation.status.action'
  | 'moderation.chat.action'
  | 'teacher.class.manage'
  | 'teacher.assignment.review';

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  super_admin: [
    'admin.dashboard.read', 'admin.users.manage', 'admin.users.bulk', 'admin.academics.manage', 'admin.payments.review', 'admin.analytics.read',
    'moderation.reports.read', 'moderation.status.action', 'moderation.chat.action', 'teacher.class.manage', 'teacher.assignment.review',
  ],
  admin: [
    'admin.dashboard.read', 'admin.users.manage', 'admin.users.bulk', 'admin.academics.manage', 'admin.payments.review', 'admin.analytics.read',
    'moderation.reports.read', 'moderation.status.action', 'moderation.chat.action',
  ],
  moderator: ['moderation.reports.read', 'moderation.status.action', 'moderation.chat.action', 'admin.dashboard.read'],
  teacher: ['teacher.class.manage', 'teacher.assignment.review', 'admin.dashboard.read'],
  assistant_teacher: ['teacher.assignment.review', 'admin.dashboard.read'],
  student: [],
};

export function normalizeRole(role: string | undefined): AppRole {
  const r = String(role || '').toLowerCase();
  if (r === 'super_admin') return 'super_admin';
  if (r === 'admin') return 'admin';
  if (r === 'moderator') return 'moderator';
  if (r === 'assistant_teacher') return 'assistant_teacher';
  if (r === 'teacher') return 'teacher';
  return 'student';
}

export function hasPermission(profile: UserProfile | null, permission: Permission): boolean {
  if (!profile || profile.status !== 'approved') return false;
  const role = normalizeRole(profile.role);
  return ROLE_PERMISSIONS[role].includes(permission);
}
