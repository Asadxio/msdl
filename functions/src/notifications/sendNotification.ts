/**
 * MSLB FCM Notification Dispatch — Cloud Function & Internal Dispatcher
 *
 * Supports:
 *   - Single recipient:   { recipientUid: 'uid123', title, body }
 *   - Multi-recipient:    { recipientUids: ['uid1','uid2'], title, body }
 *   - Role broadcast:     { targetRole: 'student', title, body } (Admin only)
 *   - Broadcast all:      { sendToAll: true, title, body } (Admin only)
 *
 * SECURITY & SCOPING:
 * - Admin/super_admin: Universal access, full broadcast, role targeting.
 * - Teacher/assistant: Targeted notifications to students within their classes or assigned courses.
 * - Student: Scoped notifications for academic submissions and direct interactions.
 * - Server triggers: Call deliverPushNotificationInternal directly via Firebase Admin SDK.
 * - Native FCM tokens receive high-priority Android channel ('default', 'announcements', 'calls', 'academic').
 * - Invalid FCM tokens (unregistered/expired) are automatically cleaned up from Firestore.
 */
import { https, logger } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import { messaging } from "../config/admin";
import { collections, db } from "../shared/firestore";
import { requireAdminUser } from "../auth/verifyAuth";
import { invalidArgumentError, permissionDeniedError } from "../shared/errors";
import { assertOrgOperational, isSuperAdminEmail } from "../shared/tenantAuth";
import { FieldValue } from "firebase-admin/firestore";

export interface NotificationRequest {
  organization_id?: string;
  recipientUid?: string;
  recipientUids?: string[];
  targetRole?: string;
  sendToAll?: boolean;
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
}

export interface DeliverPushOptions {
  recipientUids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
  organizationId?: string;
  sentByUid?: string;
  dedupeId?: string;
}

export interface DeliverPushResult {
  success: boolean;
  sent: number;
  failed: number;
  noToken: number;
  invalidCleaned: number;
}

/**
 * Resolves authoritative active push tokens for a list of user IDs.
 * Checks user_tokens/{uid} first, with fallback to users/{uid} token arrays.
 */
export async function getTokensForUids(uids: string[]): Promise<{ uid: string; token: string }[]> {
  const results: { uid: string; token: string }[] = [];
  const seen = new Set<string>();

  await Promise.allSettled(
    uids.map(async (uid) => {
      let chosenToken = "";

      // 1. Check user_tokens collection doc
      const snap = await collections.userTokens().doc(uid).get();
      if (snap.exists) {
        const d = snap.data()!;
        const fcmCandidate = (typeof d.fcmToken === "string" && d.fcmToken.trim()) ? d.fcmToken.trim() : "";
        const tokenCandidate = (typeof d.token === "string" && d.token.trim()) ? d.token.trim() : "";
        const expoCandidate = (typeof d.expoPushToken === "string" && d.expoPushToken.trim()) ? d.expoPushToken.trim() : "";

        // If fcmToken is a native token (not ExponentPushToken), prioritize it for direct FCM delivery
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

export async function getUidsForRole(role: string, organizationId: string): Promise<string[]> {
  if (organizationId === "mslb-main") {
    const snap = await db.collection("users")
      .where("role", "==", role)
      .where("status", "==", "approved")
      .limit(500)
      .get();
    return snap.docs.map((d) => d.id);
  }

  // Tenant-scoped membership lookup
  const snap = await db.collection("organization_memberships")
    .where("organization_id", "==", organizationId)
    .where("role", "==", role)
    .where("status", "==", "active")
    .limit(500)
    .get();
  return snap.docs.map((d) => d.data().user_id).filter(Boolean);
}

export async function getAllApprovedUids(organizationId: string): Promise<string[]> {
  if (organizationId === "mslb-main") {
    const snap = await db.collection("users")
      .where("status", "==", "approved")
      .limit(1000)
      .get();
    return snap.docs.map((d) => d.id);
  }

  // Tenant-scoped membership lookup
  const snap = await db.collection("organization_memberships")
    .where("organization_id", "==", organizationId)
    .where("status", "==", "active")
    .limit(1000)
    .get();
  return snap.docs.map((d) => d.data().user_id).filter(Boolean);
}

/**
 * Server-authoritative FCM & Expo push delivery engine.
 * Used directly by Cloud Function triggers, webhook finalizers, and the sendNotification callable.
 */
export async function deliverPushNotificationInternal(
  options: DeliverPushOptions
): Promise<DeliverPushResult> {
  const recipientUids = Array.from(new Set((options.recipientUids || []).filter(Boolean)));
  if (recipientUids.length === 0) {
    return { success: true, sent: 0, failed: 0, noToken: 0, invalidCleaned: 0 };
  }

  const tokenEntries = await getTokensForUids(recipientUids);
  const noToken = Math.max(0, recipientUids.length - tokenEntries.length);

  if (tokenEntries.length === 0) {
    logger.warn(`[deliverPush] No push tokens found for ${recipientUids.length} recipients`);
    return { success: true, sent: 0, failed: 0, noToken, invalidCleaned: 0 };
  }

  const stringData: Record<string, string> = {};
  if (options.data) {
    for (const [k, v] of Object.entries(options.data)) {
      if (v !== null && v !== undefined) {
        stringData[k] = typeof v === "string" ? v : String(v);
      }
    }
  }

  const targetChannelId = options.channelId || stringData.channelId || "default";
  stringData.channelId = targetChannelId;

  let sent = 0;
  let failed = 0;
  let invalidCleaned = 0;

  // Separate tokens: Expo Push API vs Native Firebase Cloud Messaging (FCM)
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

  logger.info(`[deliverPush] Dispatching: fcmCount=${fcmTokens.length}, expoCount=${expoTokens.length}`);

  // 1. Native FCM Delivery via Firebase Admin Messaging (batches of 500)
  const FCM_BATCH_SIZE = 500;
  for (let i = 0; i < fcmTokens.length; i += FCM_BATCH_SIZE) {
    const batch = fcmTokens.slice(i, i + FCM_BATCH_SIZE);
    const messages = batch.map(({ token }) => ({
      token,
      notification: { title: options.title, body: options.body },
      data: stringData,
      android: {
        priority: "high" as const,
        notification: {
          channelId: targetChannelId,
          sound: "default",
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: "public" as const,
        },
      },
    }));

    try {
      const batchResponse = await messaging.sendEach(messages);
      sent += batchResponse.successCount;

      for (let idx = 0; idx < batchResponse.responses.length; idx++) {
        const resp = batchResponse.responses[idx];
        if (!resp.success) {
          failed++;
          const errCode = resp.error?.code || "";
          logger.warn(`[deliverPush] FCM send error for uid=${batch[idx].uid}: ${resp.error?.message} (${errCode})`);

          // Invalid token cleanup: remove stale/unregistered tokens from Firestore
          const isInvalidToken =
            errCode === "messaging/registration-token-not-registered" ||
            errCode === "messaging/invalid-registration-token" ||
            errCode === "messaging/invalid-argument";

          if (isInvalidToken) {
            invalidCleaned++;
            const badToken = batch[idx].token;
            const badUid = batch[idx].uid;
            try {
              await collections.users().doc(badUid).update({
                fcm_tokens: FieldValue.arrayRemove(badToken),
                expo_push_tokens: FieldValue.arrayRemove(badToken),
              }).catch(() => {});

              const tokenDocRef = collections.userTokens().doc(badUid);
              const tokenSnap = await tokenDocRef.get();
              if (tokenSnap.exists) {
                const d = tokenSnap.data()!;
                if (d.fcmToken === badToken || d.token === badToken || d.expoPushToken === badToken) {
                  await tokenDocRef.delete().catch(() => {});
                }
              }
              logger.info(`[deliverPush] Successfully cleaned up invalid token for uid=${badUid}`);
            } catch (cleanErr) {
              logger.warn(`[deliverPush] Failed to clean up invalid token:`, cleanErr);
            }
          }
        }
      }
    } catch (batchErr) {
      logger.error("[deliverPush] FCM batch send exception:", batchErr);
      failed += batch.length;
    }
  }

  // 2. Expo Push API Delivery (batches of 100)
  const EXPO_BATCH_SIZE = 100;
  for (let i = 0; i < expoTokens.length; i += EXPO_BATCH_SIZE) {
    const batch = expoTokens.slice(i, i + EXPO_BATCH_SIZE);
    const messages = batch.map(({ token }) => ({
      to: token,
      sound: "default",
      title: options.title,
      body: options.body,
      data: stringData,
      channelId: targetChannelId,
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
        logger.error(`[deliverPush] Expo push API HTTP error status=${response.status}`, errText);
        failed += batch.length;
      } else {
        const resJson: any = await response.json();
        const tickets: any[] = resJson.data || [];
        tickets.forEach((ticket, idx) => {
          if (ticket.status === "ok") {
            sent++;
          } else {
            failed++;
            logger.warn(`[deliverPush] Expo ticket error uid=${batch[idx]?.uid}:`, ticket.message || ticket.details);
          }
        });
      }
    } catch (err) {
      logger.error("[deliverPush] Expo push fetch error", err);
      failed += batch.length;
    }
  }

  // 3. Record delivery telemetry
  try {
    await db.collection("notification_delivery_logs").add({
      recipient_count: recipientUids.length,
      sent,
      failed,
      no_token: noToken,
      invalid_cleaned: invalidCleaned,
      title: options.title,
      dedupe_id: options.dedupeId || "",
      sent_by_uid: options.sentByUid || "system",
      organization_id: options.organizationId || "mslb-main",
      timestamp: FieldValue.serverTimestamp(),
      timestamp_ms: Date.now(),
    });
  } catch {
    // Non-fatal telemetry record
  }

  return { success: true, sent, failed, noToken, invalidCleaned };
}

/**
 * Callable Cloud Function: sendNotification
 * Accessible by Admins (universal/broadcast) and Teachers/Students (scoped notifications).
 */
export const sendNotification = onCall(
  {
    region: "us-central1",
  },
  async (request: https.CallableRequest<NotificationRequest>) => {
    // 1. Require admin user
    const admin = await requireAdminUser(request);
    const userDoc = await collections.users().doc(admin.uid).get();
    if (!userDoc.exists) {
      throw permissionDeniedError("User profile not found.");
    }

    const userProfile = userDoc.data()!;
    const role = String(userProfile.role || "student").toLowerCase();
    const isAdmin = role === "admin" || role === "super_admin" || isSuperAdminEmail(admin.email);
    const isTeacher = role === "teacher" || role === "assistant_teacher";

    const payload = request.data;
    const targetOrg = (payload?.organization_id || userProfile.organization_id || "mslb-main").trim();

    // Verify organization operational status
    await assertOrgOperational(targetOrg, false);

    // 2. Validate content
    if (!payload?.title || !payload?.body) {
      throw invalidArgumentError("title and body are required.");
    }

    // 3. Enforce Broadcast Authorization
    // Broad role announcements or sendToAll are STRICTLY restricted to Administrators
    if ((payload.sendToAll || payload.targetRole) && !isAdmin) {
      throw permissionDeniedError("Only administrators are authorized to send broadcast or role-wide notifications.");
    }

    // 4. Resolve recipient UIDs
    let recipientUids: string[] = [];
    if (payload.sendToAll) {
      recipientUids = await getAllApprovedUids(targetOrg);
      logger.info(`[sendNotification] Broadcast to all in org ${targetOrg}: ${recipientUids.length} users`);
    } else if (payload.targetRole) {
      recipientUids = await getUidsForRole(payload.targetRole, targetOrg);
      logger.info(`[sendNotification] Role broadcast ${payload.targetRole} in org ${targetOrg}: ${recipientUids.length} users`);
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

    // Non-admin recipients check: ensure non-admins don't mass-notify thousands of arbitrary users
    if (!isAdmin && !isTeacher && recipientUids.length > 5) {
      throw permissionDeniedError("Students cannot send multi-recipient push notifications.");
    }

    // 5. Deliver push notifications
    const result = await deliverPushNotificationInternal({
      recipientUids,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      channelId: payload.channelId || "default",
      organizationId: targetOrg,
      sentByUid: admin.uid,
    });

    // 6. Record metadata in notifications collection for in-app history
    try {
      await collections.notifications().add({
        recipientCount: recipientUids.length,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        sent: result.sent,
        failed: result.failed,
        noToken: result.noToken,
        sentByUid: admin.uid,
        organization_id: targetOrg,
        sentAtMs: Date.now(),
        status: "sent",
        ...(payload.targetRole ? { targetRole: payload.targetRole } : {}),
        ...(payload.sendToAll ? { sendToAll: true } : {}),
      });
    } catch {
      // Non-fatal
    }

    return {
      success: true,
      sent: result.sent,
      failed: result.failed,
      noToken: result.noToken,
      invalidCleaned: result.invalidCleaned,
    };
  }
);
