import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const REPORT_REASONS = [
  'Inappropriate content',
  'Harassment',
  'Spam',
  'Other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];
export type UgcTargetType = 'chat_message' | 'chat_thread' | 'status_post' | 'live_class_participant';

export async function submitUgcReport(input: {
  reportedBy: string;
  targetType: UgcTargetType;
  targetId: string;
  reason: ReportReason;
  accusedUserId?: string;
  accusedRole?: string;
  metadata?: Record<string, unknown>;
}) {
  const now = Date.now();
  return addDoc(collection(db, 'moderation_reports'), {
    reportedBy: input.reportedBy,
    reporter_id: input.reportedBy,
    targetType: input.targetType,
    target_type: input.targetType,
    targetId: input.targetId,
    target_id: input.targetId,
    reason: input.reason,
    timestamp: serverTimestamp(),
    status: 'pending',
    state: 'pending',
    severity: input.reason === 'Harassment' ? 'high' : 'medium',
    created_at: serverTimestamp(),
    created_at_ms: now,
    accused_user_id: input.accusedUserId || '',
    accused_role: input.accusedRole || 'student',
    metadata: input.metadata || {},
  });
}
