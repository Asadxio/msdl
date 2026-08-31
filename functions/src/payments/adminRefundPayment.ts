/**
 * MSLB Admin Refund Payment — Cloud Function
 * 
 * Performs an authoritative, real Razorpay refund via the server-side Razorpay REST API.
 * 
 * SECURITY INVARIANTS:
 * - Admin or Super Admin authentication required (verified via Firestore user doc).
 * - Target payment must be in 'succeeded' state.
 * - Razorpay secret is accessed strictly from Secret Manager (never in client).
 * - Razorpay Refund API is called server-side.
 * - Atomically revokes course enrollment and subscription upon refund success.
 * - Records immutable audit entry in payment_processor_audit_logs.
 * - Idempotent: already-refunded payments return existing refund reference.
 */
import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import Razorpay from 'razorpay';
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from '../config/secrets';
import { db } from '../config/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdminUser } from '../auth/verifyAuth';
import { invalidArgumentError, internalError } from '../shared/errors';
import { collections } from '../shared/firestore';

interface AdminRefundPaymentRequest {
  paymentId: string;
  reason?: string;
  amount?: number; // Optional partial amount in paise
}

interface AdminRefundPaymentResponse {
  success: boolean;
  paymentId: string;
  refundId: string;
  refundedAmount: number;
  idempotent?: boolean;
}

export const adminRefundPayment = onCall(
  {
    region: 'us-central1',
    secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET],
  },
  async (request: CallableRequest<AdminRefundPaymentRequest>): Promise<AdminRefundPaymentResponse> => {
    // 1. Authenticate admin
    const admin = await requireAdminUser(request);
    logger.info(`[adminRefundPayment] Admin uid=${admin.uid} requesting refund for paymentId=${request.data?.paymentId}`);

    const { paymentId, reason = 'Administrative refund', amount } = request.data ?? {};

    if (!paymentId) {
      throw invalidArgumentError('paymentId is required.');
    }
    if (!reason || reason.trim().length < 4) {
      throw invalidArgumentError('A reason of at least 4 characters is required for refund.');
    }

    // 2. Load target payment document
    const paymentRef = collections.payments().doc(paymentId);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) {
      throw invalidArgumentError(`Payment document not found: ${paymentId}`);
    }

    const paymentData = paymentSnap.data()!;
    const currentState = paymentData.state ?? paymentData.status ?? 'pending';

    // 3. Idempotency check: if already refunded, return existing refund ID
    if (currentState === 'refunded') {
      logger.info(`[adminRefundPayment] Payment ${paymentId} is already refunded.`);
      return {
        success: true,
        paymentId,
        refundId: paymentData.refund_id ?? 'already_refunded',
        refundedAmount: paymentData.refunded_amount ?? paymentData.amount ?? 0,
        idempotent: true,
      };
    }

    // 4. Validate transition: only 'succeeded' payments can be refunded
    if (currentState !== 'succeeded') {
      throw invalidArgumentError(`Cannot refund payment in '${currentState}' state. Only 'succeeded' payments can be refunded.`);
    }

    const providerPaymentId: string = paymentData.provider_payment_id ?? '';
    if (!providerPaymentId || !providerPaymentId.startsWith('pay_')) {
      throw invalidArgumentError(`Payment ${paymentId} does not have a valid Razorpay provider_payment_id.`);
    }

    // 5. Initialize Razorpay client with Secret Manager credentials
    const keyId = RAZORPAY_KEY_ID.value();
    const keySecret = RAZORPAY_KEY_SECRET.value();
    if (!keyId || !keySecret) {
      throw internalError('Razorpay credentials not configured in Secret Manager.');
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const refundAmount = amount && amount > 0 ? amount : paymentData.paid_amount ?? paymentData.amount;

    // 6. Call Razorpay Refund API server-side
    let rzpRefund: any;
    try {
      logger.info(`[adminRefundPayment] Calling Razorpay Refund API for ${providerPaymentId} amount=${refundAmount}`);
      rzpRefund = await razorpay.payments.refund(providerPaymentId, {
        amount: refundAmount,
        notes: {
          reason: reason.substring(0, 200),
          refunded_by_admin: admin.uid,
          payment_doc_id: paymentId,
        },
      });
    } catch (err: any) {
      logger.error('[adminRefundPayment] Razorpay refund API failed', err);
      // Log failure to audit trail
      await db.collection('payment_processor_audit_logs').add({
        event: 'refund_api_failed',
        payment_doc_id: paymentId,
        provider_payment_id: providerPaymentId,
        admin_uid: admin.uid,
        error: err?.message ?? 'Razorpay API error',
        created_at_ms: Date.now(),
        created_at: FieldValue.serverTimestamp(),
      });
      throw internalError(`Razorpay refund failed: ${err?.error?.description || err?.message || 'Gateway error'}`);
    }

    const refundId = rzpRefund.id ?? `rfnd_${Date.now()}`;
    const now = FieldValue.serverTimestamp();
    const nowMs = Date.now();
    const userId = paymentData.user_id;
    const courseId = paymentData.course_id;

    // 7. Atomic batch update in Firestore
    const batch = db.batch();

    // 7a. Update payment document
    batch.update(paymentRef, {
      state: 'refunded',
      status: 'refunded',
      refund_id: refundId,
      refund_reason: reason.substring(0, 500),
      refunded_amount: refundAmount,
      refunded_at: now,
      refunded_at_ms: nowMs,
      refunded_by: admin.uid,
      updated_at: now,
      updated_at_ms: nowMs,
    });

    // 7b. Revoke course enrollment if applicable
    if (userId && courseId) {
      const enrollmentRef = collections.enrollments().doc(`${userId}:${courseId}`);
      batch.set(enrollmentRef, {
        status: 'refunded',
        revoked_at: now,
        revoked_at_ms: nowMs,
        revoked_by: admin.uid,
        refund_id: refundId,
      }, { merge: true });
    }

    // 7c. Update subscription status if applicable
    if (userId) {
      const subscriptionRef = collections.subscriptions().doc(userId);
      batch.set(subscriptionRef, {
        status: 'refunded',
        updated_at: now,
        revoked_at_ms: nowMs,
        revoked_by: admin.uid,
        refund_id: refundId,
      }, { merge: true });
    }

    // 7d. Immutable audit log entry
    const auditRef = db.collection('payment_processor_audit_logs').doc();
    batch.set(auditRef, {
      event: 'payment_refunded',
      payment_doc_id: paymentId,
      provider_payment_id: providerPaymentId,
      refund_id: refundId,
      refunded_amount: refundAmount,
      admin_uid: admin.uid,
      reason: reason.substring(0, 500),
      user_id: userId ?? null,
      course_id: courseId ?? null,
      created_at: now,
      created_at_ms: nowMs,
    });

    await batch.commit();

    logger.info(`[adminRefundPayment] SUCCESS: Payment ${paymentId} refunded with ID ${refundId}`);

    return {
      success: true,
      paymentId,
      refundId,
      refundedAmount: refundAmount,
      idempotent: false,
    };
  }
);
