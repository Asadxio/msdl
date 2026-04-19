import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/context/AuthContext';

type AdminLogInput = {
  action: string;
  performed_by: string;
  target_id?: string;
  details?: string;
};

export async function createAdminLog(profile: UserProfile | null, input: AdminLogInput): Promise<void> {
  if (profile?.role !== 'admin') return;
  if (!input.action || !input.performed_by) return;

  await addDoc(collection(db, 'admin_logs'), {
    action: input.action,
    performed_by: input.performed_by,
    target_id: input.target_id || '',
    details: input.details || '',
    created_at: serverTimestamp(),
  });
}
