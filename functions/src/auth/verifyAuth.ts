/**
 * MSLB Authentication & Authorization Helpers for Cloud Functions
 * 
 * Server-side role verification using Firestore user document.
 * Admin authorization is based on trusted Firestore role field — never client-controlled.
 */
import { https, logger } from "firebase-functions/v2";
import { auth } from "../config/admin";
import { collections } from "../shared/firestore";
import { unauthenticatedError, permissionDeniedError } from "../shared/errors";
import type { UserRole } from "../shared/types";

export interface VerifiedUser {
  uid: string;
  email: string;
  role: UserRole;
}

/**
 * Verify that the request comes from an authenticated Firebase user.
 * Returns uid, email, and role from Firestore user document.
 * 
 * IMPORTANT: Role is read from Firestore (trusted server-side) — NOT from client token claims alone.
 */
export async function requireAuthenticatedUser(
  request: https.CallableRequest
): Promise<VerifiedUser> {
  const hasAuth = Boolean(request.auth);
  const authUid = request.auth?.uid ?? "null";
  logger.info(`[requireAuthenticatedUser:diagnostic] hasAuth=${hasAuth}, uid=${authUid}`);

  if (!request.auth) {
    logger.warn("[requireAuthenticatedUser] request.auth is missing/null (unauthenticated)");
    throw unauthenticatedError();
  }

  const { uid, token } = request.auth;
  const email = token.email ?? "";

  // Read role from Firestore (server-side trust boundary)
  const userSnap = await collections.users().doc(uid).get();
  if (!userSnap.exists) {
    logger.warn(`[requireAuthenticatedUser] Firestore users doc not found for uid=${uid}`);
    throw unauthenticatedError();
  }

  const userData = userSnap.data()!;
  const role = (userData.role ?? "student") as UserRole;

  return { uid, email, role };
}

/**
 * Verify that the request comes from an admin or super_admin user.
 * Rejects students and teachers.
 * 
 * CRITICAL: Role is verified from Firestore — a client CANNOT self-elevate.
 */
export async function requireAdminUser(
  request: https.CallableRequest
): Promise<VerifiedUser> {
  const user = await requireAuthenticatedUser(request);

  if (user.role !== "admin" && user.role !== "super_admin") {
    // Log security event
    await collections.securityEvents().add({
      event: "admin_function_access_denied",
      uid: user.uid,
      role: user.role,
      createdAtMs: Date.now(),
    });
    throw permissionDeniedError("Admin role required.");
  }

  return user;
}

/**
 * Verify Firebase ID token directly (for HTTP functions / webhooks).
 * Used when the caller is NOT a Firebase callable (e.g., Razorpay webhook).
 */
export async function verifyIdToken(idToken: string): Promise<{ uid: string; email: string }> {
  try {
    const decoded = await auth.verifyIdToken(idToken, true);
    return { uid: decoded.uid, email: decoded.email ?? "" };
  } catch {
    throw unauthenticatedError();
  }
}
