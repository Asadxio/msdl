import { writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/context/AuthContext';
import { createAdminLog } from '@/lib/adminLogs';

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
