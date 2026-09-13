/**
 * MSLB Phase 57 — Deterministic Class Recordings Migration Script
 * 
 * Reconciles legacy recordings with their authoritative tenant boundary.
 * 
 * INVARIANTS:
 * 1. An existing recording missing `organization_id` must be resolved via its `course_id`.
 * 2. If `course_id` exists:
 *      - Fetch `courses/{course_id}`.
 *      - If course doc exists:
 *          authoritativeOrgId = course.organization_id || 'mslb-main'
 *          Stamp: organization_id = authoritativeOrgId, migration_status = 'migrated', migrated_at_ms = timestamp
 *      - If course doc does NOT exist:
 *          DO NOT GUESS! DO NOT default to mslb-main!
 *          Stamp: status = 'MIGRATION_REVIEW', migration_status = 'review_required',
 *                 migration_review_reason = 'Course document not found: ' + course_id
 * 3. If recording has NO `course_id` (or empty):
 *      - DO NOT GUESS!
 *      - Stamp: status = 'MIGRATION_REVIEW', migration_status = 'review_required',
 *               migration_review_reason = 'Missing or empty course_id'
 * 4. Dry-run mode (`--dry-run` or `options.dryRun === true`):
 *      - Performs all lookups and plan generation.
 *      - Writes ZERO mutations to Firestore.
 *      - Returns detailed planned actions.
 * 5. Idempotent:
 *      - Recordings that already have valid `organization_id` and are not flagged for review are skipped.
 */

const admin = require('firebase-admin');

/**
 * Executes migration logic against a Firestore database instance.
 * @param {FirebaseFirestore.Firestore} db 
 * @param {Object} [options]
 * @param {boolean} [options.dryRun=false]
 * @param {boolean} [options.force=false] - If true, re-evaluates all recordings
 * @returns {Promise<{total: number, migrated: number, reviewRequired: number, unchanged: number, errors: Array<{id: string, error: string}>, details: Array<any>}>}
 */
async function migrateRecordings(db, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const force = Boolean(options.force);

  const report = {
    total: 0,
    migrated: 0,
    reviewRequired: 0,
    unchanged: 0,
    errors: [],
    details: [],
  };

  const recordingsSnap = await db.collection('recordings').get();
  report.total = recordingsSnap.size;

  const coursesCache = new Map();

  async function getCourse(courseId) {
    if (!courseId) return null;
    if (coursesCache.has(courseId)) {
      return coursesCache.get(courseId);
    }
    try {
      const courseSnap = await db.collection('courses').doc(courseId).get();
      const courseData = courseSnap.exists ? courseSnap.data() : null;
      coursesCache.set(courseId, courseData);
      return courseData;
    } catch (err) {
      return null;
    }
  }

  for (const doc of recordingsSnap.docs) {
    const data = doc.data();
    const id = doc.id;

    // Check if migration is required
    const hasOrgId = typeof data.organization_id === 'string' && data.organization_id.trim().length > 0;
    const isAlreadyMigrated = data.migration_status === 'migrated';

    if (hasOrgId && isAlreadyMigrated && !force) {
      report.unchanged++;
      continue;
    }

    const courseId = data.course_id;

    if (!courseId || typeof courseId !== 'string' || courseId.trim() === '') {
      // Unresolvable: Missing course_id -> Flag for MIGRATION_REVIEW
      const action = {
        id,
        action: 'FLAG_REVIEW',
        reason: 'Missing or empty course_id',
        fields: {
          status: 'MIGRATION_REVIEW',
          migration_status: 'review_required',
          migration_review_reason: 'Missing or empty course_id',
          reviewed_at_ms: Date.now(),
        },
      };
      report.details.push(action);
      report.reviewRequired++;

      if (!dryRun) {
        try {
          await doc.ref.update(action.fields);
        } catch (err) {
          report.errors.push({ id, error: err.message });
        }
      }
      continue;
    }

    const course = await getCourse(courseId.trim());

    if (!course) {
      // Unresolvable: Course does not exist in DB -> Flag for MIGRATION_REVIEW without guessing!
      const action = {
        id,
        action: 'FLAG_REVIEW',
        reason: `Course doc "${courseId}" not found in database`,
        fields: {
          status: 'MIGRATION_REVIEW',
          migration_status: 'review_required',
          migration_review_reason: `Course doc "${courseId}" not found in database`,
          reviewed_at_ms: Date.now(),
        },
      };
      report.details.push(action);
      report.reviewRequired++;

      if (!dryRun) {
        try {
          await doc.ref.update(action.fields);
        } catch (err) {
          report.errors.push({ id, error: err.message });
        }
      }
      continue;
    }

    // Resolvable: Course exists. Authoritative tenant is course.organization_id || 'mslb-main'
    const authoritativeOrgId = (course.organization_id && typeof course.organization_id === 'string' && course.organization_id.trim())
      ? course.organization_id.trim()
      : 'mslb-main';

    const action = {
      id,
      action: 'MIGRATE',
      resolvedOrgId: authoritativeOrgId,
      courseId,
      fields: {
        organization_id: authoritativeOrgId,
        migration_status: 'migrated',
        migrated_at_ms: Date.now(),
      },
    };
    report.details.push(action);
    report.migrated++;

    if (!dryRun) {
      try {
        await doc.ref.update(action.fields);
      } catch (err) {
        report.errors.push({ id, error: err.message });
      }
    }
  }

  return report;
}

// CLI execution handler
if (require.main === module) {
  (async () => {
    try {
      if (!admin.apps.length) {
        admin.initializeApp();
      }
      const db = admin.firestore();
      const dryRun = process.argv.includes('--dry-run');
      const force = process.argv.includes('--force');

      console.log('====================================================');
      console.log(` MSLB Phase 57 — Class Recordings Migration (${dryRun ? 'DRY RUN' : 'EXECUTE'})`);
      console.log('====================================================');

      const report = await migrateRecordings(db, { dryRun, force });

      console.log(`Total scanned:     ${report.total}`);
      console.log(`Migrated:          ${report.migrated}`);
      console.log(`Review Required:   ${report.reviewRequired}`);
      console.log(`Unchanged:         ${report.unchanged}`);
      console.log(`Errors:            ${report.errors.length}`);
      console.log('====================================================');

      if (report.details.length > 0) {
        console.log('Sample actions:');
        report.details.slice(0, 10).forEach(d => {
          console.log(` [${d.action}] ${d.id}: ${d.reason || d.resolvedOrgId}`);
        });
      }

      process.exit(report.errors.length > 0 ? 1 : 0);
    } catch (err) {
      console.error('Fatal migration failure:', err);
      process.exit(1);
    }
  })();
}

module.exports = {
  migrateRecordings,
};
