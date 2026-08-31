import { https, logger } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import { collections } from "../shared/firestore";
import { requireAuthenticatedUser } from "../auth/verifyAuth";
import { invalidArgumentError, notFoundError, resourceExhaustedError } from "../shared/errors";
import { FieldValue, Transaction, DocumentSnapshot, DocumentData } from "firebase-admin/firestore";
import { db } from "../config/admin";

interface ReactToStatusRequest {
  statusId: string;
  reaction: string;
}

export const reactToStatus = onCall(
  { region: "us-central1" },
  async (request: https.CallableRequest<ReactToStatusRequest>) => {
    const user = await requireAuthenticatedUser(request);
    const { statusId, reaction } = request.data || {};

    if (!statusId) {
      throw invalidArgumentError("statusId is required.");
    }

    if (!["❤️", "🔥", "👏"].includes(reaction)) {
      throw invalidArgumentError("Unsupported reaction type.");
    }

    const uid = user.uid;

    // Rate limiting: check recent reactions by this user
    const rateLimitRef = db.collection("status_rate_limits").doc(`react:${uid}`);

    await db.runTransaction(async (transaction: Transaction) => {
      const rateDoc: DocumentSnapshot<DocumentData> = await transaction.get(rateLimitRef);
      const now = Date.now();

      if (rateDoc.exists) {
        const data = rateDoc.data();
        if (data && now - (data.lastReactAtMs || 0) < 1000) {
          throw resourceExhaustedError("Reaction throttled.");
        }
      }

      const statusRef = collections.statusUpdates().doc(statusId);
      const statusDoc: DocumentSnapshot<DocumentData> = await transaction.get(statusRef);

      if (!statusDoc.exists) {
        throw notFoundError("Status not found.");
      }

      const statusData = statusDoc.data();
      if (statusData?.status === "invalid" || statusData?.status === "reactivated") {
        throw invalidArgumentError("Cannot react to an invalid or reactivated status.");
      }

      const reactionRef = statusRef.collection("reactions").doc(uid);
      const prevReactionDoc: DocumentSnapshot<DocumentData> = await transaction.get(reactionRef);

      let prevReaction = "";
      if (prevReactionDoc.exists) {
        prevReaction = prevReactionDoc.data()?.reaction || "";
      }

      const updates: Record<string, any> = {};

      if (prevReaction && prevReaction !== reaction) {
        updates[`reaction_counts.${prevReaction}`] = FieldValue.increment(-1);
      }
      if (prevReaction !== reaction) {
        updates[`reaction_counts.${reaction}`] = FieldValue.increment(1);
      }

      transaction.set(rateLimitRef, { lastReactAtMs: now, uid });

      if (Object.keys(updates).length > 0) {
        transaction.update(statusRef, updates);
        transaction.set(reactionRef, {
          reaction,
          user_id: uid,
          updated_at: FieldValue.serverTimestamp()
        }, { merge: true });
      }
    });

    logger.info(`[reactToStatus] User ${uid} reacted ${reaction} to status ${statusId}`);

    return { success: true };
  }
);
