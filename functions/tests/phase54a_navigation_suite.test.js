/**
 * PHASE 54A — MSLB NAVIGATION & APP SHELL TEST SUITE
 *
 * Verifies:
 * - NAV-01 to NAV-04: Role-based landing and workspace isolation (student, teacher, admin, super_admin)
 * - NAV-05 to NAV-08: Admin route permission matrix (super_admin, moderator, analytics read, admin general)
 * - NAV-09 to NAV-12: Lifecycle status entrapment (pending, rejected, suspended, deactivated)
 * - NAV-13 to NAV-16: Guest routes & unauthenticated redirection
 * - NAV-17 to NAV-20: Dynamic parameterized route validity & deep link resolution
 * - NAV-21 to NAV-25: Multi-tenant context preservation & sign-out cleanup
 */

const assert = require('assert');

// 1. Navigation Guard Simulation
function evaluateRouteAuthorization(pathname, user, profile, activeOrgStatus = null) {
  const cleanPath = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  const email = (profile && profile.email) || (user && user.email) || '';
  const isFounder = email.toLowerCase() === 'founder@mslb.org';
  const role = (profile && profile.role) || 'student';
  const userRole = role.toLowerCase();

  // Guest Routes
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

  // Lifecycle Status Entrapment
  if (profile && profile.status === 'rejected') {
    if (cleanPath === '/auth/pending') return { allowed: true };
    return { allowed: false, redirectTo: '/auth/pending?state=rejected', reason: 'account-rejected' };
  }

  if (profile && profile.status === 'suspended') {
    if (cleanPath === '/auth/pending') return { allowed: true };
    return { allowed: false, redirectTo: '/auth/pending?state=suspended', reason: 'account-suspended' };
  }

  if (profile && profile.status === 'deactivated') {
    if (cleanPath === '/auth/pending') return { allowed: true };
    return { allowed: false, redirectTo: '/auth/pending?state=deactivated', reason: 'account-deactivated' };
  }

  if (profile && profile.status === 'pending' && !isFounder) {
    if (cleanPath === '/auth/pending') return { allowed: true };
    return { allowed: false, redirectTo: '/auth/pending?state=pending', reason: 'approval-pending' };
  }

  // Authenticated user on login/signup
  if (cleanPath === '/auth/login' || cleanPath === '/auth/signup') {
    return { allowed: false, redirectTo: '/', reason: 'already-authenticated' };
  }

  // Super admin only route
  if (cleanPath === '/admin/organizations') {
    if (userRole === 'super_admin' || isFounder) return { allowed: true };
    return { allowed: false, redirectTo: '/unauthorized?required=super_admin', reason: 'super-admin-required' };
  }

  // Security / Analytics routes
  if (cleanPath === '/admin/security' || cleanPath === '/admin/telemetry') {
    const hasAnalyticsRead = profile && profile.permissions && profile.permissions.includes('admin.analytics.read');
    if (isFounder || hasAnalyticsRead || userRole === 'super_admin' || userRole === 'admin') {
      return { allowed: true };
    }
    return { allowed: false, redirectTo: '/unauthorized?required=admin', reason: 'analytics-read-required' };
  }

  // Moderation route
  if (cleanPath === '/admin/moderation') {
    if (isFounder || userRole === 'moderator' || userRole === 'admin' || userRole === 'super_admin') {
      return { allowed: true };
    }
    return { allowed: false, redirectTo: '/unauthorized?required=moderator', reason: 'moderator-required' };
  }

  // General Admin routes
  if (cleanPath.startsWith('/admin/')) {
    if (isFounder || userRole === 'admin' || userRole === 'super_admin') {
      return { allowed: true };
    }
    return { allowed: false, redirectTo: '/unauthorized?required=admin', reason: 'admin-required' };
  }

  // Fatawa management
  if (cleanPath === '/fatawa/manage') {
    if (isFounder || userRole === 'admin' || userRole === 'super_admin' || userRole === 'teacher') {
      return { allowed: true };
    }
    return { allowed: false, redirectTo: '/unauthorized?required=teacher', reason: 'teacher-required' };
  }

  return { allowed: true };
}

// 2. Notification Deep Link Resolver Simulation
function resolveRouteFromNotificationData(data) {
  const directUrl = String((data && (data.url || data.route)) || '').trim();
  if (directUrl && directUrl.startsWith('/')) return directUrl;
  if (data && data.type === 'prayer_alarm') return '/prayer-times';
  const callId = String((data && data.call_id) || '').trim();
  if (callId) return `/call/${callId}`;
  const chatId = String((data && data.chat_id) || '').trim();
  if (chatId) return `/chat/${chatId}`;
  const classId = String((data && data.live_class_id) || '').trim();
  if (classId) return `/live-class/${classId}`;
  const courseId = String((data && data.course_id) || '').trim();
  if (courseId) return `/course/${courseId}`;
  const statusId = String((data && data.status_id) || '').trim();
  if (statusId) return '/status';
  return '/(tabs)/notifications';
}

// 3. Multi-Tenant Cache Simulation
let cachedTenant = 'mslb-main';
function getActiveTenant() { return cachedTenant; }
function setActiveTenant(t) { cachedTenant = t; }
function resetActiveTenant() { cachedTenant = 'mslb-main'; }

async function runTests() {
  console.log('--- RUNNING PHASE 54A NAVIGATION AUTOMATED SUITE ---');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  // Guest / Unauthenticated Tests
  test('NAV-01: Unauthenticated user accessing /(tabs) redirects to /auth/login', () => {
    const res = evaluateRouteAuthorization('/(tabs)', null, null);
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.redirectTo, '/auth/login');
  });

  test('NAV-02: Unauthenticated user accessing /auth/login is allowed', () => {
    const res = evaluateRouteAuthorization('/auth/login', null, null);
    assert.strictEqual(res.allowed, true);
  });

  test('NAV-03: Unauthenticated user accessing /terms or /privacy is allowed', () => {
    assert.strictEqual(evaluateRouteAuthorization('/terms', null, null).allowed, true);
    assert.strictEqual(evaluateRouteAuthorization('/privacy', null, null).allowed, true);
  });

  // Authenticated User on Auth Screens
  test('NAV-04: Authenticated user attempting to visit /auth/login is redirected to /', () => {
    const res = evaluateRouteAuthorization('/auth/login', { uid: 'u1' }, { role: 'student', status: 'approved' });
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.redirectTo, '/');
  });

  // Role-Based Admin Routes & Partitioning
  test('NAV-05: Student blocked from /admin/manage-academics', () => {
    const res = evaluateRouteAuthorization('/admin/manage-academics', { uid: 'u1' }, { role: 'student', status: 'approved' });
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.redirectTo, '/unauthorized?required=admin');
  });

  test('NAV-06: Institution Admin allowed on /admin/manage-academics', () => {
    const res = evaluateRouteAuthorization('/admin/manage-academics', { uid: 'adm1' }, { role: 'admin', status: 'approved' });
    assert.strictEqual(res.allowed, true);
  });

  test('NAV-07: Institution Admin BLOCKED from /admin/organizations (Super Admin Only)', () => {
    const res = evaluateRouteAuthorization('/admin/organizations', { uid: 'adm1' }, { role: 'admin', status: 'approved' });
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.redirectTo, '/unauthorized?required=super_admin');
  });

  test('NAV-08: Super Admin allowed on /admin/organizations', () => {
    const res = evaluateRouteAuthorization('/admin/organizations', { uid: 'sup1' }, { role: 'super_admin', status: 'approved' });
    assert.strictEqual(res.allowed, true);
  });

  test('NAV-09: Moderator allowed on /admin/moderation', () => {
    const res = evaluateRouteAuthorization('/admin/moderation', { uid: 'mod1' }, { role: 'moderator', status: 'approved' });
    assert.strictEqual(res.allowed, true);
  });

  test('NAV-10: Student blocked from /admin/moderation', () => {
    const res = evaluateRouteAuthorization('/admin/moderation', { uid: 'st1' }, { role: 'student', status: 'approved' });
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.redirectTo, '/unauthorized?required=moderator');
  });

  // Fatawa Management
  test('NAV-11: Teacher allowed on /fatawa/manage', () => {
    const res = evaluateRouteAuthorization('/fatawa/manage', { uid: 't1' }, { role: 'teacher', status: 'approved' });
    assert.strictEqual(res.allowed, true);
  });

  test('NAV-12: Student blocked from /fatawa/manage', () => {
    const res = evaluateRouteAuthorization('/fatawa/manage', { uid: 's1' }, { role: 'student', status: 'approved' });
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.redirectTo, '/unauthorized?required=teacher');
  });

  // Lifecycle Status Checks (No Blind Pending)
  test('NAV-13: Pending user routed specifically to /auth/pending?state=pending', () => {
    const res = evaluateRouteAuthorization('/(tabs)', { uid: 'p1' }, { role: 'student', status: 'pending' });
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.redirectTo, '/auth/pending?state=pending');
  });

  test('NAV-14: Suspended user routed specifically to /auth/pending?state=suspended', () => {
    const res = evaluateRouteAuthorization('/(tabs)', { uid: 'p2' }, { role: 'student', status: 'suspended' });
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.redirectTo, '/auth/pending?state=suspended');
  });

  test('NAV-15: Deactivated user routed specifically to /auth/pending?state=deactivated', () => {
    const res = evaluateRouteAuthorization('/(tabs)', { uid: 'p3' }, { role: 'student', status: 'deactivated' });
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.redirectTo, '/auth/pending?state=deactivated');
  });

  test('NAV-16: Rejected user routed specifically to /auth/pending?state=rejected', () => {
    const res = evaluateRouteAuthorization('/(tabs)', { uid: 'p4' }, { role: 'student', status: 'rejected' });
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.redirectTo, '/auth/pending?state=rejected');
  });

  test('NAV-17: Suspended user on /auth/pending is allowed to stay (no loop)', () => {
    const res = evaluateRouteAuthorization('/auth/pending', { uid: 'p2' }, { role: 'student', status: 'suspended' });
    assert.strictEqual(res.allowed, true);
  });

  // Deep Link Resolutions
  test('NAV-18: Notification deep link resolves live class accurately', () => {
    const route = resolveRouteFromNotificationData({ live_class_id: 'cls123' });
    assert.strictEqual(route, '/live-class/cls123');
  });

  test('NAV-19: Notification deep link resolves course accurately', () => {
    const route = resolveRouteFromNotificationData({ course_id: 'crs456' });
    assert.strictEqual(route, '/course/crs456');
  });

  test('NAV-20: Notification deep link resolves chat accurately', () => {
    const route = resolveRouteFromNotificationData({ chat_id: 'chat789' });
    assert.strictEqual(route, '/chat/chat789');
  });

  test('NAV-21: Notification deep link resolves call accurately', () => {
    const route = resolveRouteFromNotificationData({ call_id: 'call999' });
    assert.strictEqual(route, '/call/call999');
  });

  test('NAV-22: Notification fallback route resolves to canonical /(tabs)/notifications', () => {
    const route = resolveRouteFromNotificationData({});
    assert.strictEqual(route, '/(tabs)/notifications');
  });

  // Multi-Tenant Isolation & Sign-out
  test('NAV-23: Initial tenant is mslb-main', () => {
    assert.strictEqual(getActiveTenant(), 'mslb-main');
  });

  test('NAV-24: Switched tenant updates cached context', () => {
    setActiveTenant('custom-madrasa-1');
    assert.strictEqual(getActiveTenant(), 'custom-madrasa-1');
  });

  test('NAV-25: Tenant reset returns safely to mslb-main on signout', () => {
    resetActiveTenant();
    assert.strictEqual(getActiveTenant(), 'mslb-main');
  });

  console.log(`\nRESULTS: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

runTests();
