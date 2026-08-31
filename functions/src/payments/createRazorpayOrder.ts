/**
 * MSLB Create Razorpay Order — Hardened Cloud Function
 * 
 * Creates an authenticated server-side Razorpay order for online payments.
 * Returns safe checkout data to client.
 * 
 * SECURITY INVARIANTS:
 * - Firebase Auth required & account status active/approved.
 * - Amount strictly derived from authoritative Firestore pricing (`app_settings/platform`).
 * - Active enrollment checked before order creation (prevents double charging).
 * - Course ID existence verified against `courses/{courseId}`.
 * - Deduplication of pending orders created within 10 minutes.
 * - RAZORPAY_KEY_SECRET NEVER exposed to client.
 */
import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import Razorpay from 'razorpay';
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from '../config/secrets';
import { db } from '../config/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuthenticatedUser } from '../auth/verifyAuth';
import { invalidArgumentError, internalError, permissionDeniedError } from '../shared/errors';
import { collections } from '../shared/firestore';

interface CreateOrderRequest {
  courseId?: string;          // Optional: specific course
  paymentType?: string;       // e.g. 'fees', 'course_enrollment', 'sadqa', 'zakat', 'fitra', 'langar'
  currency?: string;          // Default: 'INR'
}

interface CreateOrderResponse {
  orderId: string;
  paymentDocId: string;
  amount: number;             // Amount in paise (smallest unit)
  currency: string;
  keyId: string;              // Public key only — NEVER keySecret
}

export const createRazorpayOrder = onCall(
  {
    region: 'us-central1',
    secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET],
  },
  async (request: CallableRequest<CreateOrderRequest>): Promise<CreateOrderResponse> => {
    logger.info(`[createRazorpayOrder:diagnostic] hasAuth=${Boolean(request.auth)} uid=${request.auth?.uid ?? 'null'}`);
    // 1. Require authentication
    const user = await requireAuthenticatedUser(request);
    logger.info(`[createRazorpayOrder] Authenticated user verified: uid=${user.uid} role=${user.role}`);

    const { courseId, paymentType = 'fees', currency = 'INR' } = request.data ?? {};

    // 2. Validate currency and payment type
    if (typeof currency !== 'string' || currency !== 'INR') {
      throw invalidArgumentError('Only INR currency is supported.');
    }
    const validPaymentTypes = ['fees', 'course_enrollment', 'sadqa', 'zakat', 'fitra', 'langar'];
    if (!validPaymentTypes.includes(paymentType)) {
      throw invalidArgumentError(`Invalid payment type: ${paymentType}`);
    }

    // 3. If courseId is provided, verify course exists and user is not already enrolled
    if (courseId) {
      const courseSnap = await collections.courses().doc(courseId).get();
      if (!courseSnap.exists) {
        throw invalidArgumentError(`Course not found: ${courseId}`);
      }

      const enrollmentSnap = await collections.enrollments().doc(`${user.uid}:${courseId}`).get();
      if (enrollmentSnap.exists) {
        const enrollmentData = enrollmentSnap.data();
        if (enrollmentData?.status === 'active') {
          throw invalidArgumentError('You are already actively enrolled in this course.');
        }
      }
    }

    // 4. Verify user eligibility
    const userSnap = await collections.users().doc(user.uid).get();
    if (!userSnap.exists) {
      throw permissionDeniedError('User profile not found.');
    }
    const userProfile = userSnap.data()!;
    if (userProfile.status === 'suspended' || userProfile.status === 'banned' || userProfile.status === 'deactivated') {
      throw permissionDeniedError('Account is not eligible for payments.');
    }

    // 5. Read authoritative pricing from Firestore (server-side only)
    const settingsSnap = await db.collection('app_settings').doc('platform').get();
    if (!settingsSnap.exists) {
      throw internalError('Payment configuration not found.');
    }
    const settings = settingsSnap.data()!;
    
    // Server-side authoritative amount in paise
    let feesAmountPaise = 0;
    if (paymentType === 'fees' || paymentType === 'course_enrollment') {
      const paiseValue = Number(settings.fees_amount_paise ?? 0);
      const inrValue = Number(settings.fees_amount ?? 0);
      feesAmountPaise = paiseValue > 0 ? paiseValue : (inrValue > 0 ? inrValue * 100 : 0);
    } else {
      const inrValue = Number(settings.fees_amount ?? 500);
      feesAmountPaise = inrValue * 100;
    }

    if (!feesAmountPaise || feesAmountPaise <= 0) {
      throw internalError('Invalid fees configuration on server.');
    }

    // 6. Duplicate pending order protection (reuse if created within last 10 minutes)
    const tenMinutesAgoMs = Date.now() - (10 * 60 * 1000);
    const existingPendingSnap = await collections.payments()
      .where('user_id', '==', user.uid)
      .where('course_id', '==', courseId ?? null)
      .where('payment_type', '==', paymentType)
      .where('state', '==', 'pending')
      .limit(1)
      .get();

    const keyId = RAZORPAY_KEY_ID.value();
    const keySecret = RAZORPAY_KEY_SECRET.value();
    if (!keyId || !keySecret) {
      throw internalError('Payment provider not configured.');
    }

    if (!existingPendingSnap.empty) {
      const existingDoc = existingPendingSnap.docs[0];
      const existingData = existingDoc.data();
      const createdAtMs = existingData.created_at_ms ?? (existingData.created_at?.toMillis?.() || 0);
      
      if (createdAtMs > tenMinutesAgoMs && existingData.provider_order_id && existingData.amount === feesAmountPaise) {
        logger.info(`[createRazorpayOrder] Reusing unexpired pending order id=${existingData.provider_order_id}`);
        return {
          orderId: existingData.provider_order_id,
          paymentDocId: existingDoc.id,
          amount: feesAmountPaise,
          currency,
          keyId,
        };
      }
    }

    // 7. Initialize Razorpay client using Secret Manager secrets
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    // 8. Create Razorpay order
    const receiptId = `mslb_${user.uid.slice(0, 8)}_${Date.now()}`;
    let razorpayOrder: any;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: feesAmountPaise,
        currency,
        receipt: receiptId,
        notes: {
          user_id: user.uid,
          payment_type: paymentType,
          course_id: courseId ?? '',
        },
      });
    } catch (err: any) {
      logger.error('[createRazorpayOrder] Razorpay order creation failed', err);
      throw internalError('Failed to create payment order.');
    }

    // 9. Write pending payment document to Firestore
    const paymentDoc = {
      user_id: user.uid,
      provider: 'razorpay',
      provider_order_id: razorpayOrder.id,
      course_id: courseId ?? null,
      payment_type: paymentType,
      type: paymentType,
      amount: feesAmountPaise,
      currency,
      state: 'pending',
      status: 'pending',
      receipt_id: receiptId,
      created_at: FieldValue.serverTimestamp(),
      created_at_ms: Date.now(),
      source: 'cloud_function_v2',
    };

    const paymentRef = await collections.payments().add(paymentDoc);
    logger.info(`[createRazorpayOrder] Payment doc created id=${paymentRef.id} orderId=${razorpayOrder.id}`);

    // 10. Return ONLY safe data — keySecret is NEVER returned
    return {
      orderId: razorpayOrder.id,
      paymentDocId: paymentRef.id,
      amount: feesAmountPaise,
      currency,
      keyId, 
    };
  }
);
