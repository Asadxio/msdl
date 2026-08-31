/**
 * MSLB Firestore Access Helpers
 * 
 * Centralizes Firestore collection references.
 * Use these helpers in all Cloud Functions — do NOT call db.collection() directly.
 */
import { db } from "../config/admin";

export const collections = {
  users: () => db.collection("users"),
  courses: () => db.collection("courses"),
  lessons: () => db.collection("lessons"),
  lessonProgress: () => db.collection("lesson_progress"),
  quizzes: () => db.collection("quizzes"),
  quizResults: () => db.collection("quiz_results"),
  quizAttemptLocks: () => db.collection("quiz_attempt_locks"),
  operationDedupe: () => db.collection("operation_dedupe"),
  payments: () => db.collection("payments"),
  enrollments: () => db.collection("enrollments"),
  subscriptions: () => db.collection("subscriptions"),
  certificates: () => db.collection("certificates"),
  notifications: () => db.collection("notifications"),
  userTokens: () => db.collection("user_tokens"),
  statusChecks: () => db.collection("status_checks"),
  securityEvents: () => db.collection("security_events_immutable"),
  statusUpdates: () => db.collection("status_updates"),
  paymentGatewayEvents: () => db.collection("payment_gateway_events"),
  paymentProcessorAuditLogs: () => db.collection("payment_processor_audit_logs"),
  paymentVerificationQueue: () => db.collection("payment_verification_queue"),
};

/**
 * Get a user document and verify it exists.
 */
export async function getUserDoc(uid: string): Promise<FirebaseFirestore.DocumentData> {
  const snap = await collections.users().doc(uid).get();
  if (!snap.exists) {
    throw new Error(`User document not found: ${uid}`);
  }
  return snap.data() as FirebaseFirestore.DocumentData;
}
