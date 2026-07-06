import type { UserProfile } from '@/context/AuthContext';
import { normalizeRole, type AppRole } from '@/lib/roles';
export type Permission =
  | 'admin.dashboard.read'
  | 'admin.users.manage'
  | 'admin.users.bulk'
  | 'admin.academics.manage'
  | 'admin.payments.review'
  | 'admin.analytics.read'
  | 'admin.notifications.send'
  | 'moderation.reports.read'
  | 'moderation.status.action'
  | 'moderation.chat.action'
  | 'teacher.class.manage'
  | 'teacher.assignment.review';

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  super_admin: [
    'admin.dashboard.read', 'admin.users.manage', 'admin.users.bulk', 'admin.academics.manage', 'admin.payments.review', 'admin.analytics.read', 'admin.notifications.send',
    'moderation.reports.read', 'moderation.status.action', 'moderation.chat.action', 'teacher.class.manage', 'teacher.assignment.review',
  ],
  admin: [
    'admin.dashboard.read', 'admin.users.manage', 'admin.users.bulk', 'admin.academics.manage', 'admin.payments.review', 'admin.analytics.read', 'admin.notifications.send',
    'moderation.reports.read', 'moderation.status.action', 'moderation.chat.action',
  ],
  moderator: ['moderation.reports.read', 'moderation.status.action', 'moderation.chat.action', 'admin.dashboard.read'],
  teacher: ['teacher.class.manage', 'teacher.assignment.review', 'admin.dashboard.read'],
  assistant_teacher: ['teacher.assignment.review', 'admin.dashboard.read'],
  student: [],
};


export function hasPermission(profile: UserProfile | null, permission: Permission): boolean {
  if (!profile || profile.status !== 'approved') return false;
  const role = normalizeRole(profile.role);
  return ROLE_PERMISSIONS[role].includes(permission);
}
