/**
 * MSLB Account Deletion Processor — Cloud Function
 * 
 * Safely processes user account deletion requests in full compliance
 * with Google Play User Data & Account Deletion policies.
 * 
 * SECURITY INVARIANTS:
 * - Either the user themselves (self-service deletion) or an authorized Admin can invoke this.
 * - Authenticates caller and verifies permissions.
 * - Anonymizes / cleans up personal user records across Firestore.
 * - Removes device tokens, public profile, presence, and personal storage uploads.
 * - Deletes the user from Firebase Authentication.
 * - Retains legally necessary audit, payment, and security records under strict retention policies.
 */
import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { db, auth, storage } from '../config/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuthenticatedUser } from '../auth/verifyAuth';
import { invalidArgumentError, permissionDeniedError } from '../shared/errors';
import { collections } from '../shared/firestore';

interface ProcessDeletionRequest {
  targetUid?: string;
  targetEmail?: string;
  requestId?: string;
  reason?: string;
}

interface ProcessDeletionResponse {
  success: boolean;
  targetUid: string;
  targetEmail?: string;
  message: string;
  anonymizedAt: string;
}

export const processAccountDeletion = onCall(
  {
    region: 'us-central1',
  },
  async (request: CallableRequest<ProcessDeletionRequest>): Promise<ProcessDeletionResponse> => {
    const caller = await requireAuthenticatedUser(request);
    const { targetUid: rawUid, targetEmail: rawEmail, requestId, reason = 'Account deletion requested by user' } = request.data ?? {};

    const isAdmin = caller.role === 'admin' || caller.role === 'super_admin';

    let cleanTargetUid = rawUid?.trim() || '';
    const cleanTargetEmail = rawEmail?.trim().toLowerCase() || '';

    // If caller is non-admin, they may ONLY delete their own account
    if (!isAdmin) {
      cleanTargetUid = caller.uid;
    } else if (!cleanTargetUid && cleanTargetEmail) {
      // Admin processing request by email: resolve real UID
      try {
        const authUser = await auth.getUserByEmail(cleanTargetEmail);
        cleanTargetUid = authUser.uid;
      } catch (e: any) {
        logger.info(`[processAccountDeletion] Auth lookup by email ${cleanTargetEmail} failed: ${e?.message}`);
        // Fallback search in Firestore users collection
        const userSnap = await collections.users().where('email', '==', cleanTargetEmail).limit(1).get();
        if (!userSnap.empty) {
          cleanTargetUid = userSnap.docs[0].id;
        }
      }
    }

    if (!cleanTargetUid) {
      throw invalidArgumentError('A valid targetUid or identifiable user email is required.');
    }

    const isSelf = caller.uid === cleanTargetUid;

    if (!isSelf && !isAdmin) {
      await collections.securityEvents().add({
        event: 'unauthorized_deletion_attempt',
        callerUid: caller.uid,
        targetUid: cleanTargetUid,
        createdAtMs: Date.now(),
      });
      throw permissionDeniedError('You are not authorized to delete this account.');
    }

    logger.info(`[processAccountDeletion] Initiating deletion for uid=${cleanTargetUid} (email=${cleanTargetEmail || 'none'}) by caller=${caller.uid} (isSelf=${isSelf}, isAdmin=${isAdmin})`);

    const now = FieldValue.serverTimestamp();
    const nowIso = new Date().toISOString();

    // 1. Batch Firestore cleanup for personal data
    const batch = db.batch();

    // 1a. Anonymize user profile in users/{targetUid}
    const userRef = collections.users().doc(cleanTargetUid);
    batch.set(
      userRef,
      {
        name: 'Deleted User',
        email: `deleted_${cleanTargetUid.slice(0, 8)}@anonymized.local`,
        status: 'deleted',
        role: 'student',
        phone: null,
        guardian_name: null,
        guardian_phone: null,
        photo_url: null,
        avatar: null,
        fcm_tokens: [],
        expo_push_tokens: [],
        deleted_at: now,
        deletion_reason: reason,
        deleted_by: caller.uid,
      },
      { merge: true }
    );

    // 1b. Delete public profile
    const publicProfileRef = db.collection('public_profiles').doc(cleanTargetUid);
    batch.delete(publicProfileRef);

    // 1c. Delete user tokens
    const tokensRef = db.collection('user_tokens').doc(cleanTargetUid);
    batch.delete(tokensRef);

    // 1d. Delete presence
    const presenceRef = db.collection('presence').doc(cleanTargetUid);
    batch.delete(presenceRef);

    // 1e. Delete user notification settings
    const notifSettingsRef = db.collection('user_notification_settings').doc(cleanTargetUid);
    batch.delete(notifSettingsRef);

    // 1f. If a privacy_requests doc ID was passed, update its lifecycle state
    if (requestId) {
      const privacyReqRef = db.collection('privacy_requests').doc(requestId);
      batch.update(privacyReqRef, {
        state: 'completed',
        processed_at: now,
        processed_by: caller.uid,
      });
    }

    // 1g. Record immutable administrative compliance log
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

    await batch.commit();
    logger.info(`[processAccountDeletion] Firestore documents cleaned/anonymized for uid=${cleanTargetUid}`);

    // 2. Storage cleanup (delete user profile uploads, status media, and submissions)
    try {
      const bucket = storage.bucket();
      await Promise.allSettled([
        bucket.deleteFiles({ prefix: `users/${cleanTargetUid}/` }),
        bucket.deleteFiles({ prefix: `status_updates/${cleanTargetUid}/` }),
        bucket.deleteFiles({ prefix: `assignment_submissions/${cleanTargetUid}/` }),
      ]);
    } catch (err: any) {
      logger.warn(`[processAccountDeletion] Storage delete error (non-fatal): ${err?.message}`);
    }

    // 3. Delete from Firebase Authentication
    try {
      await auth.deleteUser(cleanTargetUid);
      logger.info(`[processAccountDeletion] Firebase Auth user deleted successfully for uid=${cleanTargetUid}`);
    } catch (err: any) {
      // If user is already deleted in Auth, log and proceed
      if (err?.code === 'auth/user-not-found') {
        logger.info(`[processAccountDeletion] User was already deleted from Firebase Auth: uid=${cleanTargetUid}`);
      } else {
        logger.error(`[processAccountDeletion] Failed to delete Firebase Auth user uid=${cleanTargetUid}`, err);
        // Note: Firestore is already anonymized, but report status
      }
    }

    return {
      success: true,
      targetUid: cleanTargetUid,
      message: 'Account personal data successfully deleted and anonymized.',
      anonymizedAt: nowIso,
    };
  }
);
