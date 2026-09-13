import type { UserProfile } from '@/context/AuthContext';
import { isFounderEmail } from '@/lib/founderPolicy';
import { hasPermission, type Permission } from '@/lib/rbac';
import { normalizeRole } from '@/lib/roles';

export interface RouteAuthorizationResult {
  allowed: boolean;
  redirectTo?: string;
  reason?: string;
}

/**
 * Detailed Route Permission Matrix for MSLB.
 * Maps exact route patterns to required roles or permissions.
 */
export function evaluateRouteAuthorization(
  pathname: string,
  user: { uid: string; email?: string | null } | null,
  profile: UserProfile | null,
  activeOrgStatus?: 'active' | 'trial' | 'suspended' | 'archived' | null
): RouteAuthorizationResult {
  const cleanPath = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  const isFounder = isFounderEmail(profile?.email || user?.email || '');
  const userRole = normalizeRole(profile?.role);
  const isApproved = profile?.status === 'approved' || isFounder;

  // 1. Guest Routes — Allowed for non-authenticated users
  const isGuestRoute =
    cleanPath.startsWith('/auth') ||
    cleanPath === '/onboarding-entry' ||
    cleanPath.startsWith('/onboarding-first-time') ||
    cleanPath === '/terms' ||
    cleanPath === '/privacy' ||
    cleanPath === '/community-guidelines' ||
    cleanPath === '/data-privacy';

  if (!user) {
    if (isGuestRoute) return { allowed: true };
    return { allowed: false, redirectTo: '/auth/login', reason: 'unauthenticated' };
  }

  // 2. Lifecycle Status Entrapment (pending, rejected, suspended, deactivated)
  if (profile?.status === 'rejected') {
    if (cleanPath === '/auth/pending') return { allowed: true };
    return { allowed: false, redirectTo: '/auth/pending?state=rejected', reason: 'account-rejected' };
  }

  if (profile?.status === 'suspended') {
    if (cleanPath === '/auth/pending') return { allowed: true };
    return { allowed: false, redirectTo: '/auth/pending?state=suspended', reason: 'account-suspended' };
  }

  if (profile?.status === 'deactivated') {
    if (cleanPath === '/auth/pending') return { allowed: true };
    return { allowed: false, redirectTo: '/auth/pending?state=deactivated', reason: 'account-deactivated' };
  }

  if (profile?.status === 'pending' && !isFounder) {
    if (cleanPath === '/auth/pending') return { allowed: true };
    return { allowed: false, redirectTo: '/auth/pending?state=pending', reason: 'approval-pending' };
  }

  // 3. Authenticated user trying to access login/signup
  if (cleanPath === '/auth/login' || cleanPath === '/auth/signup') {
    return { allowed: false, redirectTo: '/', reason: 'already-authenticated' };
  }

  // 4. Platform Super Admin Route — /admin/organizations
  if (cleanPath === '/admin/organizations') {
    if (userRole === 'super_admin' || isFounder) {
      return { allowed: true };
    }
    return {
      allowed: false,
      redirectTo: '/unauthorized?required=super_admin',
      reason: 'super-admin-required',
    };
  }

  // 5. Security & Audit Routes — /admin/security, /admin/telemetry, /admin/analytics
  if (cleanPath === '/admin/security' || cleanPath === '/admin/telemetry') {
    if (isFounder || hasPermission(profile, 'admin.analytics.read') || userRole === 'super_admin' || userRole === 'admin') {
      return { allowed: true };
    }
    return { allowed: false, redirectTo: '/unauthorized?required=admin', reason: 'analytics-read-required' };
  }

  // 6. Moderation Route — /admin/moderation
  if (cleanPath === '/admin/moderation') {
    if (isFounder || userRole === 'moderator' || userRole === 'admin' || userRole === 'super_admin') {
      return { allowed: true };
    }
    return { allowed: false, redirectTo: '/unauthorized?required=moderator', reason: 'moderator-required' };
  }

  // 7. General Admin Routes — /admin/*
  if (cleanPath.startsWith('/admin/')) {
    if (isFounder || userRole === 'admin' || userRole === 'super_admin') {
      return { allowed: true };
    }
    return { allowed: false, redirectTo: '/unauthorized?required=admin', reason: 'admin-required' };
  }

  // 8. Fatawa Management — /fatawa/manage
  if (cleanPath === '/fatawa/manage') {
    if (isFounder || userRole === 'admin' || userRole === 'super_admin' || userRole === 'teacher') {
      return { allowed: true };
    }
    return { allowed: false, redirectTo: '/unauthorized?required=teacher', reason: 'teacher-required' };
  }

  // All other screens allowed
  return { allowed: true };
}
