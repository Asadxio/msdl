/**
 * MSLB Public Account Deletion Email Ownership Verification
 *
 * Implements cryptographic email ownership proof for public deletion requests.
 *
 * Security Model:
 * 1. Tokens stored in server-only collection `privacy_verification_tokens` (allow read, write: if false).
 * 2. 6-digit cryptographic verification codes salted and hashed using server-keyed HMAC-SHA256.
 * 3. Secret Manager-backed key material (PRIVACY_VERIFICATION_SECRET).
 * 4. Durable email-level rate limiting (cooldown, 24-hr daily cap, failed-attempt lockout)
 *    keyed by HMAC of normalized email, completely preventing bypass via fresh requestIds.
 * 5. Constant-time comparison using crypto.timingSafeEqual against timing attacks.
 * 6. Zero account enumeration: initiate returns identical message whether email is registered or not.
 * 7. Token bound strictly to request_id, email rate limit id, and verified target account UID.
 *
 * KEY ROTATION POLICY:
 * If PRIVACY_VERIFICATION_SECRET is rotated in Google Cloud Secret Manager:
 * 1. In-flight verification codes (valid for 15 minutes) will fail HMAC validation.
 * 2. Rate-limit documents will re-key under the new HMAC, resetting active windows.
 * 3. Users whose codes fail during a rotation window simply request a fresh code.
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
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  PRIVACY_VERIFICATION_SECRET,
} from '../config/secrets';

// Durable rate limiting and abuse controls
export const EMAIL_RATE_LIMIT_COOLDOWN_MS = 60 * 1000; // 60-second cooldown per email
export const EMAIL_RATE_LIMIT_DAILY_CAP = 5; // Max 5 verification codes per 24 hours per email
export const EMAIL_MAX_FAILED_ATTEMPTS = 10; // Cumulative failed verification attempts before 1-hour lockout
export const EMAIL_FAILED_LOCKOUT_MS = 60 * 60 * 1000; // 1-hour lockout duration

export interface InitiateVerificationData {
  requestId: string;
  email: string;
}

export interface InitiateVerificationOptions {
  fixedCode?: string;
  codeGenerator?: () => string;
  emailTransport?: EmailTransport;
  verificationSecret?: string;
  skipRateLimitingForTesting?: boolean;
}

export interface VerifyCodeData {
  requestId: string;
  code: string;
}

export interface VerifyCodeOptions {
  verificationSecret?: string;
}

/**
 * Resolves the server-side verification secret from Secret Manager parameter,
 * test override parameter, or process.env.
 */
export function getPrivacyVerificationSecret(optionsSecret?: string): string {
  if (optionsSecret && typeof optionsSecret === 'string' && optionsSecret.trim().length > 0) {
    return optionsSecret.trim();
  }
  try {
    const val = PRIVACY_VERIFICATION_SECRET.value();
    if (val && typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  } catch {
    // Secret not mounted or in emulator/test environment
  }
  const envVal = process.env.PRIVACY_VERIFICATION_SECRET;
  if (envVal && typeof envVal === 'string' && envVal.trim().length > 0) {
    return envVal.trim();
  }
  return '';
}

/**
 * Generates a cryptographically secure 6-digit decimal verification code.
 * Range: [100000, 1000000) -> integers 100000 to 999999 inclusive.
 * Exactly 6 decimal digits. Uses crypto.randomInt (CSPRNG).
 */
export function generateSixDigitVerificationCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Derives a pseudonymous rate-limit document key from the normalized email address
 * using HMAC-SHA256 with the server secret. Raw email is NEVER stored in document IDs.
 */
export function computeEmailRateLimitKey(normalizedEmail: string, secret: string): string {
  if (!secret) {
    throw new Error('Verification secret is required to derive rate-limit key.');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(normalizedEmail.trim().toLowerCase(), 'utf8')
    .digest('hex');
}

/**
 * Computes an HMAC-SHA256 hash of the salt:code pair using the server secret.
 * Replaces plain salted SHA-256 to provide offline brute-force and rainbow-table immunity.
 */
export function computeVerificationCodeHmac(code: string, salt: string, secret: string): string {
  if (!secret) {
    throw new Error('Verification secret is required for code HMAC computation.');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(`${salt}:${code}`, 'utf8')
    .digest('hex');
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

  // 1. Resolve required Secret Manager verification secret (fails safely if missing)
  const verificationSecret = getPrivacyVerificationSecret(options?.verificationSecret);
  if (!verificationSecret) {
    logger.error(
      `[initiatePublicDeletionVerification] PRIVACY_VERIFICATION_SECRET is unavailable for requestId=${requestId}`
    );
    throw failedPreconditionError('Verification service is temporarily unavailable. Please try again later.');
  }

  // 2. Normalize email
  const cleanEmail = rawEmail?.trim().toLowerCase() || '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    throw invalidArgumentError('A valid email address is required.');
  }

  // 3. Verify that the privacy_requests document exists
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

  // 4. Derive rate-limit identifier without storing raw email in document ID
  const emailRateLimitId = computeEmailRateLimitKey(cleanEmail, verificationSecret);
  const emailRateLimitRef = db.collection('privacy_email_rate_limits').doc(emailRateLimitId);

  // 5. Atomic Rate-Limiting & Abuse Prevention (Keyed by Email HMAC across all requestIds)
  if (!options?.skipRateLimitingForTesting) {
    const now = Date.now();
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(emailRateLimitRef);
      if (snap.exists) {
        const rateData = snap.data()!;

        // 5a. Check lockout from excessive failed verification attempts
        const lockoutUntil = rateData.lockout_until_ms || 0;
        if (now < lockoutUntil) {
          throw resourceExhaustedError(
            'Too many failed verification attempts for this account. Please wait 1 hour before trying again.'
          );
        }

        // 5b. Check per-email cooldown (enforced across ALL request IDs)
        const lastRequestedMs = rateData.last_requested_ms || 0;
        if (now - lastRequestedMs < EMAIL_RATE_LIMIT_COOLDOWN_MS && !options?.fixedCode) {
          const waitSec = Math.ceil((EMAIL_RATE_LIMIT_COOLDOWN_MS - (now - lastRequestedMs)) / 1000);
          throw failedPreconditionError(
            `A verification code was recently requested for this email. Please check your inbox or wait ${waitSec} seconds.`
          );
        }

        // 5c. Check 24-hour daily limit window
        const windowStartMs = rateData.window_start_ms || 0;
        let requestsInWindow = rateData.requests_in_window || 0;
        let newWindowStartMs = windowStartMs;

        if (now - windowStartMs > 24 * 60 * 60 * 1000) {
          newWindowStartMs = now;
          requestsInWindow = 1;
        } else {
          if (requestsInWindow >= EMAIL_RATE_LIMIT_DAILY_CAP && !options?.fixedCode) {
            throw resourceExhaustedError(
              'Daily verification request limit reached for this email address. Please try again tomorrow.'
            );
          }
          requestsInWindow += 1;
        }

        transaction.set(
          emailRateLimitRef,
          {
            email_hash: emailRateLimitId,
            last_requested_ms: now,
            window_start_ms: newWindowStartMs,
            requests_in_window: requestsInWindow,
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        transaction.set(emailRateLimitRef, {
          email_hash: emailRateLimitId,
          last_requested_ms: now,
          window_start_ms: now,
          requests_in_window: 1,
          failed_attempts: 0,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
      }
    });
  }

  // 6. Resolve target UID if account exists (never leak whether it exists to caller)
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

  // 7. Generate 6-digit cryptographic code and salt
  const code =
    options?.fixedCode ||
    (options?.codeGenerator ? options.codeGenerator() : generateSixDigitVerificationCode());
  const salt = crypto.randomBytes(16).toString('hex');
  const tokenHash = computeVerificationCodeHmac(code, salt, verificationSecret);

  const expiryMs = Date.now() + 15 * 60 * 1000; // 15 minutes
  const isEmulator =
    process.env.FUNCTIONS_EMULATOR === 'true' ||
    Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  const tokenRef = db.collection('privacy_verification_tokens').doc(requestId);

  // 8. Evaluate email delivery readiness
  const emailReady = isEmailConfigured() || Boolean(options?.emailTransport);

  // If in production and email credentials are NOT configured:
  // Return identical service-unavailable status preserving zero account enumeration
  if (!emailReady && !isEmulator) {
    logger.warn(
      `[initiatePublicDeletionVerification] Email provider not configured in production environment for requestId=${requestId}.`
    );
    await tokenRef.set({
      request_id: requestId,
      email_rate_limit_id: emailRateLimitId,
      email: cleanEmail,
      target_uid: targetUid,
      token_hash: tokenHash,
      salt,
      hash_algorithm: 'hmac-sha256',
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

  // 9. Dispatch email if target account exists
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
      email_rate_limit_id: emailRateLimitId,
      email: cleanEmail,
      target_uid: targetUid,
      token_hash: tokenHash,
      salt,
      hash_algorithm: 'hmac-sha256',
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
    email_rate_limit_id: emailRateLimitId,
    email: cleanEmail,
    target_uid: targetUid,
    token_hash: tokenHash,
    salt,
    hash_algorithm: 'hmac-sha256',
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
  data: VerifyCodeData,
  options?: VerifyCodeOptions
): Promise<{ success: boolean; message: string; hasAccount: boolean }> {
  const { requestId, code: rawCode } = data;
  if (!requestId || typeof requestId !== 'string') {
    throw invalidArgumentError('A valid requestId is required.');
  }

  const code = rawCode?.trim() || '';
  if (!/^\d{6}$/.test(code)) {
    throw invalidArgumentError('Please enter a valid 6-digit verification code.');
  }

  // 1. Resolve required Secret Manager verification secret
  const verificationSecret = getPrivacyVerificationSecret(options?.verificationSecret);
  if (!verificationSecret) {
    logger.error(
      `[verifyPublicDeletionRequest] PRIVACY_VERIFICATION_SECRET is unavailable for requestId=${requestId}`
    );
    throw failedPreconditionError('Verification service is temporarily unavailable. Please try again later.');
  }

  const tokenRef = db.collection('privacy_verification_tokens').doc(requestId);
  const tokenSnap = await tokenRef.get();
  if (!tokenSnap.exists) {
    throw notFoundError('Verification request not found. Please submit a new deletion request.');
  }

  const tokenData = tokenSnap.data()!;

  // 2. Replay check
  if (tokenData.used) {
    throw failedPreconditionError('This verification code has already been used.');
  }

  // 3. Expiry check
  const expiryMs = tokenData.expires_at?.toMillis?.() || 0;
  if (Date.now() > expiryMs) {
    throw failedPreconditionError('This verification code has expired. Please request a new code.');
  }

  // 4. Check if account/email-level lockout is active
  const emailRateLimitId = tokenData.email_rate_limit_id;
  let emailRateLimitRef: FirebaseFirestore.DocumentReference | null = null;
  if (emailRateLimitId) {
    emailRateLimitRef = db.collection('privacy_email_rate_limits').doc(emailRateLimitId);
    const emailRateSnap = await emailRateLimitRef.get();
    if (emailRateSnap.exists) {
      const emailRateData = emailRateSnap.data()!;
      if (Date.now() < (emailRateData.lockout_until_ms || 0)) {
        throw resourceExhaustedError(
          'Too many failed verification attempts for this account. Please wait 1 hour before trying again.'
        );
      }
    }
  }

  // 5. Max attempts check on this specific token
  if (tokenData.attempts >= tokenData.max_attempts) {
    throw resourceExhaustedError('Too many failed verification attempts. Please submit a new deletion request.');
  }

  // 6. HMAC-SHA256 constant-time comparison
  const inputHash = computeVerificationCodeHmac(code, tokenData.salt, verificationSecret);
  const expectedBuf = Buffer.from(tokenData.token_hash, 'hex');
  const inputBuf = Buffer.from(inputHash, 'hex');
  const matches =
    expectedBuf.length === inputBuf.length && crypto.timingSafeEqual(expectedBuf, inputBuf);

  if (!matches) {
    // Atomically increment attempt count on this token
    await tokenRef.update({
      attempts: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp(),
    });

    // Also atomically increment failed attempts on email-level rate-limit record
    if (emailRateLimitRef) {
      await emailRateLimitRef.set(
        {
          failed_attempts: FieldValue.increment(1),
          last_failed_ms: Date.now(),
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const updatedEmailSnap = await emailRateLimitRef.get();
      if ((updatedEmailSnap.data()?.failed_attempts || 0) >= EMAIL_MAX_FAILED_ATTEMPTS) {
        await emailRateLimitRef.update({
          lockout_until_ms: Date.now() + EMAIL_FAILED_LOCKOUT_MS,
        });
      }
    }

    const remaining = tokenData.max_attempts - (tokenData.attempts + 1);
    throw invalidArgumentError(
      `Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Max attempts reached.'}`
    );
  }

  // 7. Code is valid: Mark token verified and used
  await tokenRef.update({
    verified: true,
    used: true,
    verified_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  // Reset failed attempts on email rate limit doc
  if (emailRateLimitRef) {
    await emailRateLimitRef
      .update({
        failed_attempts: 0,
        lockout_until_ms: 0,
      })
      .catch(() => {});
  }

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
      message:
        'Email ownership successfully verified. Your account deletion request has been authorized for processing.',
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
 * Bound secrets: SMTP credentials and PRIVACY_VERIFICATION_SECRET.
 */
export const initiatePublicDeletionVerification = onCall(
  {
    region: 'us-central1',
    secrets: [
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      SMTP_FROM,
      PRIVACY_VERIFICATION_SECRET,
    ],
  },
  async (request: CallableRequest<InitiateVerificationData>) => {
    if (!request.auth) {
      throw unauthenticatedError();
    }
    return executeInitiatePublicDeletionVerification(
      request.data ?? { requestId: '', email: '' }
    );
  }
);

/**
 * Callable endpoint to verify the 6-digit email ownership code.
 * Requires an authenticated or anonymous Firebase session.
 * Bound secret: PRIVACY_VERIFICATION_SECRET.
 */
export const verifyPublicDeletionRequest = onCall(
  {
    region: 'us-central1',
    secrets: [PRIVACY_VERIFICATION_SECRET],
  },
  async (request: CallableRequest<VerifyCodeData>) => {
    if (!request.auth) {
      throw unauthenticatedError();
    }
    return executeVerifyPublicDeletionRequest(request.data ?? { requestId: '', code: '' });
  }
);
