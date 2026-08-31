#!/usr/bin/env node
/**
 * MSDL Curriculum Reset Script
 *
 * Deletes ALL documents from curriculum collections only.
 * Does NOT touch user data, chats, notifications, payments, etc.
 *
 * Modes:
 *   --audit     Count docs in each curriculum collection (NO deletes)
 *   --dry-run   Show what WOULD be deleted (NO deletes) [DEFAULT]
 *   --execute   Actually delete (requires --confirm)
 *
 * Usage:
 *   node reset_curriculum.js --audit
 *   node reset_curriculum.js --dry-run
 *   node reset_curriculum.js --execute --confirm
 *
 * Prerequisites:
 *   1. npm install firebase-admin
 *   2. Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json here
 *
 * BACKUP FIRST:
 *   gcloud firestore export gs://madrasa-app-50d6c-backups/pre-curriculum-reset-YYYYMMDD
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────

const PROJECT_ID = 'madrasa-app-50d6c';

const CURRICULUM_COLLECTIONS = [
  'categories',
  'courses',
  'library',
  'quizzes',
  'teachers',
  'modules',
  'lessons',
  'assignments',
  'audio_lessons',
];

// These are explicitly NOT touched
const PRESERVED_COLLECTIONS = [
  'app_settings',
  'users',
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

// ─── Audit ───────────────────────────────────────────────────────────────────

async function runAudit() {
  console.log('\n  CURRICULUM DATA AUDIT');
  console.log('='.repeat(60));

  console.log('\n-- Curriculum Collections (will be deleted) --\n');
  console.log(pad('Collection', 30) + pad('Count', 10) + 'Action');
  console.log('-'.repeat(60));

  let totalDocs = 0;
  for (const col of CURRICULUM_COLLECTIONS) {
    const count = await countCollection(col);
    totalDocs += count;
    console.log(pad(col, 30) + pad(String(count), 10) + 'DELETE ALL');
  }
  console.log('-'.repeat(60));
  console.log(pad('TOTAL', 30) + pad(String(totalDocs), 10));

  console.log('\n-- Preserved Collections (will NOT be touched) --\n');
  console.log(pad('Collection', 30) + pad('Count', 10) + 'Action');
  console.log('-'.repeat(60));

  for (const col of PRESERVED_COLLECTIONS) {
    const count = await countCollection(col);
    console.log(pad(col, 30) + pad(String(count), 10) + 'KEEP');
  }

  console.log('\n' + '='.repeat(60));
  console.log('Audit complete. Run with --dry-run to see deletion plan.\n');
}

// ─── Dry Run / Execute ───────────────────────────────────────────────────────

async function runReset(dryRun) {
  const label = dryRun ? 'DRY RUN' : 'LIVE EXECUTION';
  console.log(`\n  ${label} — Curriculum Data Reset`);
  console.log('='.repeat(60));

  if (!dryRun) {
    console.log('\n  WARNING: THIS WILL PERMANENTLY DELETE ALL CURRICULUM DATA');
    console.log('  Collections: ' + CURRICULUM_COLLECTIONS.join(', '));
    console.log('  Waiting 10 seconds...\n');
    await new Promise(r => setTimeout(r, 10000));
  }

  let totalDocs = 0;

  for (const col of CURRICULUM_COLLECTIONS) {
    const count = await countCollection(col);
    if (count === 0) {
      console.log(`  [SKIP] ${pad(col, 28)} 0 docs`);
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY]  ${pad(col, 28)} ${count} docs would be deleted`);
      totalDocs += count;
    } else {
      process.stdout.write(`  Deleting ${pad(col + '...', 28)} `);
      const deleted = await deleteCollectionBatched(col);
      console.log(`${deleted} docs deleted`);
      totalDocs += deleted;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n  ${label} SUMMARY:`);
  console.log(`  Collections affected: ${CURRICULUM_COLLECTIONS.length}`);
  console.log(`  Documents ${dryRun ? 'to delete' : 'deleted'}:  ${totalDocs}`);
  console.log(`  app_settings:         untouched`);
  console.log(`  users:                untouched`);
  console.log(`  Firebase Auth:        untouched`);

  if (dryRun) {
    console.log('\n  To execute: node reset_curriculum.js --execute --confirm\n');
  } else {
    console.log('\n  Curriculum reset complete. You can now re-upload fresh content.\n');
  }
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
      console.error('Usage: node reset_curriculum.js --execute --confirm');
      process.exit(1);
    }
    await runReset(false);
  } else {
    await runReset(true);
  }
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
