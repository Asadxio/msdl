/**
 * MSLB Shared TypeScript Types
 * Mirrors Firestore document schemas.
 */

export type UserRole = "student" | "teacher" | "admin" | "super_admin";

export interface MslbUser {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface QuizSubmissionPayload {
  quizId: string;
  answers: Record<string, string>; // questionId -> selectedOptionId
  startedAtMs: number;
  submittedAtMs: number;
  nonce: string;
}

export interface NotificationPayload {
  recipientUid: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface StatusCheckPayload {
  service: string;
  status: "ok" | "error" | "degraded";
  message?: string;
}
