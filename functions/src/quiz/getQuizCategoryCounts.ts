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
    request: https.CallableRequest<Record<string, never>>
  ): Promise<GetQuizCategoryCountsResponse> => {
    // Require authentication
    const user = await requireAuthenticatedUser(request);
    logger.info(`[getQuizCategoryCounts] uid=${user.uid}`);

    try {
      // ONE query — fetch only the 'category' field from all quiz docs
      const snapshot = await db
        .collection("quizzes")
        .select("category")
        .get();

      // Aggregate counts in memory (no extra network calls)
      const counts: Record<string, number> = {};
      for (const doc of snapshot.docs) {
        const cat = String(doc.data().category ?? "").trim();
        if (cat.length > 0) {
          counts[cat] = (counts[cat] ?? 0) + 1;
        }
      }

      logger.info(
        `[getQuizCategoryCounts] Aggregated ${snapshot.size} docs → ${Object.keys(counts).length} categories`
      );

      return { counts, fetchedAt: Date.now() };
    } catch (err) {
      logger.error("[getQuizCategoryCounts] Failed", err);
      throw internalError("Failed to load category counts.");
    }
  }
);
