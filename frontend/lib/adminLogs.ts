import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/context/AuthContext';
import { normalizeRole } from '@/lib/roles';
import { logFirestoreFailure } from '@/lib/firestoreDebug';

type AdminLogInput = {
  action: string;
  performed_by: string;
  target_id?: string;
  details?: string;
};

export async function createAdminLog(profile: UserProfile | null, input: AdminLogInput): Promise<void> {
  const actorRole = normalizeRole(profile?.role, 'adminLogs.actor');
  if (!['admin', 'super_admin'].includes(actorRole)) return;
  if (!input.action || !input.performed_by) return;

  try {
    await addDoc(collection(db, 'admin_logs'), {
      action: input.action,
      performed_by: input.performed_by,
      target_id: input.target_id || '',
      details: input.details || '',
      created_at: serverTimestamp(),
    });
  } catch (error: unknown) {
    logFirestoreFailure({ collection: 'admin_logs', operation: 'add', path: 'admin_logs', query: `create admin log ${input.action}`, role: profile?.role, status: profile?.status }, error);
    console.warn('[adminLogs] Failed to write admin log, ignoring error:', error);
  }
}
