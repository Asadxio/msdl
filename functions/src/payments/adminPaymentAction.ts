import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { db } from '../config/admin';
import { FieldValue, Transaction } from 'firebase-admin/firestore';
import { requireAdminUser } from '../auth/verifyAuth';
import { invalidArgumentError, internalError } from '../shared/errors';
import { collections } from '../shared/firestore';

interface AdminPaymentActionRequest {
  paymentId: string;
  action: 'approve' | 'reject' | 'verify' | 'refund';
  note?: string;
  evidence?: Record<string, any>;
}

export const adminPaymentAction = onCall(
  { region: 'us-central1' },
  async (request: CallableRequest<AdminPaymentActionRequest>) => {
    // 1. Require admin
    const user = await requireAdminUser(request);
    logger.info(`[adminPaymentAction] uid=${user.uid} action=${request.data?.action} paymentId=${request.data?.paymentId}`);

    const { paymentId, action, note = '', evidence = {} } = request.data ?? {};

    if (!paymentId) throw invalidArgumentError('paymentId is required');
    if (!['approve', 'reject', 'verify', 'refund'].includes(action)) {
      throw invalidArgumentError('Invalid action. Must be approve, reject, verify, or refund.');
    }
    if (!note || note.length < 4) {
      throw invalidArgumentError('Admin reason/note is required (min 4 chars)');
    }

    const pRef = collections.payments().doc(paymentId);
    
    // We use a transaction to safely read and update the payment and related docs
    const result = await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(pRef);
      if (!snap.exists) {
        throw invalidArgumentError('Payment not found');
      }

      const pData = snap.data()!;
      const currentState = pData.state || pData.status || 'pending';
      const userId = pData.user_id;
      const courseId = pData.course_id ?? null;
      const paymentType = pData.type || pData.payment_type || 'fees';

      let nextState = '';
      if (action === 'approve' || action === 'verify') {
        nextState = 'succeeded';
      } else if (action === 'reject') {
        nextState = 'rejected';
      } else if (action === 'refund') {
        nextState = 'refunded';
      }

      // Idempotency
      if (currentState === nextState) {
        return { ok: true, paymentId, from: currentState, to: nextState, idempotent: true };
      }

      // Enforce state transition matrix
      let isValidTransition = false;
      if (nextState === 'succeeded') {
        isValidTransition = ['pending', 'submitted', 'processing', 'verified'].includes(currentState);
      } else if (nextState === 'rejected') {
        isValidTransition = ['pending', 'submitted', 'processing', 'verified'].includes(currentState);
      } else if (nextState === 'refunded') {
        isValidTransition = ['succeeded'].includes(currentState);
      }

      if (!isValidTransition) {
        throw invalidArgumentError(`Invalid transition: ${currentState} -> ${nextState} via ${action}`);
      }

      const now = FieldValue.serverTimestamp();
      const nowMs = Date.now();

      const baseUpdate: any = {
        state: nextState,
        status: nextState,
        reviewed_by: user.uid,
        review_note: note.substring(0, 500),
        review_evidence: evidence,
        reviewed_at: now,
        updated_at: now,
        updated_at_ms: nowMs,
      };

      if (nextState === 'succeeded') {
        baseUpdate.finalized_at = now;
        baseUpdate.finalized_at_ms = nowMs;
        baseUpdate.finalized_by = user.uid;
      }

      tx.update(pRef, baseUpdate);

      // Handle entitlements on approve/verify
      if (nextState === 'succeeded') {
        if (!userId) throw internalError('Payment missing user_id');

        const grantsSubscription = paymentType === 'fees';
        const grantsCourseAccess = grantsSubscription && !!courseId;

        if (grantsCourseAccess) {
          const enrollmentId = `${userId}:${courseId}`;
          const eRef = collections.enrollments().doc(enrollmentId);
          tx.set(eRef, {
            user_id: userId,
            course_id: courseId,
            status: 'active',
            source: 'admin_action',
            payment_id: paymentId,
            created_at: now,
            updated_at: now,
            enrolled_at_ms: nowMs,
          }, { merge: true });
        }

        if (grantsSubscription) {
          const sRef = collections.subscriptions().doc(userId);
          tx.set(sRef, {
            user_id: userId,
            status: 'active',
            last_payment_id: paymentId,
            updated_at: now,
            activated_at_ms: nowMs,
            source: 'admin_action',
          }, { merge: true });
        }
      }

      // Audit log
      const auditRef = db.collection('payment_processor_audit_logs').doc();
      tx.set(auditRef, {
        payment_id: paymentId,
        actor_id: user.uid,
        actor_role: user.role, // role attached by requireAdminUser
        action: 'state_change',
        from: currentState,
        to: nextState,
        reason: note.substring(0, 500),
        evidence: evidence,
        created_at: now,
        created_at_ms: nowMs,
      });

      return { ok: true, paymentId, from: currentState, to: nextState, idempotent: false };
    });

    return result;
  }
);
