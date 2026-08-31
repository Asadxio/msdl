/**
 * MSLB Status Checks — Cloud Function (MongoDB → Firestore Migration Foundation)
 * 
 * The audit found that MongoDB only stores status_checks telemetry data.
 * This function provides the Firestore-based equivalent.
 * 
 * PHASE 1: Foundation ready. MongoDB remains operational (no cutover yet).
 * Phase 2 will switch production traffic from MongoDB to Firestore status_checks.
 * 
 * MongoDB field → Firestore field mapping:
 * | MongoDB field | Firestore field | Type    | Index |
 * |---------------|-----------------|---------|-------|
 * | service       | service         | string  | yes   |
 * | status        | status          | string  | yes   |
 * | message       | message         | string  | no    |
 * | created_at    | createdAtMs     | number  | yes   |
 */
import { https, logger } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuthenticatedUser } from "../auth/verifyAuth";
import { invalidArgumentError } from "../shared/errors";
import { collections } from "../shared/firestore";
import type { StatusCheckPayload } from "../shared/types";

export const createStatusCheck = onCall(
  { region: "us-central1" },
  async (request: https.CallableRequest<StatusCheckPayload>) => {
    const user = await requireAuthenticatedUser(request);
    const payload = request.data;

    if (!payload?.service || !payload?.status) {
      throw invalidArgumentError("service and status are required.");
    }

    const doc = {
      service: payload.service,
      status: payload.status,
      message: payload.message ?? "",
      createdByUid: user.uid,
      createdAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await collections.statusChecks().add(doc);
    logger.info(`[createStatusCheck] Written to Firestore id=${ref.id}`);

    return { id: ref.id, ...doc };
  }
);
