import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizeRole } from '@/lib/roles';
import type { UserProfile } from '@/context/AuthContext';
import { MODERATION_ACTIONS, type ModerationAction, type ModerationSeverity, type EvidenceSnapshot } from '@/lib/moderationDomain';

const REPORT_COOLDOWN_MS = 30_000;
const DUP_WINDOW_MS = 5 * 60_000;

export function canModerateTarget(actorRole: string, targetRole: string): boolean {
  const actor = normalizeRole(actorRole, 'moderation.actor');
  const target = normalizeRole(targetRole, 'moderation.target');
  if (actor === 'super_admin') return true;
  if (actor === 'admin') return target !== 'super_admin';
  if (actor === 'moderator') return !['super_admin', 'admin', 'moderator'].includes(target);
  return false;
}

export async function createModerationReport(input: {
  source: 'status_reports' | 'message_reports';
  reporterId: string;
  accusedUserId: string;
  reason: string;
  severity?: ModerationSeverity;
  evidence: EvidenceSnapshot;
}) {
  const recent = await getDocs(query(collection(db, 'moderation_reports'), where('reporter_id', '==', input.reporterId), orderBy('created_at', 'desc'), limit(10))).catch(() => null);
  const now = Date.now();
  if (recent) {
    for (const d of recent.docs) {
      const x = d.data() as any;
      const ts = Number(x.created_at_ms || 0);
      if (now - ts < REPORT_COOLDOWN_MS) throw new Error('report_cooldown');
      if (x.accused_user_id === input.accusedUserId && x.reason === input.reason && now - ts < DUP_WINDOW_MS) throw new Error('duplicate_report');
    }
  }
  const evidenceRef = await addDoc(collection(db, 'moderation_evidence'), { ...input.evidence, source: input.source, created_at: serverTimestamp() });
  return addDoc(collection(db, 'moderation_reports'), {
    reporter_id: input.reporterId,
    accused_user_id: input.accusedUserId,
    reason: input.reason,
    severity: input.severity || 'medium',
    state: 'pending',
    created_at_ms: now,
    created_at: serverTimestamp(),
    evidence_ref: evidenceRef.id,
  });
}

export async function applyModerationDecision(input: {
  actorUid: string;
  actorProfile: UserProfile | null;
  targetUid: string;
  targetRole: string;
  reportId: string;
  action: ModerationAction;
  severity: ModerationSeverity;
  reason: string;
  durationMinutes?: number;
  notes?: string;
  requestId?: string;
}) {
  if (!(MODERATION_ACTIONS as readonly string[]).includes(input.action)) throw new Error('invalid_action');
  const actorRole = normalizeRole(input.actorProfile?.role, 'mod.action.actor');
  if (!canModerateTarget(actorRole, input.targetRole)) throw new Error('insufficient_scope');
  const now = Date.now();
  const duration = Math.max(0, Number(input.durationMinutes || 0));
  const until = duration > 0 ? new Date(now + duration * 60_000) : null;

  await addDoc(collection(db, 'moderation_actions'), {
    actor_uid: input.actorUid,
    actor_role: actorRole,
    target_uid: input.targetUid,
    action: input.action,
    severity: input.severity,
    reason: input.reason,
    duration_minutes: duration,
    timestamps: { created_at_ms: now },
    evidence_ref: input.reportId,
    appeal_ref: '',
    notes: input.notes || '',
    request_id: input.requestId || '',
    created_at: serverTimestamp(),
  });

  await updateDoc(doc(db, 'moderation_reports', input.reportId), {
    state: input.action === 'dismiss_report' ? 'dismissed' : 'actioned',
    moderation_notes: input.notes || '',
    actioned_by: input.actorUid,
    actioned_at: serverTimestamp(),
    actioned_at_ms: now,
  });

  if (['temporary_suspension', 'permanent_suspension', 'mute_user', 'warn_user', 'shadow_restriction'].includes(input.action)) {
    await updateDoc(doc(db, 'users', input.targetUid), {
      moderation_state: input.action,
      suspension_until: until,
      moderated_at: serverTimestamp(),
      moderation_reason: input.reason,
    });
  }
}
