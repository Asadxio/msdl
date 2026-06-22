/* eslint-disable @typescript-eslint/no-unused-vars */
import { addDoc, collection, writeBatch, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/context/AuthContext';
import { createAdminLog } from '@/lib/adminLogs';

import { canAssignRole, normalizeRole } from '@/lib/roles';

export async function updateUserRoleSecure(input: {
  actorProfile: UserProfile | null;
  actorId: string;
  targetUserId: string;
  previousRole: unknown;
  nextRole: unknown;
  reason?: string;
  source?: string;
  requestId?: string;
}) {
  const actorRole = normalizeRole(input.actorProfile?.role, 'adminOps.actor');
  const prevRole = normalizeRole(input.previousRole, 'adminOps.prev');
  const newRole = normalizeRole(input.nextRole, 'adminOps.next');
  if (!canAssignRole(actorRole, newRole, input.targetUserId, input.actorId)) {
    throw new Error('Insufficient permissions to assign this role');
  }
  await updateDoc(doc(db, 'users', input.targetUserId), { role: newRole, updated_at: serverTimestamp() });
  await addDoc(collection(db, 'role_transition_audit_logs'), {
    actor: input.actorId,
    actor_role: actorRole,
    target_user: input.targetUserId,
    previous_role: prevRole,
    new_role: newRole,
    reason: input.reason || '',
    timestamp: serverTimestamp(),
    source: input.source || 'admin.users',
    request_id: input.requestId || '',
  }).catch((err) => {
    console.warn('[adminOps] Role transition audit log write failed:', err);
  });
  return { previousRole: prevRole, newRole };
}


export async function bulkUpdateUserStatus(input: {
  profile: UserProfile | null;
  performedBy: string;
  userIds: string[];
  status: 'approved' | 'rejected' | 'deactivated' | 'pending';
}) {
  const ids = Array.from(new Set((input.userIds || []).filter(Boolean))).slice(0, 100);
  if (!ids.length) return { updated: 0 };
  const batch = writeBatch(db);
  ids.forEach((uid) => {
    batch.update(doc(db, 'users', uid), { status: input.status, updated_at: serverTimestamp() });
  });
  await batch.commit();
  await createAdminLog(input.profile, {
    action: `bulk_user_status_${input.status}`,
    performed_by: input.performedBy,
    target_id: ids.join(','),
    details: `bulk_count=${ids.length}`,
  }).catch(() => {});
  return { updated: ids.length };
}
