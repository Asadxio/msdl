/**
 * MSLB Account Deletion Processor — Cloud Function
 * 
 * Safely processes user account deletion requests in full compliance
 * with Google Play User Data & Account Deletion policies.
 * 
 * SECURITY INVARIANTS:
 * - Either the user themselves (authenticated self-service deletion) or an authorized Admin can invoke this.
 * - Authenticates caller and verifies RBAC permissions.
 * - Rejects unauthorized cross-account deletion attempts.
 * - Resolves public deletion requests to the verified real user account, NEVER deleting anonymous requester IDs.
 * - Requires explicit verification of account ownership for public web deletion requests before processing.
 * - Explicit deletion lifecycle states: requested -> processing -> completed (or failed/retryable).
 * - Multi-step deletion with zero false success: if Storage or Auth deletion fails, state is marked 'failed' and error thrown.
 * - Fully idempotent and retryable: already-deleted Auth accounts (auth/user-not-found) are safely handled.
 * - Anonymizes personal user records in Firestore and deletes ancillary records (tokens, presence, public profiles).
 * - Preserves statutory financial payment records for legal/tax compliance without personal modification.
 * - Records immutable audit trail in admin_logs.
 */
import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { db, auth, storage } from '../config/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuthenticatedUser } from '../auth/verifyAuth';
import {
  invalidArgumentError,
  permissionDeniedError,
  notFoundError,
  failedPreconditionError,
  internalError,
} from '../shared/errors';
import { collections } from '../shared/firestore';

export interface ProcessDeletionRequest {
  targetUid?: string;
  targetEmail?: string;
  requestId?: string;
  reason?: string;
  // Storage bucket override (used for testing failure and retry)
  bucketOverride?: any;
}

export interface ProcessDeletionResponse {
  success: boolean;
  targetUid: string;
  targetEmail?: string;
  message: string;
  anonymizedAt: string;
  alreadyCompleted?: boolean;
}

export interface CallerContext {
  uid: string;
  role?: string;
  email?: string;
}

/**
 * Core business logic for account deletion execution.
 * Decoupled from the HTTP trigger to permit direct, rigorous integration testing
 * against isolated Firebase Emulators.
 */
export async function executeAccountDeletion(
  caller: CallerContext,
  data: ProcessDeletionRequest = {}
): Promise<ProcessDeletionResponse> {
  const isAdmin = caller.role === 'admin' || caller.role === 'super_admin';
  const {
    targetUid: rawUid,
    targetEmail: rawEmail,
    requestId,
    reason = 'Account deletion requested by user',
    bucketOverride,
  } = data;

  let cleanTargetUid = rawUid?.trim() || '';
  const cleanTargetEmail = rawEmail?.trim().toLowerCase() || '';

  let privacyReqRef: FirebaseFirestore.DocumentReference | null = null;
  let privacyReqDoc: FirebaseFirestore.DocumentData | null = null;

  // --------------------------------------------------------------------------
  // STEP 0: VALIDATE REQUEST DOCUMENT AND RESOLVE TARGET ACCOUNT
  // --------------------------------------------------------------------------
  if (requestId) {
    privacyReqRef = db.collection('privacy_requests').doc(requestId);
    const snap = await privacyReqRef.get();
    if (!snap.exists) {
      throw invalidArgumentError(`Privacy request document not found: ${requestId}`);
    }
    privacyReqDoc = snap.data()!;

    if (privacyReqDoc.type !== 'deletion') {
      throw invalidArgumentError(`Privacy request '${requestId}' is type '${privacyReqDoc.type}', not 'deletion'.`);
    }

    // Idempotency check: if already completed, return success immediately without re-processing
    if (privacyReqDoc.state === 'completed') {
      logger.info(`[processAccountDeletion] Request ${requestId} already marked completed. Idempotent return.`);
      return {
        success: true,
        targetUid: privacyReqDoc.target_uid || cleanTargetUid || 'already_processed',
        targetEmail: privacyReqDoc.email || cleanTargetEmail,
        message: 'Account deletion was already completed.',
        anonymizedAt: privacyReqDoc.completed_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        alreadyCompleted: true,
      };
    }

    const isPublicWeb = privacyReqDoc.source === 'public_web' || privacyReqDoc.requester_type === 'public_web';

    if (isPublicWeb) {
      // CRITICAL ISSUE 1: PUBLIC REQUEST TARGET RESOLUTION & VERIFICATION
      // A public deletion request MUST have its ownership verified before deletion
      const isVerified = privacyReqDoc.verification_status === 'verified';
      if (!isVerified) {
        throw failedPreconditionError(
          'Public account deletion request cannot be processed until account ownership is verified.'
        );
      }

      // Resolve the REAL user account by verified email
      const reqEmail = (privacyReqDoc.email || cleanTargetEmail).trim().toLowerCase();
      if (!reqEmail) {
        throw invalidArgumentError('Public deletion request does not contain a valid email address.');
      }

      let realAccountUid = '';
      try {
        const authUser = await auth.getUserByEmail(reqEmail);
        realAccountUid = authUser.uid;
      } catch (err: any) {
        // Fallback search in Firestore users collection
        const userQuery = await collections.users().where('email', '==', reqEmail).limit(1).get();
        if (!userQuery.empty) {
          realAccountUid = userQuery.docs[0].id;
        }
      }

      if (!realAccountUid) {
        throw notFoundError(`No registered user account found matching verified email '${reqEmail}'.`);
      }

      // INVARIANT: Never delete the anonymous requester UID
      const anonSubmitterUid = privacyReqDoc.anonymous_requester_uid || privacyReqDoc.user_id;
      if (cleanTargetUid === anonSubmitterUid && anonSubmitterUid !== realAccountUid) {
        logger.warn(`[processAccountDeletion] Target UID matched anonymous requester UID (${anonSubmitterUid}). Re-targeting to verified real account UID (${realAccountUid}).`);
      }

      cleanTargetUid = realAccountUid;
    } else {
      // In-app request:
      // Non-admins may ONLY process their own requests
      if (!isAdmin) {
        const docOwner = privacyReqDoc.user_id || privacyReqDoc.target_uid;
        if (docOwner && docOwner !== caller.uid) {
          throw permissionDeniedError('You are not authorized to process another user\'s deletion request.');
        }
        cleanTargetUid = caller.uid;
      } else {
        cleanTargetUid = privacyReqDoc.target_uid || privacyReqDoc.user_id || cleanTargetUid;
      }
    }
  } else {
    // Direct invocation without requestId:
    if (!isAdmin) {
      if (rawUid && rawUid !== caller.uid) {
        await collections.securityEvents().add({
          event: 'unauthorized_deletion_attempt',
          callerUid: caller.uid,
          targetUid: rawUid,
          createdAtMs: Date.now(),
        });
        throw permissionDeniedError('You are not authorized to delete another user\'s account.');
      }
      cleanTargetUid = caller.uid;
    } else if (!cleanTargetUid && cleanTargetEmail) {
      try {
        const authUser = await auth.getUserByEmail(cleanTargetEmail);
        cleanTargetUid = authUser.uid;
      } catch {
        const userQuery = await collections.users().where('email', '==', cleanTargetEmail).limit(1).get();
        if (!userQuery.empty) {
          cleanTargetUid = userQuery.docs[0].id;
        }
      }
    }
  }

  if (!cleanTargetUid) {
    throw invalidArgumentError('A valid target UID or identifiable registered user account is required.');
  }

  // Cross-account deletion authorization check
  const isSelf = caller.uid === cleanTargetUid;
  if (!isSelf && !isAdmin) {
    await collections.securityEvents().add({
      event: 'unauthorized_deletion_attempt',
      callerUid: caller.uid,
      targetUid: cleanTargetUid,
      createdAtMs: Date.now(),
    });
    throw permissionDeniedError('You are not authorized to delete another user\'s account.');
  }

  // Lock request state to 'processing' to prevent concurrent re-entrancy
  if (privacyReqRef) {
    await privacyReqRef.update({
      state: 'processing',
      target_uid: cleanTargetUid,
      processing_started_at: FieldValue.serverTimestamp(),
      processor_uid: caller.uid,
      updated_at: FieldValue.serverTimestamp(),
    });
  }

  const sanitizedLogId = cleanTargetUid.length > 8 ? `${cleanTargetUid.slice(0, 8)}***` : cleanTargetUid;
  logger.info(`[processAccountDeletion] Initiating deletion for targetUid=${sanitizedLogId} by caller=${caller.uid.slice(0, 8)}*** (isSelf=${isSelf}, isAdmin=${isAdmin})`);

  // --------------------------------------------------------------------------
  // STEP 1: CLOUD STORAGE FILE DELETION (VERIFIED)
  // --------------------------------------------------------------------------
  const bucket = bucketOverride || storage.bucket();
  const storagePrefixes = [
    `users/${cleanTargetUid}/`,
    `status_updates/${cleanTargetUid}/`,
    `assignment_submissions/${cleanTargetUid}/`,
  ];

  for (const prefix of storagePrefixes) {
    try {
      await bucket.deleteFiles({ prefix, force: true });
    } catch (err: any) {
      // 404 / Not Found / No such object is safe (empty directories or no uploads)
      const isNotFound = err?.code === 404 ||
        err?.message?.includes('Not Found') ||
        err?.message?.includes('No such object') ||
        err?.message?.includes('does not exist');

      if (!isNotFound) {
        logger.error(`[processAccountDeletion] Storage deletion failed for prefix ${prefix}`, err);
        if (privacyReqRef) {
          await privacyReqRef.update({
            state: 'failed',
            failure_step: 'storage_deletion',
            failure_reason: `Storage file deletion failed: ${err?.message || 'unknown'}`,
            updated_at: FieldValue.serverTimestamp(),
          }).catch(() => {});
        }
        throw internalError(`Failed to delete user storage files: ${err?.message || 'storage error'}`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // STEP 2: FIREBASE AUTHENTICATION DELETION (VERIFIED & IDEMPOTENT)
  // --------------------------------------------------------------------------
  try {
    await auth.deleteUser(cleanTargetUid);
    logger.info(`[processAccountDeletion] Firebase Auth user deleted for uid=${sanitizedLogId}`);
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') {
      // User was already deleted from Auth (e.g. on safe retry or previous attempt)
      logger.info(`[processAccountDeletion] User was already deleted from Firebase Auth for uid=${sanitizedLogId}`);
    } else {
      logger.error(`[processAccountDeletion] Firebase Auth deletion failed for uid=${sanitizedLogId}`, err);
      if (privacyReqRef) {
        await privacyReqRef.update({
          state: 'failed',
          failure_step: 'auth_deletion',
          failure_reason: `Firebase Auth deletion failed: ${err?.message || 'auth error'}`,
          updated_at: FieldValue.serverTimestamp(),
        }).catch(() => {});
      }
      throw internalError(`Failed to delete Firebase Auth user: ${err?.message || 'auth error'}`);
    }
  }

  // --------------------------------------------------------------------------
  // STEP 3: FIRESTORE PERSONAL DATA PURGE & ANONYMIZATION (ATOMIC BATCH)
  // --------------------------------------------------------------------------
  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  const nowIso = new Date().toISOString();

  // 3a. Anonymize user profile document in users/{targetUid}
  const userRef = collections.users().doc(cleanTargetUid);
  batch.set(
    userRef,
    {
      name: 'Deleted User',
      email: null,
      phone: null,
      guardian_name: null,
      guardian_phone: null,
      photo_url: null,
      avatar: null,
      fcm_tokens: [],
      expo_push_tokens: [],
      status: 'deleted',
      is_deleted: true,
      deleted_at: now,
      deletion_reason: reason,
      deleted_by: caller.uid,
    },
    { merge: true }
  );

  // 3b. Delete public profile
  batch.delete(db.collection('public_profiles').doc(cleanTargetUid));

  // 3c. Delete device tokens
  batch.delete(db.collection('user_tokens').doc(cleanTargetUid));

  // 3d. Delete online presence
  batch.delete(db.collection('presence').doc(cleanTargetUid));

  // 3e. Delete notification settings
  batch.delete(db.collection('user_notification_settings').doc(cleanTargetUid));

  // 3f. Delete subcollections (compliance records)
  batch.delete(db.collection('users').doc(cleanTargetUid).collection('compliance').doc('legal_acceptance'));

  // 3g. Update privacy request to COMPLETED ONLY AFTER Storage & Auth succeed
  if (privacyReqRef) {
    batch.update(privacyReqRef, {
      state: 'completed',
      target_uid: cleanTargetUid,
      completed_at: now,
      processed_by: caller.uid,
      updated_at: now,
      failure_step: FieldValue.delete(),
      failure_reason: FieldValue.delete(),
    });
  }

  // 3h. Record immutable administrative compliance audit log
  const auditLogRef = db.collection('admin_logs').doc();
  batch.set(auditLogRef, {
    action: 'account_deletion_completed',
    target_uid: cleanTargetUid,
    actor_uid: caller.uid,
    is_self: isSelf,
    reason,
    created_at: now,
    created_at_ms: Date.now(),
  });

  // Commit atomic batch
  await batch.commit();

  logger.info(`[processAccountDeletion] SUCCESS: Account deletion and data purge completed for uid=${sanitizedLogId}`);

  return {
    success: true,
    targetUid: cleanTargetUid,
    targetEmail: cleanTargetEmail,
    message: 'Account personal data successfully deleted and anonymized.',
    anonymizedAt: nowIso,
  };
}

/**
 * Public Cloud Function entrypoint.
 */
export const processAccountDeletion = onCall(
  {
    region: 'us-central1',
  },
  async (request: CallableRequest<ProcessDeletionRequest>): Promise<ProcessDeletionResponse> => {
    const caller = await requireAuthenticatedUser(request);
    return executeAccountDeletion(
      {
        uid: caller.uid,
        role: caller.role,
        email: caller.email,
      },
      request.data ?? {}
    );
  }
);
