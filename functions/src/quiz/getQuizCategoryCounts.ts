/**
 * MSLB Get Quiz Category Counts — Cloud Function
 *
 * Returns question counts for ALL quiz categories in a SINGLE Firestore query.
 * This replaces 44 individual getCountFromServer() calls on the client, reducing
 * quiz screen load time from ~8 seconds to under 1 second.
 *
 * Strategy: Fetch all quiz documents (category field only), aggregate counts in
 * memory server-side. One round-trip instead of 44.
 */
import { https, logger } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import { db } from "../config/admin";
import { requireAuthenticatedUser } from "../auth/verifyAuth";
import { internalError } from "../shared/errors";

interface GetQuizCategoryCountsRequest {
  organization_id?: string;
}

interface GetQuizCategoryCountsResponse {
  counts: Record<string, number>;
  /** Unix ms — client uses this to know when cache expires */
  fetchedAt: number;
}

export const getQuizCategoryCounts = onCall(
  {
    region: "us-central1",
  },
  async (
    request: https.CallableRequest<GetQuizCategoryCountsRequest>
  ): Promise<GetQuizCategoryCountsResponse> => {
    // Require authentication
    const user = await requireAuthenticatedUser(request);
    const targetOrg = String(request.data?.organization_id || (user as any).organization_id || 'mslb-main').trim();
    logger.info(`[getQuizCategoryCounts] uid=${user.uid} targetOrg=${targetOrg}`);

    try {
      let snapshot: FirebaseFirestore.QuerySnapshot;
      if (targetOrg !== 'mslb-main') {
        snapshot = await db
          .collection("quizzes")
          .where("organization_id", "==", targetOrg)
          .select("category")
          .get();
      } else {
        snapshot = await db
          .collection("quizzes")
          .select("category", "organization_id")
          .get();
      }

      // Aggregate counts in memory (scoped to target organization)
      const counts: Record<string, number> = {};
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const docOrg = data.organization_id;
        // For mslb-main, include legacy unassigned docs or explicitly mslb-main docs
        if (targetOrg === 'mslb-main' && docOrg && docOrg !== 'mslb-main') {
          continue;
        }
        const cat = String(data.category ?? "").trim();
        if (cat.length > 0) {
          counts[cat] = (counts[cat] ?? 0) + 1;
        }
      }

      logger.info(
        `[getQuizCategoryCounts] Aggregated org=${targetOrg} ${snapshot.size} docs → ${Object.keys(counts).length} categories`
      );

      return { counts, fetchedAt: Date.now() };
    } catch (err) {
      logger.error("[getQuizCategoryCounts] Failed", err);
      throw internalError("Failed to load category counts.");
    }
  }
);
