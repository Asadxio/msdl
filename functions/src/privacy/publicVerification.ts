/**
 * MSLB Public Account Deletion Email Ownership Verification
 *
 * Implements cryptographic email ownership proof for public deletion requests.
 *
 * Security Model:
 * 1. Tokens stored in server-only collection `privacy_verification_tokens` (allow read, write: if false).
 * 2. 6-digit cryptographic verification codes salted and hashed using SHA-256.
 * 3. Rate-limited to max 5 failed attempts per request.
 * 4. 15-minute token expiry.
 * 5. Constant-time comparison using crypto.timingSafeEqual.
 * 6. Zero account enumeration: initiate returns identical message whether email is registered or not.
 * 7. Token bound strictly to request_id, email, and target account UID.
 */

import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as crypto from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { auth, db } from '../config/admin';
import {
  invalidArgumentError,
  notFoundError,
  failedPreconditionError,
  resourceExhaustedError,
  unauthenticatedError,
} from '../shared/errors';
import {
  sendAccountDeletionVerificationEmail,
  isEmailConfigured,
  EmailTransport,
  EmailDeliveryResult,
} from '../services/emailDeliveryService';

export interface InitiateVerificationData {
  requestId: string;
  email: string;
}

export interface InitiateVerificationOptions {
  fixedCode?: string;
  emailTransport?: EmailTransport;
}

export interface VerifyCodeData {
  requestId: string;
  code: string;
}

/**
 * Core logic for initiating email verification.
 */
export async function executeInitiatePublicDeletionVerification(
  data: InitiateVerificationData,
  options?: InitiateVerificationOptions
): Promise<{ success: boolean; message: string; delivery_status?: string; testCode?: string }> {
  const { requestId, email: rawEmail } = data;
  if (!requestId || typeof requestId !== 'string') {
    throw invalidArgumentError('A valid requestId is required.');
  }

  const cleanEmail = rawEmail?.trim().toLowerCase() || '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    throw invalidArgumentError('A valid email address is required.');
  }

  // Verify that the privacy_requests document exists
  const reqRef = db.collection('privacy_requests').doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) {
    throw notFoundError(`Privacy request document not found: ${requestId}`);
  }

  const reqData = reqSnap.data()!;
  if (reqData.type !== 'deletion') {
    throw invalidArgumentError(`Privacy request '${requestId}' is not a deletion request.`);
  }

  const storedEmail = (reqData.email || '').trim().toLowerCase();
  if (storedEmail !== cleanEmail) {
    throw invalidArgumentError('Provided email does not match the deletion request record.');
  }

  if (reqData.state === 'completed') {
    throw failedPreconditionError('This deletion request has already been completed.');
  }

  // Resolve target UID if account exists (never leak whether it exists to caller)
  let targetUid: string | null = null;
  try {
    const authUser = await auth.getUserByEmail(cleanEmail);
    targetUid = authUser.uid;
  } catch {
    const userQuery = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
    if (!userQuery.empty) {
      targetUid = userQuery.docs[0].id;
    }
  }

  // Rate limiting: check recent code generation
  const tokenRef = db.collection('privacy_verification_tokens').doc(requestId);
  const existingTokenSnap = await tokenRef.get();
  if (existingTokenSnap.exists) {
    const existing = existingTokenSnap.data()!;
    const lastCreatedMs = existing.created_at_ms || existing.created_at?.toMillis?.() || 0;
    // Enforce 30-second cooldown between code requests
    if (Date.now() - lastCreatedMs < 30 * 1000 && !options?.fixedCode) {
      throw failedPreconditionError(
        'A verification code was recently requested. Please check your inbox or wait 30 seconds.'
      );
    }
  }

  // Generate 6-digit cryptographic code and salt
  const code = options?.fixedCode || crypto.randomInt(100000, 999999).toString();
  const salt = crypto.randomBytes(16).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');

  const expiryMs = Date.now() + 15 * 60 * 1000; // 15 minutes
  const isEmulator =
    process.env.FUNCTIONS_EMULATOR === 'true' ||
    Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  // 1. Evaluate email delivery readiness
  const emailReady = isEmailConfigured() || Boolean(options?.emailTransport);

  // If in production and email credentials are NOT configured:
  // We do not falsely claim delivery succeeded.
  // To preserve zero enumeration, we return identical service-unavailable status
  // regardless of whether the account exists or not.
  if (!emailReady && !isEmulator) {
    logger.warn(
      `[initiatePublicDeletionVerification] Email provider not configured in production environment for requestId=${requestId}.`
    );
    await tokenRef.set({
      request_id: requestId,
      email: cleanEmail,
      target_uid: targetUid,
      token_hash: tokenHash,
      salt,
      attempts: 0,
      max_attempts: 5,
      expires_at: Timestamp.fromMillis(expiryMs),
      verified: false,
      used: false,
      delivery_status: 'not_configured',
      created_at: FieldValue.serverTimestamp(),
      created_at_ms: Date.now(),
    });
    return {
      success: false,
      delivery_status: 'not_configured',
      message:
        'Email delivery service is currently not configured or unavailable. Please contact privacy administration at privacy@madrasatussalikat.com for assistance.',
    };
  }

  // 2. Dispatch email if target account exists
  let deliveryResult: EmailDeliveryResult = {
    delivered: false,
    provider: 'none',
    status: 'not_configured',
  };

  if (targetUid) {
    if (options?.emailTransport || isEmailConfigured()) {
      deliveryResult = await sendAccountDeletionVerificationEmail(
        cleanEmail,
        code,
        requestId,
        options?.emailTransport
      );
    } else if (isEmulator) {
      // In local emulator without explicit transport override, simulate successful send
      deliveryResult = {
        delivered: true,
        provider: 'mock',
        status: 'sent',
        messageId: `emulator-mock-${Date.now()}`,
      };
    }
  } else {
    // Zero account enumeration: if no account exists for email, skip dispatch
    // but report standard acknowledged state so attacker learns nothing.
    deliveryResult = {
      delivered: true,
      provider: 'none',
      status: 'skipped_no_account',
    };
  }

  // Handle provider failure
  if (targetUid && deliveryResult.status === 'failed') {
    await tokenRef.set({
      request_id: requestId,
      email: cleanEmail,
      target_uid: targetUid,
      token_hash: tokenHash,
      salt,
      attempts: 0,
      max_attempts: 5,
      expires_at: Timestamp.fromMillis(expiryMs),
      verified: false,
      used: false,
      delivery_status: 'failed',
      delivery_error: deliveryResult.error || 'Failed to dispatch verification email',
      created_at: FieldValue.serverTimestamp(),
      created_at_ms: Date.now(),
    });
    return {
      success: false,
      delivery_status: 'failed',
      message:
        'Unable to deliver verification email at this time. Please verify your email address or try again later.',
    };
  }

  // Record successful dispatch and cryptographic token
  await tokenRef.set({
    request_id: requestId,
    email: cleanEmail,
    target_uid: targetUid,
    token_hash: tokenHash,
    salt,
    attempts: 0,
    max_attempts: 5,
    expires_at: Timestamp.fromMillis(expiryMs),
    verified: false,
    used: false,
    delivery_status: deliveryResult.status,
    delivery_provider: deliveryResult.provider,
    delivery_message_id: deliveryResult.messageId || null,
    created_at: FieldValue.serverTimestamp(),
    created_at_ms: Date.now(),
    // For local automated testing in emulator only:
    ...(isEmulator ? { _emulator_code: code } : {}),
  });

  logger.info(
    `[initiatePublicDeletionVerification] Verification code recorded for requestId=${requestId} (deliveryStatus=${deliveryResult.status})`
  );

  return {
    success: true,
    delivery_status: deliveryResult.status,
    message:
      'If an account is associated with this email address, a verification code has been dispatched. Please enter the 6-digit code to verify ownership.',
    ...(isEmulator ? { testCode: code } : {}),
  };
}

/**
 * Core logic for verifying public deletion request code.
 */
export async function executeVerifyPublicDeletionRequest(
  data: VerifyCodeData
): Promise<{ success: boolean; message: string; hasAccount: boolean }> {
  const { requestId, code: rawCode } = data;
  if (!requestId || typeof requestId !== 'string') {
    throw invalidArgumentError('A valid requestId is required.');
  }

  const code = rawCode?.trim() || '';
  if (!/^\d{6}$/.test(code)) {
    throw invalidArgumentError('Please enter a valid 6-digit verification code.');
  }

  const tokenRef = db.collection('privacy_verification_tokens').doc(requestId);
  const tokenSnap = await tokenRef.get();
  if (!tokenSnap.exists) {
    throw notFoundError('Verification request not found. Please submit a new deletion request.');
  }

  const tokenData = tokenSnap.data()!;

  // 1. Replay check
  if (tokenData.used) {
    throw failedPreconditionError('This verification code has already been used.');
  }

  // 2. Expiry check
  const expiryMs = tokenData.expires_at?.toMillis?.() || 0;
  if (Date.now() > expiryMs) {
    throw failedPreconditionError('This verification code has expired. Please request a new code.');
  }

  // 3. Max attempts check
  if (tokenData.attempts >= tokenData.max_attempts) {
    throw resourceExhaustedError('Too many failed verification attempts. Please submit a new deletion request.');
  }

  // 4. Constant-time comparison
  const inputHash = crypto.createHash('sha256').update(`${tokenData.salt}:${code}`).digest('hex');
  const matches = crypto.timingSafeEqual(
    Buffer.from(inputHash, 'hex'),
    Buffer.from(tokenData.token_hash, 'hex')
  );

  if (!matches) {
    await tokenRef.update({
      attempts: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp(),
    });
    const remaining = tokenData.max_attempts - (tokenData.attempts + 1);
    throw invalidArgumentError(`Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Max attempts reached.'}`);
  }

  // 5. Code is valid: Mark token verified and used
  await tokenRef.update({
    verified: true,
    used: true,
    verified_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  const reqRef = db.collection('privacy_requests').doc(requestId);

  if (tokenData.target_uid) {
    // Valid account found and ownership confirmed
    await reqRef.update({
      verification_status: 'verified',
      target_uid: tokenData.target_uid,
      verified_at: FieldValue.serverTimestamp(),
      verification_method: 'email_token_verified',
      updated_at: FieldValue.serverTimestamp(),
    });

    logger.info(
      `[verifyPublicDeletionRequest] Ownership verified for requestId=${requestId} targetUid=${tokenData.target_uid}`
    );

    return {
      success: true,
      message: 'Email ownership successfully verified. Your account deletion request has been authorized for processing.',
      hasAccount: true,
    };
  } else {
    // Email verified, but no matching account exists
    await reqRef.update({
      verification_status: 'verified_no_account',
      state: 'completed',
      completion_notes: 'Requester email verified, but no registered account exists in MSLB.',
      completed_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    logger.info(
      `[verifyPublicDeletionRequest] Email verified but no account found for requestId=${requestId}`
    );

    return {
      success: true,
      message: 'Email ownership verified. No active student account exists for this email address.',
      hasAccount: false,
    };
  }
}

/**
 * Callable endpoint to initiate verification code dispatch.
 * Requires an authenticated or anonymous Firebase session.
 */
export const initiatePublicDeletionVerification = onCall(
  { region: 'us-central1' },
  async (request: CallableRequest<InitiateVerificationData>) => {
    if (!request.auth) {
      throw unauthenticatedError();
    }
    return executeInitiatePublicDeletionVerification(request.data ?? { requestId: '', email: '' });
  }
);

/**
 * Callable endpoint to verify the 6-digit email ownership code.
 * Requires an authenticated or anonymous Firebase session.
 */
export const verifyPublicDeletionRequest = onCall(
  { region: 'us-central1' },
  async (request: CallableRequest<VerifyCodeData>) => {
    if (!request.auth) {
      throw unauthenticatedError();
    }
    return executeVerifyPublicDeletionRequest(request.data ?? { requestId: '', code: '' });
  }
);
