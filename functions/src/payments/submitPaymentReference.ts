import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { db } from '../config/admin';
import { FieldValue, Transaction } from 'firebase-admin/firestore';
import { requireAuthenticatedUser } from '../auth/verifyAuth';
import { invalidArgumentError, permissionDeniedError } from '../shared/errors';
import { collections } from '../shared/firestore';

interface SubmitPaymentReferenceRequest {
  paymentId: string;
  transactionRef: string;
}

export const submitPaymentReference = onCall(
  { region: 'us-central1' },
  async (request: CallableRequest<SubmitPaymentReferenceRequest>) => {
    const user = await requireAuthenticatedUser(request);
    logger.info(`[submitPaymentReference] uid=${user.uid} paymentId=${request.data?.paymentId}`);

    const { paymentId, transactionRef } = request.data ?? {};

    if (!paymentId) throw invalidArgumentError('paymentId is required');
    if (!transactionRef || transactionRef.trim().length < 4) {
      throw invalidArgumentError('Valid transaction reference is required');
    }

    const safeRef = transactionRef.trim().substring(0, 120);
    const pRef = collections.payments().doc(paymentId);
    
    const result = await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(pRef);
      if (!snap.exists) {
        throw invalidArgumentError('Payment not found');
      }

      const pData = snap.data()!;
      if (pData.user_id !== user.uid) {
        throw permissionDeniedError('Not owner of this payment');
      }

      const currentState = pData.state || pData.status || 'pending';
      if (currentState !== 'pending' && currentState !== 'submitted') {
        throw invalidArgumentError(`Invalid transition from ${currentState}`);
      }

      const now = FieldValue.serverTimestamp();
      const nowMs = Date.now();

      tx.update(pRef, {
        state: 'submitted',
        status: 'submitted',
        transaction_ref: safeRef,
        submitted_at: now,
        updated_at: now,
        updated_at_ms: nowMs,
      });

      const queueRef = db.collection('payment_verification_queue').doc(paymentId);
      tx.set(queueRef, {
        payment_id: paymentId,
        status: 'queued',
        attempt: 0,
        scheduled_at_ms: nowMs,
        created_at_ms: nowMs
      }, { merge: true });

      return { ok: true, paymentId, state: 'submitted', status: 'submitted' };
    });

    return result;
  }
);
