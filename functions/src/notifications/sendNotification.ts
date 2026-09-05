/**
 * MSLB FCM Notification Dispatch — Cloud Function
 *
 * Supports:
 *   - Single recipient:   { recipientUid: 'uid123', title, body }
 *   - Multi-recipient:    { recipientUids: ['uid1','uid2'], title, body }
 *   - Role broadcast:     { targetRole: 'student', title, body }
 *   - Broadcast all:      { sendToAll: true, title, body }
 *
 * SECURITY:
 * - Only admin/super_admin callers may invoke this function.
 * - FCM tokens are read from Firestore (server-side) — never client-provided.
 * - Clients cannot inject arbitrary recipients or message content.
 */
import { https, logger } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import { messaging } from "../config/admin";
import { collections, db } from "../shared/firestore";
import { requireAdminUser } from "../auth/verifyAuth";
import { invalidArgumentError } from "../shared/errors";

interface NotificationRequest {
  // Single recipient (legacy, backward-compatible)
  recipientUid?: string;
  // Multi-recipient
  recipientUids?: string[];
  // Role-targeted (e.g., 'student', 'teacher')
  targetRole?: string;
  // Broadcast to all approved users
  sendToAll?: boolean;
  // Message content
  title: string;
  body: string;
  data?: Record<string, string>;
}

async function getTokensForUids(uids: string[]): Promise<{ uid: string; token: string }[]> {
  const results: { uid: string; token: string }[] = [];
  await Promise.allSettled(
    uids.map(async (uid) => {
      const snap = await collections.userTokens().doc(uid).get();
      if (!snap.exists) return;
      const d = snap.data()!;
      const token: string = d.token ?? d.fcmToken ?? "";
      if (token) results.push({ uid, token });
    })
  );
  return results;
}

async function getUidsForRole(role: string): Promise<string[]> {
  const snap = await db.collection("users")
    .where("role", "==", role)
    .where("status", "==", "approved")
    .limit(500)
    .get();
  return snap.docs.map((d) => d.id);
}

async function getAllApprovedUids(): Promise<string[]> {
  const snap = await db.collection("users")
    .where("status", "==", "approved")
    .limit(1000)
    .get();
  return snap.docs.map((d) => d.id);
}

export const sendNotification = onCall(
  {
    region: "us-central1",
    // TODO (Phase 6): Enable App Check enforcement after Play Integrity configuration
    // enforceAppCheck: true,
  },
  async (request: https.CallableRequest<NotificationRequest>) => {
    // 1. Require admin authorization
    const admin = await requireAdminUser(request);
    logger.info(`[sendNotification] Called by admin uid=${admin.uid}`);

    const payload = request.data;

    // 2. Validate content
    if (!payload?.title || !payload?.body) {
      throw invalidArgumentError("title and body are required.");
    }

    // 3. Determine recipient UIDs
    let recipientUids: string[] = [];
    if (payload.sendToAll) {
      recipientUids = await getAllApprovedUids();
      logger.info(`[sendNotification] Broadcast to all: ${recipientUids.length} users`);
    } else if (payload.targetRole) {
      recipientUids = await getUidsForRole(payload.targetRole);
      logger.info(`[sendNotification] Role broadcast ${payload.targetRole}: ${recipientUids.length} users`);
    } else if (payload.recipientUids && payload.recipientUids.length > 0) {
      recipientUids = payload.recipientUids.filter((u) => u && typeof u === "string");
    } else if (payload.recipientUid) {
      recipientUids = [payload.recipientUid];
    } else {
      throw invalidArgumentError("recipientUid, recipientUids, targetRole, or sendToAll is required.");
    }

    if (recipientUids.length === 0) {
      return { success: true, sent: 0, failed: 0, noToken: 0 };
    }

    // 4. Fetch FCM tokens for all recipients
    const tokenEntries = await getTokensForUids(recipientUids);
    const noToken = recipientUids.length - tokenEntries.length;

    if (tokenEntries.length === 0) {
      logger.warn(`[sendNotification] No FCM tokens found for ${recipientUids.length} recipients`);
      return { success: true, sent: 0, failed: 0, noToken };
    }

    // 5. Send via Firebase Admin Messaging (batched, max 500 per call)
    const messageData: Record<string, string> = {};
    if (payload.data) {
      for (const [k, v] of Object.entries(payload.data)) {
        if (typeof v === "string") messageData[k] = v;
      }
    }

    let sent = 0;
    let failed = 0;
    const BATCH_SIZE = 500;

    for (let i = 0; i < tokenEntries.length; i += BATCH_SIZE) {
      const batch = tokenEntries.slice(i, i + BATCH_SIZE);
      const messages = batch.map(({ token }) => ({
        token,
        notification: { title: payload.title, body: payload.body },
        data: messageData,
        android: { priority: "high" as const },
      }));

      try {
        const batchResponse = await messaging.sendEach(messages);
        sent += batchResponse.successCount;
        failed += batchResponse.failureCount;

        // Log per-token failures (invalid tokens, etc.)
        batchResponse.responses.forEach((resp, idx) => {
          if (!resp.success) {
            logger.warn(`[sendNotification] Token failed uid=${batch[idx].uid}`, resp.error?.message);
          }
        });
      } catch (err) {
        logger.error("[sendNotification] Batch send failed", err);
        failed += batch.length;
      }
    }

    // 6. Record delivery metadata
    try {
      await collections.notifications().add({
        recipientCount: recipientUids.length,
        title: payload.title,
        body: payload.body,
        data: messageData,
        sent,
        failed,
        noToken,
        sentByUid: admin.uid,
        sentAtMs: Date.now(),
        status: "sent",
        ...(payload.targetRole ? { targetRole: payload.targetRole } : {}),
        ...(payload.sendToAll ? { sendToAll: true } : {}),
      });
    } catch (err) {
      logger.error("[sendNotification] Failed to record delivery metadata", err);
      // Non-fatal
    }

    logger.info(`[sendNotification] Complete: sent=${sent} failed=${failed} noToken=${noToken}`);
    return { success: true, sent, failed, noToken };
  }
);
