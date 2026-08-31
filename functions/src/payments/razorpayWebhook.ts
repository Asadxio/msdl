/**
 * MSLB Razorpay Webhook — Cloud Function
 * 
 * Receives Razorpay payment events and finalizes payments.
 * 
 * SECURITY MODEL:
 * - Public HTTP endpoint (no Firebase Auth — Razorpay calls this)
 * - Security via HMAC-SHA256 signature verification against RAZORPAY_KEY_SECRET
 * - Constant-time comparison to prevent timing attacks
 * - Replay protection via payment_gateway_events deduplication
 * - Idempotent: duplicate events are safely ignored
 * 
 * CRITICAL: DO NOT add x-webhook-timestamp validation.
 * Razorpay does not send this header. Only x-razorpay-signature is used.
 * 
 * DEPLOYMENT: This function URL must be configured in Razorpay Dashboard
 * ONLY after Stage C test verification is complete.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/admin';
import { RAZORPAY_KEY_SECRET } from '../config/secrets';
import { collections } from '../shared/firestore';

// Supported Razorpay webhook events
const SUPPORTED_EVENTS = [
  'payment.captured',
  'payment.authorized',
  'order.paid',
];

export const razorpayWebhook = onRequest(
  {
    region: 'us-central1',
    secrets: [RAZORPAY_KEY_SECRET],
    invoker: 'public',
    // Raw body must be available for HMAC verification
    // Firebase Functions v2 provides req.rawBody as Buffer
  },
  async (req, res) => {
    // 1. Only accept POST
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // 2. Extract raw body for HMAC verification
    // Firebase Functions v2 provides req.rawBody
    const rawBody: Buffer | undefined = (req as any).rawBody;
    if (!rawBody || rawBody.length === 0) {
      logger.warn('[razorpayWebhook] Missing raw body');
      res.status(400).send('Bad Request: empty body');
      return;
    }

    // 3. Extract Razorpay signature header
    const receivedSignature = req.headers['x-razorpay-signature'];
    if (!receivedSignature || typeof receivedSignature !== 'string') {
      logger.warn('[razorpayWebhook] Missing x-razorpay-signature header');
      res.status(401).send('Unauthorized: missing signature');
      return;
    }

    // 4. HMAC-SHA256 verification using RAZORPAY_KEY_SECRET
    // Algorithm: HMAC-SHA256(rawBody, RAZORPAY_KEY_SECRET)
    // This is the Razorpay-standard webhook verification method
    const webhookSecret = RAZORPAY_KEY_SECRET.value();
    if (!webhookSecret) {
      logger.error('[razorpayWebhook] RAZORPAY_KEY_SECRET not configured');
      res.status(500).send('Internal configuration error');
      return;
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const expBuf = Buffer.from(expectedSignature, 'hex');
    let signaturesMatch = false;
    try {
      const recBuf = Buffer.from(receivedSignature, 'hex');
      if (expBuf.length === recBuf.length) {
        signaturesMatch = crypto.timingSafeEqual(expBuf, recBuf);
      }
    } catch {
      signaturesMatch = false;
    }

    if (!signaturesMatch) {
      logger.warn('[razorpayWebhook] Signature verification FAILED');
      res.status(401).send('Unauthorized: invalid signature');
      return;
    }

    logger.info('[razorpayWebhook] Signature verified ✓');

    // 5. Parse payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch (err) {
      logger.error('[razorpayWebhook] JSON parse failed', err);
      res.status(400).send('Bad Request: invalid JSON');
      return;
    }

    const eventId: string = payload?.id ?? payload?.event_id ?? '';
    const eventType: string = payload?.event ?? '';

    // 6. Validate event type
    if (!SUPPORTED_EVENTS.includes(eventType)) {
      logger.info(`[razorpayWebhook] Unsupported event type=${eventType}, acknowledging`);
      res.status(200).send('OK'); // Acknowledge but don't process
      return;
    }

    // 7. Replay/duplicate protection via payment_gateway_events
    if (eventId) {
      const dedupeRef = db.collection('payment_gateway_events').doc(eventId);
      const existing = await dedupeRef.get();
      if (existing.exists) {
        logger.info(`[razorpayWebhook] Duplicate event id=${eventId}, acknowledging safely`);
        // Log the duplicate attempt
        await db.collection('payment_processor_audit_logs').add({
          event: 'webhook_duplicate',
          event_id: eventId,
          event_type: eventType,
          received_at_ms: Date.now(),
          received_at: FieldValue.serverTimestamp(),
        }).catch(() => {}); // Non-fatal
        res.status(200).send('OK'); // Idempotent — already processed
        return;
      }

      // Mark event as processing (write before finalization to prevent race)
      await dedupeRef.set({
        event_id: eventId,
        event_type: eventType,
        received_at_ms: Date.now(),
        received_at: FieldValue.serverTimestamp(),
        status: 'processing',
      });
    }

    // 8. Route to payment finalizer
    try {
      await finalizePayment(payload, eventType, eventId);
      
      // Mark event as completed
      if (eventId) {
        await db.collection('payment_gateway_events').doc(eventId).update({
          status: 'completed',
          completed_at_ms: Date.now(),
          completed_at: FieldValue.serverTimestamp(),
        });
      }

      res.status(200).send('OK');
    } catch (err: any) {
      logger.error('[razorpayWebhook] Finalization failed', err);
      
      // Mark event as failed
      if (eventId) {
        await db.collection('payment_gateway_events').doc(eventId).update({
          status: 'failed',
          error: err?.message ?? 'unknown',
          failed_at_ms: Date.now(),
        }).catch(() => {});
      }

      // Return 200 to prevent Razorpay from retrying — log failure internally
      // (Razorpay will retry on 5xx; return 200 with internal error logging)
      res.status(200).send('OK');
    }
  }
);

/**
 * Payment finalizer — ports the semantics of payment_finalizer.py to TypeScript.
 * 
 * Handles:
 * - payment.captured: payment successfully captured
 * - payment.authorized: payment authorized (may need capture)
 * - order.paid: order fully paid
 */
async function finalizePayment(payload: any, eventType: string, eventId: string): Promise<void> {
  // Extract payment data from Razorpay payload
  const payment = payload?.payload?.payment?.entity ?? payload?.payload?.order?.entity ?? {};
  const order = payload?.payload?.order?.entity ?? {};

  const razorpayPaymentId: string = payment?.id ?? '';
  const razorpayOrderId: string = payment?.order_id ?? order?.id ?? '';
  const paidAmount: number = payment?.amount ?? order?.amount_paid ?? 0;
  const currency: string = payment?.currency ?? order?.currency ?? 'INR';

  if (!razorpayOrderId) {
    logger.warn('[finalizePayment] No order ID in payload — cannot finalize');
    return;
  }

  logger.info(`[finalizePayment] Processing orderId=${razorpayOrderId} paymentId=${razorpayPaymentId}`);

  // 1. Find the corresponding payment document in Firestore
  const paymentsQuery = await collections.payments()
    .where('provider_order_id', '==', razorpayOrderId)
    .limit(1)
    .get();

  if (paymentsQuery.empty) {
    logger.warn(`[finalizePayment] No payment document found for orderId=${razorpayOrderId}`);
    // Still log to audit
    await db.collection('payment_processor_audit_logs').add({
      event: 'finalization_no_payment_found',
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      event_id: eventId,
      event_type: eventType,
      created_at_ms: Date.now(),
      created_at: FieldValue.serverTimestamp(),
    });
    return;
  }

  const paymentDoc = paymentsQuery.docs[0];
  const paymentData = paymentDoc.data();
  const paymentDocId = paymentDoc.id;

  // 2. Idempotency check — do not finalize already-succeeded payments
  if (paymentData.state === 'succeeded' || paymentData.status === 'succeeded') {
    logger.info(`[finalizePayment] Payment already succeeded id=${paymentDocId} — skipping`);
    return;
  }

  const userId: string = paymentData.user_id;
  const courseId: string | null = paymentData.course_id ?? null;

  if (!userId) {
    logger.error(`[finalizePayment] Payment has no user_id — cannot grant entitlement id=${paymentDocId}`);
    return;
  }

  // 2b. Strict amount and currency consistency validation
  if (paidAmount > 0 && paymentData.amount && paidAmount !== paymentData.amount) {
    logger.error(`[finalizePayment] Amount mismatch! Expected: ${paymentData.amount}, Received: ${paidAmount}`);
    await db.collection('payment_processor_audit_logs').add({
      event: 'finalization_amount_mismatch',
      payment_doc_id: paymentDocId,
      expected_amount: paymentData.amount,
      received_amount: paidAmount,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      event_id: eventId,
      created_at_ms: Date.now(),
      created_at: FieldValue.serverTimestamp(),
    });
    return;
  }

  if (currency && paymentData.currency && currency !== paymentData.currency) {
    logger.error(`[finalizePayment] Currency mismatch! Expected: ${paymentData.currency}, Received: ${currency}`);
    return;
  }

  // 3. Run finalization in a Firestore batch for atomicity
  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  const nowMs = Date.now();

  // 3a. Update payment document to succeeded
  batch.update(paymentDoc.ref, {
    state: 'succeeded',
    status: 'succeeded',
    provider_payment_id: razorpayPaymentId,
    paid_amount: paidAmount,
    paid_currency: currency,
    finalized_at: now,
    finalized_at_ms: nowMs,
    finalized_by: 'razorpay_webhook_v2',
  });

  // 3b. Create enrollment (porting payment_finalizer.py semantics)
  const enrollmentId = `${userId}:${courseId}`;
  const enrollmentRef = collections.enrollments().doc(enrollmentId);
  batch.set(enrollmentRef, {
    user_id: userId,
    course_id: courseId,
    payment_id: paymentDocId,
    provider_order_id: razorpayOrderId,
    provider_payment_id: razorpayPaymentId,
    created_at: now,
    updated_at: now,
    enrolled_at_ms: nowMs,
    status: 'active',
    source: 'payment',
  }, { merge: true });

  // 3c. Create/update subscription (porting payment_finalizer.py semantics)
  // Subscription keyed by userId for lookup efficiency
  const subscriptionRef = collections.subscriptions().doc(userId);
  batch.set(subscriptionRef, {
    user_id: userId,
    status: 'active',
    last_payment_id: paymentDocId,
    provider_order_id: razorpayOrderId,
    provider_payment_id: razorpayPaymentId,
    updated_at: now,
    activated_at_ms: nowMs,
    source: 'razorpay_webhook_v2',
  }, { merge: true });

  // 3d. Write audit log
  const auditRef = db.collection('payment_processor_audit_logs').doc();
  batch.set(auditRef, {
    event: 'payment_finalized',
    payment_doc_id: paymentDocId,
    user_id: userId,
    course_id: courseId,
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    paid_amount: paidAmount,
    event_id: eventId,
    event_type: eventType,
    finalized_at: now,
    finalized_at_ms: nowMs,
    source: 'razorpay_webhook_v2',
  });

  // 4. Commit atomically
  await batch.commit();

  logger.info(`[finalizePayment] SUCCESS userId=${userId} paymentId=${paymentDocId} orderId=${razorpayOrderId}`);
}
