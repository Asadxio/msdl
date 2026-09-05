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
  const seen = new Set<string>();

  await Promise.allSettled(
    uids.map(async (uid) => {
      let chosenToken = "";

      // 1. Check user_tokens collection doc
      const snap = await collections.userTokens().doc(uid).get();
      if (snap.exists) {
        const d = snap.data()!;
        // Prefer native FCM token directly because Firebase Admin can deliver directly to Android without Expo FCM credentials
        const fcmCandidate = (typeof d.fcmToken === "string" && d.fcmToken.trim()) ? d.fcmToken.trim() : "";
        const tokenCandidate = (typeof d.token === "string" && d.token.trim()) ? d.token.trim() : "";
        const expoCandidate = (typeof d.expoPushToken === "string" && d.expoPushToken.trim()) ? d.expoPushToken.trim() : "";

        // If fcmToken is a native token (not ExponentPushToken), use it first!
        if (fcmCandidate && !fcmCandidate.startsWith("ExponentPushToken[") && !fcmCandidate.startsWith("ExpoPushToken[")) {
          chosenToken = fcmCandidate;
        } else if (tokenCandidate && !tokenCandidate.startsWith("ExponentPushToken[") && !tokenCandidate.startsWith("ExpoPushToken[")) {
          chosenToken = tokenCandidate;
        } else if (expoCandidate) {
          chosenToken = expoCandidate;
        } else if (tokenCandidate) {
          chosenToken = tokenCandidate;
        }
      }

      // 2. Fallback: check users collection doc (fcm_tokens / expo_push_tokens)
      if (!chosenToken || chosenToken.startsWith("ExponentPushToken[") || chosenToken.startsWith("ExpoPushToken[")) {
        const userDoc = await collections.users().doc(uid).get();
        if (userDoc.exists) {
          const uData = userDoc.data()!;
          const fcmList: string[] = Array.isArray(uData.fcm_tokens) ? uData.fcm_tokens : [];
          const expoList: string[] = Array.isArray(uData.expo_push_tokens) ? uData.expo_push_tokens : [];

          // Look for any native FCM token first
          const nativeFcm = fcmList.find((t) => typeof t === "string" && t.trim() && !t.startsWith("ExponentPushToken[") && !t.startsWith("ExpoPushToken["));
          if (nativeFcm) {
            chosenToken = nativeFcm.trim();
          } else if (!chosenToken) {
            const anyToken = [...expoList, ...fcmList].find((t) => typeof t === "string" && t.trim());
            if (anyToken) chosenToken = anyToken.trim();
          }
        }
      }

      if (chosenToken && !seen.has(chosenToken)) {
        seen.add(chosenToken);
        results.push({ uid, token: chosenToken });
      }
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

    // 4. Fetch push tokens for all recipients (both user_tokens doc and users doc)
    const tokenEntries = await getTokensForUids(recipientUids);
    const noToken = recipientUids.length - tokenEntries.length;

    if (tokenEntries.length === 0) {
      logger.warn(`[sendNotification] No push tokens found for ${recipientUids.length} recipients`);
      return { success: true, sent: 0, failed: 0, noToken };
    }

    const messageData: Record<string, string> = {};
    if (payload.data) {
      for (const [k, v] of Object.entries(payload.data)) {
        if (typeof v === "string") messageData[k] = v;
      }
    }

    let sent = 0;
    let failed = 0;

    // Separate tokens by provider: Expo Push API vs Native Firebase Cloud Messaging (FCM)
    const expoTokens: { uid: string; token: string }[] = [];
    const fcmTokens: { uid: string; token: string }[] = [];

    for (const entry of tokenEntries) {
      const t = entry.token.trim();
      if (t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken[")) {
        expoTokens.push({ uid: entry.uid, token: t });
      } else {
        fcmTokens.push({ uid: entry.uid, token: t });
      }
    }

    logger.info(`[sendNotification] Dispatching: expoCount=${expoTokens.length}, fcmCount=${fcmTokens.length}`);

    // 5A. Send Expo Push tokens via Expo Push API (batched in chunks of 100)
    const EXPO_BATCH_SIZE = 100;
    for (let i = 0; i < expoTokens.length; i += EXPO_BATCH_SIZE) {
      const batch = expoTokens.slice(i, i + EXPO_BATCH_SIZE);
      const messages = batch.map(({ token }) => ({
        to: token,
        sound: "default",
        title: payload.title,
        body: payload.body,
        data: messageData,
        channelId: messageData.channelId || "default",
        priority: "high",
      }));

      try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messages),
        });

        if (!response.ok) {
          const errText = await response.text();
          logger.error(`[sendNotification] Expo push API HTTP error status=${response.status}`, errText);
          failed += batch.length;
        } else {
          const resJson: any = await response.json();
          const tickets: any[] = resJson.data || [];
          tickets.forEach((ticket, idx) => {
            if (ticket.status === "ok") {
              sent++;
            } else {
              failed++;
              logger.warn(`[sendNotification] Expo ticket error uid=${batch[idx]?.uid}:`, ticket.message || ticket.details);
            }
          });
        }
      } catch (err) {
        logger.error("[sendNotification] Expo push fetch error", err);
        failed += batch.length;
      }
    }

    // 5B. Send Native FCM tokens via Firebase Admin Messaging (batched in chunks of 500)
    const FCM_BATCH_SIZE = 500;
    for (let i = 0; i < fcmTokens.length; i += FCM_BATCH_SIZE) {
      const batch = fcmTokens.slice(i, i + FCM_BATCH_SIZE);
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

        batchResponse.responses.forEach((resp, idx) => {
          if (!resp.success) {
            logger.warn(`[sendNotification] FCM token failed uid=${batch[idx].uid}:`, resp.error?.message);
          }
        });
      } catch (err) {
        logger.error("[sendNotification] FCM batch send failed", err);
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
        expoCount: expoTokens.length,
        fcmCount: fcmTokens.length,
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
