#!/usr/bin/env node
/**
 * MSDL Production Data Reset Script
 *
 * Modes:
 *   --audit     Count docs in every collection, list Auth users (NO deletes)
 *   --dry-run   Show exactly what WOULD be deleted (NO deletes) [DEFAULT]
 *   --execute   Actually delete data (DANGEROUS — requires --confirm flag)
 *
 * Usage:
 *   node reset_production.js --audit
 *   node reset_production.js --dry-run
 *   node reset_production.js --execute --confirm
 *
 * Prerequisites:
 *   1. npm install firebase-admin
 *   2. Set GOOGLE_APPLICATION_CREDENTIALS to your service account key JSON
 *      OR place serviceAccountKey.json in this directory
 *
 * BACKUP FIRST:
 *   gcloud firestore export gs://madrasa-app-50d6c-backups/pre-reset-YYYYMMDD
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────

const PROJECT_ID = 'madrasa-app-50d6c';

const PRESERVED_EMAILS = [
  'sumraftm@gmail.com',
  'xioasad@gmail.com',
];

// Collections containing curriculum / config data — KEEP all docs
const KEEP_COLLECTIONS = [
  'app_settings',
  'categories',
  'courses',
  'teachers',
  'library',
  'modules',
  'lessons',
  'assignments',
  'quizzes',
  'audio_lessons',
];

// Collections containing user-generated / transient data — DELETE ALL DOCS
const DELETE_COLLECTIONS = [
  'chats',
  'messages',
  'chat_messages',
  'notifications',
  'attendance',
  'enrollments',
  'quiz_results',
  'certificates',
  'feedback',
  'payments',
  'payment_gateway_events',
  'payment_processor_audit_logs',
  'payment_verification_queue',
  'status_updates',
  'status_reports',
  'calls',
  'recordings',
  'live_classes',
  'submissions',
  'lesson_progress',
  'learning_state',
  'legal_audit_events',
  'privacy_requests',
  'message_reports',
  'moderation_reports',
  'moderation_evidence',
  'moderation_actions',
  'moderation_analytics_daily',
  'security_events_immutable',
  'user_notification_settings',
  'public_profiles',
];

// Collections where we selectively delete (non-admin user docs only)
const SELECTIVE_DELETE_COLLECTIONS = [
  'users',
];

// Backend-only collections (may or may not exist) — DELETE ALL
const BACKEND_ONLY_DELETE = [
  'ai_metrics',
  'analytics_alerts',
  'analytics_daily_summary',
  'analytics_dashboards',
  'analytics_error_events',
  'async_jobs',
  'background_jobs',
  'dead_letter_jobs',
  'job_execution_metrics',
  'media_uploads',
  'moderation_aggregates',
  'moderation_logs',
  'notification_delivery_logs',
  'notification_dispatch_deadletter',
  'notification_dispatch_queue',
  'notification_idempotency_keys',
  'notification_provider_receipts',
  'notification_queue_health',
  'notification_routing_control',
  'notification_routing_experiments',
  'notification_token_registry',
  'notification_worker_leases',
  'operation_dedupe',
  'operational_diagnostics',
  'payment_audit_logs',
  'provider_circuit_breakers',
  'push_dedupe',
  'quiz_attempt_locks',
  'reactions',
  'scheduler_leases',
  'security_audit_logs',
  'status_rate_limits',
  'subscriptions',
  'token_issues',
  'worker_metrics',
  'admin_logs',
  'role_transition_audit_logs',
];

// ─── Init ────────────────────────────────────────────────────────────────────

function initFirebase() {
  try {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
      || path.join(__dirname, 'serviceAccountKey.json');
    const serviceAccount = require(serviceAccountPath);
    initializeApp({
      credential: cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  } catch (e) {
    console.error('Failed to initialize Firebase Admin SDK.');
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json here.');
    console.error('Error:', e.message);
    process.exit(1);
  }
}

const db = () => getFirestore();
const authSvc = () => getAuth();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(str, len) {
  return String(str).padEnd(len);
}

async function countCollection(name) {
  try {
    const snap = await db().collection(name).count().get();
    return snap.data().count;
  } catch {
    return 0;
  }
}

async function deleteSubcollection(collRef) {
  while (true) {
    const snap = await collRef.limit(400).get();
    if (snap.empty) break;
    const batch = db().batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

async function deleteCollectionBatched(name) {
  const collRef = db().collection(name);
  let total = 0;
  while (true) {
    const snap = await collRef.limit(400).get();
    if (snap.empty) break;
    // Delete subcollections of each doc first
    for (const d of snap.docs) {
      const subs = await d.ref.listCollections();
      for (const sub of subs) await deleteSubcollection(sub);
    }
    const batch = db().batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
  }
  return total;
}

async function getPreservedUids() {
  const result = [];
  for (const email of PRESERVED_EMAILS) {
    try {
      const user = await authSvc().getUserByEmail(email);
      result.push({ uid: user.uid, email: user.email, emailVerified: user.emailVerified });
    } catch (e) {
      console.warn(`  WARNING: preserved user not found: ${email} — ${e.message}`);
    }
  }
  return result;
}

async function listAllAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const res = await authSvc().listUsers(1000, pageToken);
    users.push(...res.users.map(u => ({
      uid: u.uid,
      email: u.email || '(no email)',
      emailVerified: u.emailVerified,
      creationTime: u.metadata.creationTime,
    })));
    pageToken = res.pageToken;
  } while (pageToken);
  return users;
}

// ─── Audit ───────────────────────────────────────────────────────────────────

async function runAudit() {
  console.log('\n  PRODUCTION DATA AUDIT');
  console.log('='.repeat(72));

  const allCols = [...new Set([
    ...KEEP_COLLECTIONS,
    ...DELETE_COLLECTIONS,
    ...SELECTIVE_DELETE_COLLECTIONS,
    ...BACKEND_ONLY_DELETE,
  ])].sort();

  console.log('\n-- Firestore Collections --\n');
  console.log(pad('Collection', 48) + pad('Count', 8) + 'Action');
  console.log('-'.repeat(72));

  for (const col of allCols) {
    const count = await countCollection(col);
    if (count === 0) continue;
    let action = '?';
    if (KEEP_COLLECTIONS.includes(col)) action = 'KEEP';
    else if (DELETE_COLLECTIONS.includes(col)) action = 'DELETE ALL';
    else if (SELECTIVE_DELETE_COLLECTIONS.includes(col)) action = 'SELECTIVE';
    else if (BACKEND_ONLY_DELETE.includes(col)) action = 'DELETE ALL';
    console.log(pad(col, 48) + pad(String(count), 8) + action);
  }

  console.log('\n-- Firebase Auth Users --\n');
  const allUsers = await listAllAuthUsers();
  const preserved = await getPreservedUids();
  const preservedSet = new Set(preserved.map(u => u.uid));

  console.log(`Total Auth users: ${allUsers.length}\n`);
  console.log(pad('Email', 36) + pad('UID', 30) + pad('Verified', 10) + 'Action');
  console.log('-'.repeat(86));

  for (const u of allUsers) {
    const keep = preservedSet.has(u.uid);
    console.log(pad(u.email, 36) + pad(u.uid, 30) + pad(String(u.emailVerified), 10) + (keep ? 'KEEP' : 'DELETE'));
  }

  console.log('\n-- Preserved User Verification --\n');
  for (const p of preserved) {
    const doc = await db().collection('users').doc(p.uid).get();
    if (!doc.exists) {
      console.log(`  MISSING: ${p.email} — no Firestore user document`);
      continue;
    }
    const d = doc.data();
    const roleOk = ['admin', 'super_admin'].includes(d.role);
    const statusOk = d.status === 'approved';
    console.log(`  ${roleOk && statusOk ? 'OK' : 'WARN'} ${p.email}`);
    console.log(`     UID:            ${p.uid}`);
    console.log(`     emailVerified:  ${p.emailVerified}`);
    console.log(`     role:           ${d.role} ${roleOk ? '' : '<-- NEEDS FIX'}`);
    console.log(`     status:         ${d.status} ${statusOk ? '' : '<-- NEEDS FIX'}`);
    console.log();
  }

  console.log('='.repeat(72));
  console.log('Audit complete. Run with --dry-run to see the deletion plan.\n');
}

// ─── Dry Run / Execute ───────────────────────────────────────────────────────

async function runReset(dryRun) {
  const label = dryRun ? 'DRY RUN' : 'LIVE EXECUTION';
  console.log(`\n  ${label} — Production Data Reset`);
  console.log('='.repeat(72));

  if (!dryRun) {
    console.log('\n  WARNING: THIS WILL PERMANENTLY DELETE DATA');
    console.log('  Waiting 10 seconds...\n');
    await new Promise(r => setTimeout(r, 10000));
  }

  const preserved = await getPreservedUids();
  const preservedSet = new Set(preserved.map(u => u.uid));

  if (preserved.length !== PRESERVED_EMAILS.length) {
    console.error('Not all preserved users found. Aborting.');
    process.exit(1);
  }
  console.log(`\n  Preserved accounts: ${preserved.map(u => u.email).join(', ')}\n`);

  // Step 1: Full-delete collections
  console.log('-- Step 1: Delete user-generated collections --\n');
  const allDeletes = [...DELETE_COLLECTIONS, ...BACKEND_ONLY_DELETE];
  let totalDocs = 0;

  for (const col of allDeletes) {
    const count = await countCollection(col);
    if (count === 0) continue;
    if (dryRun) {
      console.log(`  [DRY] ${pad(col, 46)} ${count} docs`);
      totalDocs += count;
    } else {
      process.stdout.write(`  Deleting ${col}... `);
      const del = await deleteCollectionBatched(col);
      console.log(`${del} docs deleted`);
      totalDocs += del;
    }
  }

  // Step 2: Selective delete from users
  console.log('\n-- Step 2: Delete non-admin user documents --\n');
  const usersSnap = await db().collection('users').get();
  let usersDel = 0;
  let usersKept = 0;

  for (const doc of usersSnap.docs) {
    if (preservedSet.has(doc.id)) {
      usersKept++;
      console.log(`  [KEEP]   ${doc.id} (${doc.data().email || ''})`);
      continue;
    }
    usersDel++;
    if (dryRun) {
      console.log(`  [DELETE] ${doc.id} (${doc.data().email || ''}) role=${doc.data().role || 'none'}`);
    } else {
      const subs = await doc.ref.listCollections();
      for (const sub of subs) await deleteSubcollection(sub);
      await doc.ref.delete();
    }
  }
  console.log(`\n  Users: ${usersKept} kept, ${usersDel} ${dryRun ? 'would be' : ''} deleted`);

  // Step 3: Delete non-preserved Auth users
  console.log('\n-- Step 3: Delete non-admin Auth accounts --\n');
  const allAuth = await listAllAuthUsers();
  let authDel = 0;
  let authKept = 0;

  for (const u of allAuth) {
    if (preservedSet.has(u.uid)) { authKept++; continue; }
    authDel++;
    if (dryRun) {
      console.log(`  [DELETE AUTH] ${u.email} (${u.uid})`);
    } else {
      await authSvc().deleteUser(u.uid);
    }
  }
  console.log(`\n  Auth: ${authKept} kept, ${authDel} ${dryRun ? 'would be' : ''} deleted`);

  // Step 4: Recreate public_profiles for preserved users
  if (!dryRun) {
    console.log('\n-- Step 4: Recreate public_profiles --\n');
    for (const p of preserved) {
      const userDoc = await db().collection('users').doc(p.uid).get();
      if (userDoc.exists) {
        const d = userDoc.data();
        await db().collection('public_profiles').doc(p.uid).set({
          name: d.name || '', role: d.role || 'admin', photo_url: d.photo_url || '',
        }, { merge: true });
        console.log(`  Recreated public_profile for ${p.email}`);
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(72));
  console.log(`\n  ${label} SUMMARY:`);
  console.log(`  Docs ${dryRun ? 'to delete' : 'deleted'}:      ${totalDocs + usersDel}`);
  console.log(`  Auth ${dryRun ? 'to delete' : 'deleted'}:      ${authDel}`);
  console.log(`  Preserved accounts:   ${authKept}`);
  console.log(`  Curriculum (kept):    ${KEEP_COLLECTIONS.length} collections untouched`);
  if (dryRun) console.log('\n  To execute: node reset_production.js --execute --confirm\n');
  else console.log('\n  Reset complete.\n');
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--audit') ? 'audit'
    : args.includes('--execute') ? 'execute' : 'dry-run';

  initFirebase();

  if (mode === 'audit') {
    await runAudit();
  } else if (mode === 'execute') {
    if (!args.includes('--confirm')) {
      console.error('Live execution requires --confirm flag.');
      console.error('Usage: node reset_production.js --execute --confirm');
      process.exit(1);
    }
    await runReset(false);
  } else {
    await runReset(true);
  }
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
