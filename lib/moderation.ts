import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/context/AuthContext';
import { normalizeRole } from '@/lib/roles';

export type ModerationActionType = 'warn_user' | 'mute_user' | 'suspend_user' | 'temporary_ban' | 'permanent_ban' | 'remove_content';

const REPORT_COOLDOWN_MS = 30_000;
const REPORT_DUP_WINDOW_MS = 6 * 60_000;

export async function submitReportSafe(input: {
  collectionName: 'status_reports' | 'message_reports';
  reporterId: string;
  accusedUserId: string;
  targetId: string;
  reason: string;
  evidenceSnapshot?: Record<string, unknown>;
}) {
  const now = Date.now();
  const recent = await getDocs(query(
    collection(db, input.collectionName),
    where('reporter_id', '==', input.reporterId),
    orderBy('created_at', 'desc'),
    limit(10),
  ));
  for (const d of recent.docs) {
    const data = d.data() as any;
    const ts = data.created_at?.toMillis?.() || 0;
    if (now - ts < REPORT_COOLDOWN_MS) throw new Error('report_cooldown');
    if (data.target_id === input.targetId && data.reason === input.reason && now - ts < REPORT_DUP_WINDOW_MS) throw new Error('duplicate_report');
  }

  const base = {
    reporter_id: input.reporterId,
    reason: input.reason,
    created_at: serverTimestamp(),
  } as Record<string, unknown>;
  const payload = input.collectionName === 'status_reports'
    ? { ...base, status_id: input.targetId, owner_id: input.accusedUserId }
    : { ...base, target_user_id: input.accusedUserId, target_message_id: input.targetId };
  return addDoc(collection(db, input.collectionName), payload);
}

export async function applyModerationAction(input: {
  actorProfile: UserProfile | null;
  actorId: string;
  targetUserId: string;
  action: ModerationActionType;
  reason: string;
  evidenceRef: string;
  durationMinutes?: number;
  notes?: string;
}) {
  const actorRole = normalizeRole(input.actorProfile?.role, 'moderation.actor');
  if (!['moderator', 'admin', 'super_admin'].includes(actorRole)) throw new Error('forbidden');
  if (actorRole === 'moderator' && ['permanent_ban', 'suspend_user'].includes(input.action)) throw new Error('escalation_required');

  const durationMinutes = Number(input.durationMinutes || 0);
  const suspendedUntil = durationMinutes > 0 ? new Date(Date.now() + (durationMinutes * 60_000)) : null;

  await addDoc(collection(db, 'moderation_actions'), {
    actor: input.actorId,
    actor_role: actorRole,
    target: input.targetUserId,
    action: input.action,
    reason: input.reason,
    duration_minutes: durationMinutes,
    evidence_ref: input.evidenceRef,
    notes: input.notes || '',
    timestamp: serverTimestamp(),
    suspended_until: suspendedUntil,
    appeal_status: 'open',
  });

  if (['suspend_user', 'temporary_ban', 'permanent_ban', 'mute_user', 'warn_user'].includes(input.action)) {
    await updateDoc(doc(db, 'users', input.targetUserId), {
      moderation_state: input.action,
      moderation_reason: input.reason,
      suspension_until: suspendedUntil,
      moderated_at: serverTimestamp(),
    });
  }
}
