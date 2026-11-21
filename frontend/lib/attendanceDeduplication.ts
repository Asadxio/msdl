/**
 * frontend/lib/attendanceDeduplication.ts
 *
 * MSLB Phase 2 P0 Remediation: Read-Time Attendance Deduplication Engine
 *
 * Resolves legacy duplicate attendance records on read without mutating
 * or deleting historical Firestore documents.
 *
 * Deduplication Key:
 *   ${userId}_${date}_${courseId || 'general'}
 *
 * Reconciliation Rules:
 *   1. Identical Status:
 *      - Prefers canonical deterministic ID (`att_{userId}_{date}_{courseId}`).
 *      - If neither or both are canonical, prefers later timestamp (`updated_at` > `marked_at` > `created_at`).
 *      - Merges complementary metadata (e.g. user_name, live_class_id) if missing from winner.
 *      - Sets `hasConflict: false`, `conflict: false`.
 *   2. Conflicting Status (e.g. 'present' vs 'absent'):
 *      - If timestamps differ, the record with the most recent timestamp wins (`resolvedConflict: true`).
 *      - If timestamps are equal, 0, or missing, sets `hasConflict: true`, `conflict: true`
 *        so the UI can flag the conflict rather than silently guessing.
 */

import { isDeterministicAttendanceDocId } from './attendanceId';

export interface ConflictAuditRecord {
  resolvedStatus: string;
  conflictingStatuses: string[];
  supersededRecords: Array<{
    id: string;
    status: string;
    marked_by?: string;
    marked_by_name?: string;
    timestamp: number;
  }>;
}

export interface DeduplicableAttendanceRecord {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  date: string;
  status: 'present' | 'absent' | string;
  marked_by?: string;
  marked_by_uid?: string;
  marked_by_name?: string;
  course_id?: string;
  live_class_id?: string;
  duration_seconds?: number;
  created_at?: any;
  marked_at?: any;
  updated_at?: any;
  hasConflict?: boolean;
  conflict?: boolean;
  conflictReason?: string;
  conflictingStatuses?: string[];
  resolvedConflict?: boolean;
  conflictAudit?: ConflictAuditRecord;
  [key: string]: any;
}

/**
 * Extracts epoch milliseconds from various timestamp representations:
 * Firestore Timestamp ({ toMillis, toDate, seconds }), JS Date, number, or ISO string.
 */
export function extractMillis(value: any): number {
  if (value === null || value === undefined) return 0;
  try {
    if (typeof value === 'number') {
      return isFinite(value) && value > 0 ? value : 0;
    }
    if (value instanceof Date) {
      const ms = value.getTime();
      return isNaN(ms) ? 0 : ms;
    }
    if (typeof value.toMillis === 'function') {
      const ms = value.toMillis();
      return typeof ms === 'number' && !isNaN(ms) ? ms : 0;
    }
    if (typeof value.toDate === 'function') {
      const dt = value.toDate();
      return dt instanceof Date && !isNaN(dt.getTime()) ? dt.getTime() : 0;
    }
    if (typeof value.seconds === 'number') {
      const ms = value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
      return isNaN(ms) ? 0 : ms;
    }
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Returns the effective revision timestamp for an attendance record.
 * Hierarchy: updated_at > marked_at > created_at.
 */
export function getRecordTimestampMillis(record: DeduplicableAttendanceRecord): number {
  const updatedMs = extractMillis(record.updated_at);
  if (updatedMs > 0) return updatedMs;

  const markedMs = extractMillis(record.marked_at);
  if (markedMs > 0) return markedMs;

  const createdMs = extractMillis(record.created_at);
  if (createdMs > 0) return createdMs;

  return 0;
}

/**
 * Constructs the canonical composite grouping key for an attendance record:
 * ${userId}_${date}_${courseId || 'general'}
 */
export function getAttendanceCompositeKey(record: DeduplicableAttendanceRecord): string {
  const uid = String(record.user_id ?? '').trim();
  const date = String(record.date ?? '').trim();
  const rawCourse = String(record.course_id ?? '').trim();
  const courseId = rawCourse || 'general';

  if (!uid && !date) {
    return `raw_${record.id || Math.random().toString(36).slice(2)}`;
  }
  return `${uid}_${date}_${courseId}`;
}

/**
 * Reconciles a cluster of records having the exact same composite key.
 */
function reconcileCluster<T extends DeduplicableAttendanceRecord>(cluster: T[]): T {
  if (cluster.length === 1) {
    const single = cluster[0];
    return {
      ...single,
      hasConflict: Boolean(single.hasConflict),
      conflict: Boolean(single.conflict),
    };
  }

  const distinctStatuses = Array.from(
    new Set(cluster.map((r) => String(r.status ?? '').toLowerCase().trim()).filter(Boolean))
  );

  const hasStatusConflict = distinctStatuses.length > 1;

  if (!hasStatusConflict) {
    // ── Matching Statuses: Pick canonical deterministic ID or latest timestamp ──
    const sorted = [...cluster].sort((a, b) => {
      const aDet = isDeterministicAttendanceDocId(a.id) ? 1 : 0;
      const bDet = isDeterministicAttendanceDocId(b.id) ? 1 : 0;
      if (aDet !== bDet) return bDet - aDet;

      const aTime = getRecordTimestampMillis(a);
      const bTime = getRecordTimestampMillis(b);
      if (aTime !== bTime) return bTime - aTime;

      return String(b.id || '').localeCompare(String(a.id || ''));
    });

    const winner = { ...sorted[0] };

    // Complement missing fields from other records in the cluster
    for (const other of cluster) {
      if (!winner.user_name && other.user_name) winner.user_name = other.user_name;
      if (!winner.user_email && other.user_email) winner.user_email = other.user_email;
      if (!winner.marked_by_name && other.marked_by_name) winner.marked_by_name = other.marked_by_name;
      if (!winner.live_class_id && other.live_class_id) winner.live_class_id = other.live_class_id;
      if (!winner.created_at && other.created_at) winner.created_at = other.created_at;
      if (!winner.course_id && other.course_id) winner.course_id = other.course_id;
    }

    winner.hasConflict = false;
    winner.conflict = false;
    return winner;
  }

  // ── Conflicting Statuses (e.g. 'present' vs 'absent') ──
  // Check timestamps across conflicting records
  const times = cluster.map((r) => ({
    record: r,
    time: getRecordTimestampMillis(r),
  }));

  const maxTime = Math.max(...times.map((t) => t.time));
  const topCandidates = times.filter((t) => t.time === maxTime).map((t) => t.record);

  const topStatuses = Array.from(
    new Set(topCandidates.map((r) => String(r.status ?? '').toLowerCase().trim()).filter(Boolean))
  );

  // If top candidate has a positive timestamp and is uncontested at that timestamp
  if (maxTime > 0 && topStatuses.length === 1) {
    // The latest update wins decisively!
    const sortedTop = [...topCandidates].sort((a, b) => {
      const aDet = isDeterministicAttendanceDocId(a.id) ? 1 : 0;
      const bDet = isDeterministicAttendanceDocId(b.id) ? 1 : 0;
      if (aDet !== bDet) return bDet - aDet;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

    const winner = { ...sortedTop[0] };
    for (const other of cluster) {
      if (!winner.user_name && other.user_name) winner.user_name = other.user_name;
      if (!winner.user_email && other.user_email) winner.user_email = other.user_email;
      // Note: Do NOT copy marked_by / marked_by_name from conflicting records
      if (!winner.live_class_id && other.live_class_id) winner.live_class_id = other.live_class_id;
      if (!winner.created_at && other.created_at) winner.created_at = other.created_at;
    }

    winner.hasConflict = false;
    winner.conflict = false;
    winner.resolvedConflict = true;
    winner.conflictAudit = {
      resolvedStatus: String(winner.status ?? ''),
      conflictingStatuses: distinctStatuses,
      supersededRecords: cluster
        .filter((r) => r.id !== winner.id)
        .map((r) => ({
          id: r.id,
          status: String(r.status ?? ''),
          marked_by: r.marked_by,
          marked_by_name: r.marked_by_name,
          timestamp: getRecordTimestampMillis(r),
        })),
    };
    return winner;
  }

  // Unresolvable conflict: timestamps are absent (0) or equal for conflicting statuses
  const sortedFallback = [...cluster].sort((a, b) => {
    const aDet = isDeterministicAttendanceDocId(a.id) ? 1 : 0;
    const bDet = isDeterministicAttendanceDocId(b.id) ? 1 : 0;
    if (aDet !== bDet) return bDet - aDet;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });

  const base = { ...sortedFallback[0] };
  base.hasConflict = true;
  base.conflict = true;
  base.conflictReason = 'Unresolved status conflict between records with identical or missing timestamps.';
  base.conflictingStatuses = distinctStatuses;

  return base;
}

/**
 * Deduplicates an array of attendance records based on composite key:
 * ${userId}_${date}_${courseId || 'general'}
 *
 * Preserves stable order based on first appearance of each composite key.
 */
export function deduplicateAttendanceRecords<T extends DeduplicableAttendanceRecord>(
  records: T[]
): T[] {
  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }
  if (records.length === 1) {
    return [reconcileCluster([records[0]])];
  }

  const clusters = new Map<string, T[]>();
  const keyOrder: string[] = [];

  for (const record of records) {
    if (!record) continue;
    const key = getAttendanceCompositeKey(record);
    const existing = clusters.get(key);
    if (existing) {
      existing.push(record);
    } else {
      clusters.set(key, [record]);
      keyOrder.push(key);
    }
  }

  const deduplicated: T[] = [];
  for (const key of keyOrder) {
    const cluster = clusters.get(key)!;
    deduplicated.push(reconcileCluster(cluster));
  }

  return deduplicated;
}
