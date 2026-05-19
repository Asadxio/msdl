import { logger } from '@/lib/logger';

export const APP_ROLES = ['super_admin', 'admin', 'moderator', 'teacher', 'assistant_teacher', 'student'] as const;
export type AppRole = (typeof APP_ROLES)[number];
export const DEFAULT_ROLE: AppRole = 'student';
export const ONBOARDING_ROLES = ['student', 'teacher'] as const;
export const ROLE_RANK: Record<AppRole, number> = { super_admin: 100, admin: 80, moderator: 60, teacher: 40, assistant_teacher: 30, student: 10 };
export const RESTRICTED_ASSIGNMENT_ROLES: AppRole[] = ['super_admin', 'admin', 'assistant_teacher'];
export type OnboardingRole = (typeof ONBOARDING_ROLES)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && (APP_ROLES as readonly string[]).includes(value);
}

export function normalizeRole(role: unknown, context = 'unknown'): AppRole {
  const normalized = String(role || '').trim().toLowerCase();
  if (isAppRole(normalized)) return normalized;
  if (role !== undefined && role !== null && role !== '') {
    logger.warn(`[roles] Invalid role \"${String(role)}\" in ${context}; falling back to ${DEFAULT_ROLE}`);
  }
  return DEFAULT_ROLE;
}

export function canManageUsers(role: AppRole): boolean {
  return role === 'super_admin' || role === 'admin';
}

export function canAssignRole(actor: AppRole, targetRole: AppRole, targetUserId?: string, actorUserId?: string): boolean {
  if (targetUserId && actorUserId && targetUserId === actorUserId) return false;
  if (actor === 'super_admin') return true;
  if (actor === 'admin') return !RESTRICTED_ASSIGNMENT_ROLES.includes(targetRole) && targetRole !== 'moderator';
  return false;
}
