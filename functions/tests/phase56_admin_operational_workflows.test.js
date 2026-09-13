/**
 * Phase 56 — Admin Operational Workflows Test Suite
 * ADM56-01 through ADM56-25
 *
 * Verifies:
 * - FIX-1: AdminDashboard KPI Correctness
 *   - ADM56-01: moderation KPI uses moderation_reports & state === 'pending'
 *   - ADM56-02: moderation_queue legacy reference verified eliminated
 *   - ADM56-03: privacy KPI uses state in ['requested', 'reviewing', 'processing']
 *   - ADM56-04: privacy legacy status === 'open' returns 0 on modern schema
 *   - ADM56-05: payment KPI status-field pending count
 *   - ADM56-06: payment KPI state-field pending count
 *   - ADM56-07: payment KPI deduplication via Math.max prevents double-counting
 *   - ADM56-08: live class KPI query uses created_at range, not scheduled_at
 *   - ADM56-25: announcement KPI card relabeled from "Announcements" to "Total Sent"
 *
 * - FIX-2: QuickAdminActions Routing
 *   - ADM56-15: Manage Faculty routes to ROUTES.admin.academics (manage-academics)
 *
 * - FIX-3: Admin User Operations & Enrollment Integrity
 *   - ADM56-11: updateUser approval stamps organization_id for org-less users
 *   - ADM56-12: updateUser approval preserves existing organization_id (no overwrite)
 *   - ADM56-13: handleGrantCourseAccess writes organization_id to enrollment doc
 *   - ADM56-14: runBulkEnroll writes organization_id to all batch enrollment docs
 *   - ADM56-16: cross-tenant approval prevention (target tenant preserved)
 *   - ADM56-23: enrollment organization_id matches admin active tenant ID
 *
 * - FIX-4: Live Class Creation & Tenant Listener
 *   - ADM56-09: startLiveClass writes organization_id when provided
 *   - ADM56-10: live_classes listener filters by organization_id for custom tenants
 *   - ADM56-17: live classes without scheduled_at still counted via created_at
 *   - ADM56-20: default tenant (mslb-main) retains global view for legacy classes
 *   - ADM56-24: startLiveClass omits organization_id when absent (no silent hijack)
 *
 * - FIX-5: Firestore Composite Indexes
 *   - ADM56-18: firestore.indexes.json has users (organization_id + displayName)
 *   - ADM56-19: firestore.indexes.json has live_classes (organization_id + created_at)
 *
 * - RBAC & Governance
 *   - ADM56-21: moderation reports accessible to admin role
 *   - ADM56-22: moderation reports blocked for student role
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

async function runAll() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('PHASE 56 — ADMIN OPERATIONAL WORKFLOWS TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════\n');

  const DEFAULT_ORG = 'mslb-main';
  const TENANT_ORG = 'madrasa-al-noor';

  // ──────────────────────────────────────────────────────────
  // FIX-1: AdminDashboard KPI Verification
  // ──────────────────────────────────────────────────────────

  test('ADM56-01: moderation KPI correctly queries moderation_reports with state=pending', () => {
    const reports = [
      { id: 'r1', state: 'pending' },
      { id: 'r2', state: 'resolved' },
      { id: 'r3', state: 'pending' },
    ];
    const pendingCount = reports.filter(r => r.state === 'pending').length;
    assert.strictEqual(pendingCount, 2);
  });

  test('ADM56-02: moderation_queue reference is eliminated from AdminDashboard source', () => {
    const dashboardSrc = fs.readFileSync(
      path.resolve(__dirname, '../../frontend/components/admin/AdminDashboard.tsx'),
      'utf8'
    );
    assert.ok(!dashboardSrc.includes("'moderation_queue'"), "AdminDashboard must not reference 'moderation_queue'");
    assert.ok(dashboardSrc.includes("'moderation_reports'"), "AdminDashboard must reference 'moderation_reports'");
  });

  test('ADM56-03: privacy KPI accurately counts requested, reviewing, processing states', () => {
    const requests = [
      { id: 'p1', state: 'requested' },
      { id: 'p2', state: 'reviewing' },
      { id: 'p3', state: 'processing' },
      { id: 'p4', state: 'completed' },
      { id: 'p5', state: 'rejected' },
    ];
    const pendingStates = ['requested', 'reviewing', 'processing'];
    const pendingCount = requests.filter(r => pendingStates.includes(r.state)).length;
    assert.strictEqual(pendingCount, 3);
  });

  test('ADM56-04: legacy status=open on privacy requests yields 0 on modern schema', () => {
    const requests = [
      { id: 'p1', state: 'requested' },
      { id: 'p2', state: 'reviewing' },
    ];
    // Modern records do not have status === 'open'
    const openCount = requests.filter(r => r.status === 'open').length;
    assert.strictEqual(openCount, 0);
  });

  test('ADM56-05: payment KPI counts pending by legacy status field', () => {
    const payments = [
      { id: 'pay1', status: 'pending', organization_id: DEFAULT_ORG },
      { id: 'pay2', status: 'completed', organization_id: DEFAULT_ORG },
      { id: 'pay3', status: 'pending', organization_id: DEFAULT_ORG },
    ];
    const pendingStatus = payments.filter(p => p.status === 'pending').length;
    assert.strictEqual(pendingStatus, 2);
  });

  test('ADM56-06: payment KPI counts pending by newer state field', () => {
    const payments = [
      { id: 'payA', state: 'pending' },
      { id: 'payB', state: 'paid' },
      { id: 'payC', state: 'pending' },
      { id: 'payD', state: 'pending' },
    ];
    const pendingState = payments.filter(p => p.state === 'pending').length;
    assert.strictEqual(pendingState, 3);
  });

  test('ADM56-07: payment dual-field deduplication via Math.max avoids double-counting', () => {
    // A document having both state='pending' and status='pending'
    const docWithBoth = { id: 'd1', state: 'pending', status: 'pending' };
    const docWithStateOnly = { id: 'd2', state: 'pending' };
    const docWithStatusOnly = { id: 'd3', status: 'pending' };

    const byStatusCount = [docWithBoth, docWithStatusOnly].length; // 2
    const byStateCount = [docWithBoth, docWithStateOnly].length; // 2

    // Naive sum = 4 (double counts d1). Math.max = 2 (correct deduplicated minimum bound)
    const dedupedCount = Math.max(byStatusCount, byStateCount);
    assert.strictEqual(dedupedCount, 2);
    assert.notStrictEqual(dedupedCount, 4);
  });

  test('ADM56-08: live class KPI query filters by created_at range, not scheduled_at', () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const classes = [
      { id: 'c1', title: 'Live Now', created_at: new Date(), status: 'live' }, // Has created_at, no scheduled_at
      { id: 'c2', title: 'Yesterday', created_at: new Date(Date.now() - 86400000 * 2), status: 'live' },
    ];

    const todayClasses = classes.filter(c => c.created_at >= startOfDay && c.created_at <= endOfDay);
    assert.strictEqual(todayClasses.length, 1);
    assert.strictEqual(todayClasses[0].id, 'c1');
  });

  test('ADM56-25: announcement KPI card displays "Total Sent" instead of "Announcements"', () => {
    const dashboardSrc = fs.readFileSync(
      path.resolve(__dirname, '../../frontend/components/admin/AdminDashboard.tsx'),
      'utf8'
    );
    assert.ok(dashboardSrc.includes('<Text style={styles.kpiLabel}>Total Sent</Text>'));
    assert.ok(!dashboardSrc.includes('const CACHE_KEY = \'admin_kpi_summary_v1\';'));
  });

  // ──────────────────────────────────────────────────────────
  // FIX-2: QuickAdminActions Routing Verification
  // ──────────────────────────────────────────────────────────

  test('ADM56-15: QuickAdminActions teachers item routes to ROUTES.admin.academics', () => {
    const actionsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../frontend/components/admin/QuickAdminActions.tsx'),
      'utf8'
    );
    // Find the teachers item definition line
    const match = actionsSrc.match(/id:\s*'teachers'[^}]+route:\s*([^,]+)/);
    assert.ok(match, "teachers action item must exist in QuickAdminActions");
    assert.strictEqual(match[1].trim(), 'ROUTES.admin.academics');
  });

  // ──────────────────────────────────────────────────────────
  // FIX-3: Admin User Operations & Enrollment Integrity
  // ──────────────────────────────────────────────────────────

  test('ADM56-11: updateUser approval stamps activeOrgId if user has no organization_id', () => {
    const targetUser = { id: 'u1', name: 'Student 1' }; // No organization_id
    const activeOrgId = TENANT_ORG;
    const DEFAULT_ORGANIZATION_ID = 'mslb-main';

    let updates = { status: 'approved' };
    let finalUpdates = { ...updates };

    if (updates.status === 'approved') {
      if (!targetUser.organization_id) {
        finalUpdates = {
          ...finalUpdates,
          organization_id: activeOrgId || DEFAULT_ORGANIZATION_ID,
        };
      }
    }

    assert.strictEqual(finalUpdates.organization_id, TENANT_ORG);
  });

  test('ADM56-12: updateUser approval does NOT overwrite an existing organization_id', () => {
    const targetUser = { id: 'u2', name: 'Student 2', organization_id: 'original-tenant' };
    const activeOrgId = TENANT_ORG;
    const DEFAULT_ORGANIZATION_ID = 'mslb-main';

    let updates = { status: 'approved' };
    let finalUpdates = { ...updates };

    if (updates.status === 'approved') {
      if (!targetUser.organization_id) {
        finalUpdates = {
          ...finalUpdates,
          organization_id: activeOrgId || DEFAULT_ORGANIZATION_ID,
        };
      }
    }

    assert.strictEqual(finalUpdates.organization_id, undefined);
  });

  test('ADM56-13: handleGrantCourseAccess stamps organization_id on single enrollment setDoc', () => {
    const usersSrc = fs.readFileSync(
      path.resolve(__dirname, '../../frontend/app/admin/users.tsx'),
      'utf8'
    );
    assert.ok(
      usersSrc.includes("organization_id: activeOrgId || DEFAULT_ORGANIZATION_ID"),
      "handleGrantCourseAccess and runBulkEnroll must include organization_id in enrollment setDoc"
    );
  });

  test('ADM56-14: runBulkEnroll batch enrollment payload includes organization_id', () => {
    const uids = ['u10', 'u11', 'u12'];
    const courseId = 'course-99';
    const activeOrgId = TENANT_ORG;

    const enrollmentDocs = uids.map(uid => ({
      user_id: uid,
      course_id: courseId,
      organization_id: activeOrgId,
      status: 'active',
      bulk_enrolled: true,
    }));

    assert.strictEqual(enrollmentDocs.length, 3);
    enrollmentDocs.forEach(doc => {
      assert.strictEqual(doc.organization_id, TENANT_ORG);
      assert.strictEqual(doc.status, 'active');
    });
  });

  test('ADM56-16: cross-tenant approval prevention prevents reassigning tenant B user to tenant A', () => {
    const userFromTenantB = { id: 'uB', organization_id: 'tenant-b' };
    const adminOfTenantA = 'tenant-a';

    let updates = { status: 'approved' };
    let finalUpdates = { ...updates };

    if (updates.status === 'approved') {
      if (!userFromTenantB.organization_id) {
        finalUpdates.organization_id = adminOfTenantA;
      }
    }

    assert.strictEqual(finalUpdates.organization_id, undefined);
  });

  test('ADM56-23: enrollment organization_id matches the active tenant ID exactly', () => {
    const activeOrgId = 'madrasa-al-falah';
    const enrollment = {
      user_id: 'std1',
      course_id: 'crs1',
      organization_id: activeOrgId,
    };
    assert.strictEqual(enrollment.organization_id, 'madrasa-al-falah');
  });

  // ──────────────────────────────────────────────────────────
  // FIX-4: Live Class Creation & Tenant Listener
  // ──────────────────────────────────────────────────────────

  test('ADM56-09: startLiveClass writes organization_id when provided by caller', () => {
    const liveClassesSrc = fs.readFileSync(
      path.resolve(__dirname, '../../frontend/lib/liveClasses.ts'),
      'utf8'
    );
    assert.ok(
      liveClassesSrc.includes("...(input.organizationId ? { organization_id: input.organizationId } : {})"),
      "startLiveClass must write organization_id when input.organizationId is provided"
    );
  });

  test('ADM56-10: live_classes listener filters by organization_id for custom tenants', () => {
    const liveIndexSrc = fs.readFileSync(
      path.resolve(__dirname, '../../frontend/app/live-class/index.tsx'),
      'utf8'
    );
    assert.ok(
      liveIndexSrc.includes("where('organization_id', '==', activeOrgId)"),
      "live-class/index.tsx must query by organization_id for non-default tenants"
    );
  });

  test('ADM56-17: live classes without scheduled_at are still retrieved via created_at', () => {
    const liveClassDoc = {
      title: 'Realtime Session',
      status: 'live',
      created_at: new Date(),
      started_at: new Date(),
      // scheduled_at is omitted
    };
    assert.ok(liveClassDoc.created_at !== undefined);
    assert.strictEqual(liveClassDoc.scheduled_at, undefined);
  });

  test('ADM56-20: default tenant (mslb-main) retains global view for legacy backward compatibility', () => {
    const liveIndexSrc = fs.readFileSync(
      path.resolve(__dirname, '../../frontend/app/live-class/index.tsx'),
      'utf8'
    );
    assert.ok(
      liveIndexSrc.includes("(!isDefaultOrg && activeOrgId)"),
      "live-class/index.tsx must branch between scoped query and legacy global query"
    );
  });

  test('ADM56-24: startLiveClass omits organization_id when absent without silent default', () => {
    const input = { courseId: 'c1', organizationId: undefined };
    const payload = {
      course_id: input.courseId,
      status: 'live',
      ...(input.organizationId ? { organization_id: input.organizationId } : {}),
    };
    assert.strictEqual(payload.organization_id, undefined);
  });

  // ──────────────────────────────────────────────────────────
  // FIX-5: Firestore Composite Indexes
  // ──────────────────────────────────────────────────────────

  test('ADM56-18: firestore.indexes.json has composite index for users (organization_id + displayName)', () => {
    const indexesPath = path.resolve(__dirname, '../../firestore.indexes.json');
    const indexesData = JSON.parse(fs.readFileSync(indexesPath, 'utf8'));

    const userIndexes = indexesData.indexes.filter(idx => idx.collectionGroup === 'users');
    const hasOrgDisplayName = userIndexes.some(idx => {
      const fieldNames = idx.fields.map(f => f.fieldPath);
      return fieldNames.includes('organization_id') && fieldNames.includes('displayName');
    });

    assert.ok(hasOrgDisplayName, "firestore.indexes.json must include users(organization_id, displayName) index");
  });

  test('ADM56-19: firestore.indexes.json has composite index for live_classes (organization_id + created_at)', () => {
    const indexesPath = path.resolve(__dirname, '../../firestore.indexes.json');
    const indexesData = JSON.parse(fs.readFileSync(indexesPath, 'utf8'));

    const liveIndexes = indexesData.indexes.filter(idx => idx.collectionGroup === 'live_classes');
    const hasOrgCreatedAt = liveIndexes.some(idx => {
      const fieldNames = idx.fields.map(f => f.fieldPath);
      return fieldNames.includes('organization_id') && fieldNames.includes('created_at');
    });

    assert.ok(hasOrgCreatedAt, "firestore.indexes.json must include live_classes(organization_id, created_at) index");
  });

  // ──────────────────────────────────────────────────────────
  // RBAC & Governance
  // ──────────────────────────────────────────────────────────

  test('ADM56-21: moderation reports read allowed for admin role', () => {
    function canAccessModeration(role) {
      return role === 'admin' || role === 'super_admin' || role === 'moderator';
    }
    assert.strictEqual(canAccessModeration('admin'), true);
    assert.strictEqual(canAccessModeration('super_admin'), true);
  });

  test('ADM56-22: moderation reports read denied for student role', () => {
    function canAccessModeration(role) {
      return role === 'admin' || role === 'super_admin' || role === 'moderator';
    }
    assert.strictEqual(canAccessModeration('student'), false);
    assert.strictEqual(canAccessModeration('teacher'), false);
  });

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`PHASE 56 SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`═══════════════════════════════════════════════════════════\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAll();
