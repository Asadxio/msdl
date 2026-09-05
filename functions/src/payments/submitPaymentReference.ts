import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { requireAuthenticatedUser } from '../auth/verifyAuth';
import { invalidArgumentError } from '../shared/errors';

interface SubmitPaymentReferenceRequest {
  paymentId: string;
  transactionRef: string;
}

export const submitPaymentReference = onCall(
  { region: 'us-central1' },
  async (request: CallableRequest<SubmitPaymentReferenceRequest>) => {
    await requireAuthenticatedUser(request);
    throw invalidArgumentError('Manual transaction reference submission is discontinued. Please complete course fees via the automated Razorpay gateway.');
  }
);
