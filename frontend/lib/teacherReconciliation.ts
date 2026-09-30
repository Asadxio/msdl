/**
 * teacherReconciliation.ts
 *
 * Admin-triggered utility to detect and reconcile legacy teacher documents
 * that pre-date the canonical uid-as-docId identity architecture.
 *
 * SAFETY RULES:
 *   - Never deletes any document automatically.
 *   - Never guesses identity based on name alone.
 *   - Matches by strongest available identifier:
 *       1. Exact email match from users collection → confirmed UID
 *       2. user_uid field present → directly linkable
 *       3. Name similarity only → reported as CANDIDATE (not migrated)
 *   - Unmatched records remain untouched; reported for manual review.
 *   - Migration is idempotent: running twice produces the same result.
 *   - Marks migrated docs with _migrated: true so they are never re-processed.
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type LegacyDocStatus =
  | 'canonical'          // Document ID == user UID — already correct
  | 'linked_by_uid'      // user_uid field found — can link deterministically
  | 'linked_by_email'    // email matched a users document → UID resolved
  | 'name_candidate'     // Name-only similarity — NOT migrated, reported only
  | 'unmatched';         // No match found — reported for manual review

export interface LegacyDocReport {
  docId: string;
  status: LegacyDocStatus;
  matchedUid?: string;
  matchedEmail?: string;
  candidateName?: string;
  action: 'skipped' | 'merged' | 'pending_manual_review';
  error?: string;
  data: Record<string, any>;
}

export interface ReconciliationReport {
  scannedCount: number;
  canonicalCount: number;
  mergedCount: number;
  candidateCount: number;
  unmatchedCount: number;
  errorCount: number;
  records: LegacyDocReport[];
  generatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely merges legacy profile data into a canonical teachers/{uid} document.
 *
 * Rules:
 *   - Never overwrites non-empty canonical fields with empty legacy values.
 *   - Always preserves assigned_courses and qualifications from canonical doc.
 *   - Marks the legacy doc as _migrated = true when done.
 */
async function mergeLegacyIntoCanonical(
  legacyDocId: string,
  canonicalUid: string,
  legacyData: Record<string, any>,
): Promise<void> {
  const canonicalRef = doc(db, 'teachers', canonicalUid);
  const canonicalSnap = await getDoc(canonicalRef);

  const canonical = canonicalSnap.exists() ? canonicalSnap.data() : {};

  // Build merged data: prefer canonical values; fill gaps from legacy
  const merged: Record<string, any> = {
    id: canonicalUid,
    user_uid: canonicalUid,
  };

  const textFields = [
    'name', 'title', 'email', 'phone', 'bio', 'photo_url',
    'islamic_qualification', 'experience_years',
    'teacher_id', 'organization_id', 'status',
  ];
  for (const f of textFields) {
    const canonicalVal = canonical[f];
    const legacyVal = legacyData[f];
    // Use canonical if set; fall back to legacy if canonical is empty
    if (canonicalVal && String(canonicalVal).trim()) {
      merged[f] = canonicalVal;
    } else if (legacyVal && String(legacyVal).trim()) {
      merged[f] = legacyVal;
    }
  }

  const listFields = ['qualifications', 'specializations', 'languages', 'courses', 'assigned_courses'];
  for (const f of listFields) {
    const canonicalList = Array.isArray(canonical[f]) ? canonical[f] : [];
    const legacyList = Array.isArray(legacyData[f]) ? legacyData[f] : [];
    // Merge both lists, deduplicate
    const combined = Array.from(new Set([...canonicalList, ...legacyList]));
    if (combined.length > 0) merged[f] = combined;
  }

  // verification_status: prefer canonical if already verified; never auto-verify
  if (canonical.verification_status === 'verified') {
    merged.verification_status = 'verified';
  } else {
    // Legacy docs may have 'approved' — normalise to 'pending' on reconcile
    merged.verification_status = 'pending';
  }

  merged.updated_at = serverTimestamp();
  if (!canonical.created_at) {
    merged.created_at = legacyData.created_at || serverTimestamp();
  }

  // Write canonical document (merge: true preserves any fields not in merged)
  await setDoc(canonicalRef, merged, { merge: true });

  // Mark the legacy document as migrated (do NOT delete)
  const legacyRef = doc(db, 'teachers', legacyDocId);
  await updateDoc(legacyRef, {
    _migrated: true,
    _migrated_to: canonicalUid,
    _migrated_at: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main reconciliation function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scans the teachers collection for legacy documents and produces a report.
 *
 * Pass dryRun = true to get the report without performing any writes.
 * Pass dryRun = false to actually merge matched documents.
 *
 * @param dryRun - If true, report only (no Firestore writes). Default: true (safe).
 */
export async function reconcileLegacyTeacherDocs(
  dryRun: boolean = true,
): Promise<ReconciliationReport> {
  const report: ReconciliationReport = {
    scannedCount: 0,
    canonicalCount: 0,
    mergedCount: 0,
    candidateCount: 0,
    unmatchedCount: 0,
    errorCount: 0,
    records: [],
    generatedAt: new Date().toISOString(),
  };

  // Load all teachers documents
  const teachersSnap = await getDocs(collection(db, 'teachers'));
  // Load all users for email matching
  const usersSnap = await getDocs(collection(db, 'users'));

  // Build lookup maps
  const usersByUid: Record<string, Record<string, any>> = {};
  const usersByEmail: Record<string, { uid: string; data: Record<string, any> }> = {};

  for (const u of usersSnap.docs) {
    usersByUid[u.id] = u.data();
    const email = (u.data().email || '').toLowerCase().trim();
    if (email) {
      usersByEmail[email] = { uid: u.id, data: u.data() };
    }
  }

  report.scannedCount = teachersSnap.docs.length;

  for (const teacherDoc of teachersSnap.docs) {
    const docId = teacherDoc.id;
    const data = teacherDoc.data();

    // Skip already-migrated legacy docs
    if (data._migrated) {
      report.records.push({
        docId,
        status: 'canonical',
        action: 'skipped',
        data,
      });
      report.canonicalCount++;
      continue;
    }

    // ── Case 1: Document ID == user UID (already canonical) ──────────────────
    if (usersByUid[docId]) {
      report.canonicalCount++;
      report.records.push({
        docId,
        status: 'canonical',
        action: 'skipped',
        data,
      });
      continue;
    }

    // ── Case 2: user_uid field present → directly linkable ───────────────────
    const uidField = data.user_uid;
    if (uidField && typeof uidField === 'string' && usersByUid[uidField]) {
      const entry: LegacyDocReport = {
        docId,
        status: 'linked_by_uid',
        matchedUid: uidField,
        action: 'merged',
        data,
      };
      if (!dryRun) {
        try {
          await mergeLegacyIntoCanonical(docId, uidField, data);
        } catch (err: any) {
          entry.action = 'pending_manual_review';
          entry.error = err?.message || 'Merge failed';
          report.errorCount++;
        }
      }
      if (entry.action === 'merged') report.mergedCount++;
      report.records.push(entry);
      continue;
    }

    // ── Case 3: Email match → resolve UID ────────────────────────────────────
    const emailField = (data.email || '').toLowerCase().trim();
    if (emailField && usersByEmail[emailField]) {
      const resolvedUid = usersByEmail[emailField].uid;
      const entry: LegacyDocReport = {
        docId,
        status: 'linked_by_email',
        matchedUid: resolvedUid,
        matchedEmail: emailField,
        action: 'merged',
        data,
      };
      if (!dryRun) {
        try {
          await mergeLegacyIntoCanonical(docId, resolvedUid, data);
        } catch (err: any) {
          entry.action = 'pending_manual_review';
          entry.error = err?.message || 'Merge failed';
          report.errorCount++;
        }
      }
      if (entry.action === 'merged') report.mergedCount++;
      report.records.push(entry);
      continue;
    }

    // ── Case 4: Name only — DO NOT migrate, report as candidate ──────────────
    if (data.name && typeof data.name === 'string') {
      report.candidateCount++;
      report.records.push({
        docId,
        status: 'name_candidate',
        candidateName: data.name,
        action: 'pending_manual_review',
        data,
      });
      continue;
    }

    // ── Case 5: Completely unmatched ──────────────────────────────────────────
    report.unmatchedCount++;
    report.records.push({
      docId,
      status: 'unmatched',
      action: 'pending_manual_review',
      data,
    });
  }

  return report;
}

/**
 * Quick summary of legacy teacher document state.
 * Useful for Admin dashboard display before running full reconciliation.
 */
export async function getLegacyTeacherDocSummary(): Promise<{
  total: number;
  canonical: number;
  legacyCount: number;
}> {
  const usersSnap = await getDocs(collection(db, 'users'));
  const canonicalUids = new Set(usersSnap.docs.map((d) => d.id));

  const teachersSnap = await getDocs(collection(db, 'teachers'));
  let canonical = 0;
  let legacy = 0;

  for (const t of teachersSnap.docs) {
    if (t.data()._migrated) continue;
    if (canonicalUids.has(t.id)) canonical++;
    else legacy++;
  }

  return { total: teachersSnap.size, canonical, legacyCount: legacy };
}
