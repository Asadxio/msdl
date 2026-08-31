import { https } from "firebase-functions/v2";

export const unauthenticatedError = () =>
  new https.HttpsError("unauthenticated", "Authentication required.");

export const permissionDeniedError = (detail?: string) =>
  new https.HttpsError("permission-denied", detail ?? "Insufficient privileges.");

export const notFoundError = (detail?: string) =>
  new https.HttpsError("not-found", detail ?? "Resource not found.");

export const internalError = (detail?: string) =>
  new https.HttpsError("internal", detail ?? "Internal server error.");

export const invalidArgumentError = (detail?: string) =>
  new https.HttpsError("invalid-argument", detail ?? "Invalid request.");
export const resourceExhaustedError = (detail?: string) =>
  new https.HttpsError("resource-exhausted", detail ?? "Resource exhausted.");
