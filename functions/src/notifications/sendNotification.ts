/**
 * MSLB FCM Notification Dispatch — Cloud Function
 * 
 * PHASE 1: Foundation / Architecture only.
 * Sending to production users is gated by admin authorization.
 * 
 * This function:
 * 1. Verifies the caller is an admin.
 * 2. Looks up the recipient FCM token from Firestore.
 * 3. Sends a notification via Firebase Admin Messaging.
 * 4. Records delivery metadata in Firestore.
 * 
 * SECURITY:
 * - Only admin/super_admin callers may send arbitrary notifications.
 * - FCM tokens are stored in Firestore user_tokens collection (server trust boundary).
 * - Clients cannot spoof recipient or message content without admin role.
 */
import { https, logger } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import { messaging } from "../config/admin";
import { collections } from "../shared/firestore";
import { requireAdminUser } from "../auth/verifyAuth";
import { invalidArgumentError, notFoundError, internalError } from "../shared/errors";
import type { NotificationPayload } from "../shared/types";

export const sendNotification = onCall(
  {
    region: "us-central1",
    // TODO (Phase 6): Enable App Check enforcement
    // enforceAppCheck: true,
  },
  async (request: https.CallableRequest<NotificationPayload>) => {
    // 1. Require admin authorization
    const admin = await requireAdminUser(request);
    logger.info(`[sendNotification] Called by admin uid=${admin.uid}`);

    const payload = request.data;

    // 2. Validate payload
    if (!payload?.recipientUid || !payload?.title || !payload?.body) {
      throw invalidArgumentError("recipientUid, title, and body are required.");
    }

    // 3. Look up FCM token from Firestore
    const tokenSnap = await collections.userTokens().doc(payload.recipientUid).get();
    if (!tokenSnap.exists) {
      throw notFoundError(`No FCM token registered for user: ${payload.recipientUid}`);
    }

    const tokenData = tokenSnap.data()!;
    const fcmToken: string = tokenData.token ?? tokenData.fcmToken ?? "";
    if (!fcmToken) {
      throw notFoundError("FCM token value is empty.");
    }

    // 4. Send notification via Firebase Admin Messaging
    try {
      const messageId = await messaging.send({
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data ?? {},
        android: {
          priority: "high",
        },
      });

      logger.info(`[sendNotification] Sent messageId=${messageId} to uid=${payload.recipientUid}`);

      // 5. Record delivery metadata
      await collections.notifications().add({
        recipientUid: payload.recipientUid,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        messageId,
        sentByUid: admin.uid,
        sentAtMs: Date.now(),
        status: "sent",
      });

      return { success: true, messageId };
    } catch (err) {
      logger.error("[sendNotification] FCM send failed", err);
      throw internalError("Failed to send notification.");
    }
  }
);
