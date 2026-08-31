/**
 * MSLB Razorpay Cloud Functions Client Helper
 * 
 * PHASE 3 STAGE A: Implementation complete, NOT yet activated in production UI.
 * Activation happens in STAGE E after full test verification.
 * 
 * Usage:
 *   const result = await createRazorpayOrder({ courseId: 'course_123' });
 *   // Launch Razorpay Checkout SDK with result.orderId, result.keyId, result.amount
 * 
 * DO NOT import this file in payment.tsx until Stage E is approved.
 */
import { httpsCallable } from 'firebase/functions';
import { functions, auth, app } from '@/lib/firebase';

export interface CreateOrderRequest {
  courseId?: string;
  paymentType?: string;
  currency?: string;
}

export interface CreateOrderResponse {
  orderId: string;
  paymentDocId: string;
  amount: number;
  currency: string;
  keyId: string;   // Public key — safe for checkout; NEVER the secret
}

/**
 * Create a Razorpay order via Cloud Function.
 * The Cloud Function reads pricing from Firestore — client-supplied amount is ignored.
 * Returns checkout data: orderId, amount (paise), currency, keyId.
 */
export async function createRazorpayOrder(
  request: CreateOrderRequest = {}
): Promise<CreateOrderResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required: Firebase Auth currentUser is null. Please sign in again.');
  }

  // Force token refresh to guarantee valid, active ID token for automatic Cloud Functions callable authentication
  try {
    await currentUser.getIdToken(true);
  } catch (refreshErr) {
    // Continue if offline or network glitch; callable SDK will use cached token
  }

  const createOrderFn = httpsCallable<CreateOrderRequest, CreateOrderResponse>(
    functions,
    'createRazorpayOrder'
  );
  const result = await createOrderFn(request);
  return result.data;
}

/** @deprecated Phase 8: Maintained only for legacy backwards compatibility. Not used in automated online flow. */
export interface SubmitPaymentReferenceRequest {
  paymentId: string;
  transactionRef: string;
}

/** @deprecated Phase 8: Maintained only for legacy backwards compatibility. */
export async function submitPaymentReference(request: SubmitPaymentReferenceRequest): Promise<any> {
  const submitFn = httpsCallable<SubmitPaymentReferenceRequest, any>(functions, 'submitPaymentReference');
  const result = await submitFn(request);
  return result.data;
}

export interface AdminPaymentActionRequest {
  paymentId: string;
  action: 'approve' | 'reject' | 'verify' | 'refund';
  note?: string;
  evidence?: Record<string, any>;
}

export async function adminPaymentAction(request: AdminPaymentActionRequest): Promise<any> {
  const adminActionFn = httpsCallable<AdminPaymentActionRequest, any>(functions, 'adminPaymentAction');
  const result = await adminActionFn(request);
  return result.data;
}

export interface AdminRefundPaymentRequest {
  paymentId: string;
  reason?: string;
  amount?: number;
}

export interface AdminRefundPaymentResponse {
  success: boolean;
  paymentId: string;
  refundId: string;
  refundedAmount: number;
  idempotent?: boolean;
}

export async function adminRefundPayment(request: AdminRefundPaymentRequest): Promise<AdminRefundPaymentResponse> {
  const refundFn = httpsCallable<AdminRefundPaymentRequest, AdminRefundPaymentResponse>(functions, 'adminRefundPayment');
  const result = await refundFn(request);
  return result.data;
}

