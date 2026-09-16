/**
 * MSLB Verify Razorpay Payment — Hardened Cloud Function Callable
 * 
 * Provides immediate server-side payment verification upon Razorpay checkout completion.
 * Verifies the Razorpay checkout HMAC-SHA256 signature against RAZORPAY_KEY_SECRET in constant-time.
 * 
 * SECURITY INVARIANTS:
 * - Firebase Auth required (requireAuthenticatedUser).
 * - Only the payment owner (matching request.auth.uid) can trigger verification.
 * - Input validation: paymentDocId, orderId, paymentId, signature must all be present.
 * - Payment document orderId must strictly match the supplied orderId.
 * - Razorpay signature verified via crypto.timingSafeEqual.
 * - Idempotency: already succeeded payments return success immediately without re-enrolling.
 * - Atomic write: payment status update, course enrollment, subscription, and audit log.
 */
import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/admin';
import { RAZORPAY_KEY_SECRET } from '../config/secrets';
import { requireAuthenticatedUser } from '../auth/verifyAuth';
import { invalidArgumentError, notFoundError, permissionDeniedError, internalError } from '../shared/errors';
import { collections } from '../shared/firestore';

export interface VerifyRazorpayPaymentRequest {
  paymentDocId: string;
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface VerifyRazorpayPaymentResponse {
  success: boolean;
  verified: boolean;
  alreadyCompleted?: boolean;
  paymentDocId: string;
  enrollmentId?: string;
}

/**
 * Pure helper for Razorpay signature verification (reusable and testable)
 */
export function verifySignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  if (!orderId || !paymentId || !signature || !secret) {
    return false;
  }
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  try {
    const expBuf = Buffer.from(expectedSignature, 'utf8');
    const recBuf = Buffer.from(signature, 'utf8');
    if (expBuf.length !== recBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expBuf, recBuf);
  } catch {
    return false;
  }
}

export const verifyRazorpayPayment = onCall(
  {
    region: 'us-central1',
    secrets: [RAZORPAY_KEY_SECRET],
  },
  async (request: CallableRequest<VerifyRazorpayPaymentRequest>): Promise<VerifyRazorpayPaymentResponse> => {
    // 1. Require authenticated user
    const user = await requireAuthenticatedUser(request);
    logger.info(`[verifyRazorpayPayment] Invoked by uid=${user.uid}`);

    const { paymentDocId, orderId, paymentId, signature } = request.data ?? {};

    // 2. Validate request parameters
    if (!paymentDocId || typeof paymentDocId !== 'string' || !paymentDocId.trim()) {
      throw invalidArgumentError('paymentDocId is required.');
    }
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      throw invalidArgumentError('orderId is required.');
    }
    if (!paymentId || typeof paymentId !== 'string' || !paymentId.trim()) {
      throw invalidArgumentError('paymentId is required.');
    }
    if (!signature || typeof signature !== 'string' || !signature.trim()) {
      throw invalidArgumentError('signature is required.');
    }

    // 3. Obtain Razorpay Key Secret from Secret Manager
    const secret = RAZORPAY_KEY_SECRET.value();
    if (!secret) {
      logger.error('[verifyRazorpayPayment] RAZORPAY_KEY_SECRET not configured');
      throw internalError('Payment provider not configured.');
    }

    // 4. Verify HMAC-SHA256 signature in constant-time
    const isValidSignature = verifySignature(orderId, paymentId, signature, secret);
    if (!isValidSignature) {
      logger.warn(`[verifyRazorpayPayment] Signature verification failed for uid=${user.uid} orderId=${orderId} paymentId=${paymentId}`);
      // Audit log failed verification attempt
      await db.collection('payment_processor_audit_logs').add({
        event: 'signature_verification_failed',
        uid: user.uid,
        payment_doc_id: paymentDocId,
        order_id: orderId,
        payment_id: paymentId,
        created_at_ms: Date.now(),
        created_at: FieldValue.serverTimestamp(),
      }).catch(() => {});
      throw permissionDeniedError('Payment signature verification failed.');
    }

    // 5. Fetch payment doc from Firestore
    const paymentDocRef = collections.payments().doc(paymentDocId);
    const paymentDocSnap = await paymentDocRef.get();
    if (!paymentDocSnap.exists) {
      throw notFoundError(`Payment record not found: ${paymentDocId}`);
    }

    const paymentData = paymentDocSnap.data()!;

    // 6. Security Check: Payment must belong to the calling user
    if (paymentData.user_id !== user.uid) {
      logger.error(`[verifyRazorpayPayment] User mismatch! caller=${user.uid}, paymentUser=${paymentData.user_id}`);
      throw permissionDeniedError('You do not have permission to verify this payment.');
    }

    // 7. Consistency Check: orderId must match document's provider_order_id
    if (paymentData.provider_order_id && paymentData.provider_order_id !== orderId) {
      logger.error(`[verifyRazorpayPayment] Order ID mismatch! expected=${paymentData.provider_order_id}, got=${orderId}`);
      throw invalidArgumentError('Order ID does not match the payment record.');
    }

    // 8. Idempotency: If payment is already succeeded, return immediately
    const currentState = paymentData.state ?? paymentData.status;
    if (currentState === 'succeeded') {
      logger.info(`[verifyRazorpayPayment] Payment already marked succeeded docId=${paymentDocId}`);
      const courseId = paymentData.course_id;
      const enrollmentId = courseId ? `${user.uid}:${courseId}` : undefined;
      return {
        success: true,
        verified: true,
        alreadyCompleted: true,
        paymentDocId,
        enrollmentId,
      };
    }

    // 9. Atomic Batch Finalization
    const batch = db.batch();
    const now = FieldValue.serverTimestamp();
    const nowMs = Date.now();
    const courseId: string | null = paymentData.course_id ?? null;
    const orgId: string = paymentData.organization_id || 'mslb-main';
    const amount: number = paymentData.amount || 0;
    const currency: string = paymentData.currency || 'INR';

    // 9a. Update payment record
    batch.update(paymentDocRef, {
      state: 'succeeded',
      status: 'succeeded',
      provider_payment_id: paymentId,
      provider_signature: signature,
      paid_amount: amount,
      paid_currency: currency,
      organization_id: orgId,
      finalized_at: now,
      finalized_at_ms: nowMs,
      finalized_by: 'verify_razorpay_callable_v1',
    });

    // 9b. Enroll user in course if applicable
    let enrollmentId: string | undefined = undefined;
    if (courseId) {
      enrollmentId = `${user.uid}:${courseId}`;
      const enrollmentRef = collections.enrollments().doc(enrollmentId);
      batch.set(enrollmentRef, {
        user_id: user.uid,
        course_id: courseId,
        organization_id: orgId,
        payment_id: paymentDocId,
        provider_order_id: orderId,
        provider_payment_id: paymentId,
        created_at: now,
        updated_at: now,
        enrolled_at_ms: nowMs,
        status: 'active',
        source: 'payment',
      }, { merge: true });
    }

    // 9c. Update subscription
    const subscriptionRef = collections.subscriptions().doc(user.uid);
    batch.set(subscriptionRef, {
      user_id: user.uid,
      organization_id: orgId,
      status: 'active',
      last_payment_id: paymentDocId,
      provider_order_id: orderId,
      provider_payment_id: paymentId,
      updated_at: now,
      activated_at_ms: nowMs,
      source: 'verify_razorpay_callable_v1',
    }, { merge: true });

    // 9d. Audit log
    const auditRef = db.collection('payment_processor_audit_logs').doc();
    batch.set(auditRef, {
      event: 'payment_verified_callable',
      payment_doc_id: paymentDocId,
      user_id: user.uid,
      course_id: courseId,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      amount,
      currency,
      finalized_at: now,
      finalized_at_ms: nowMs,
      source: 'verify_razorpay_callable_v1',
    });

    await batch.commit();

    logger.info(`[verifyRazorpayPayment] Payment successfully verified and finalized uid=${user.uid} docId=${paymentDocId}`);

    return {
      success: true,
      verified: true,
      alreadyCompleted: false,
      paymentDocId,
      enrollmentId,
    };
  }
);
