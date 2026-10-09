import { setGlobalOptions } from "firebase-functions/v2";

/**
 * Configure global options for all Cloud Functions v2.
 * cpu: 'gcf_gen1' (0.166 vCPU for 256MB) ensures all 26 functions together
 * consume ~4.3 vCPUs, comfortably within the GCP regional 20 vCPU quota limit.
 */
setGlobalOptions({
  region: "us-central1",
  cpu: "gcf_gen1",
  maxInstances: 10,
});
export { sendNotification } from "./notifications/sendNotification";
export { getQuizQuestions } from "./quiz/getQuizQuestions";
export { getQuizCategoryCounts } from "./quiz/getQuizCategoryCounts";
export { submitQuiz } from "./quiz/submitQuiz";
export { razorpayWebhook } from "./payments/razorpayWebhook";
export { createRazorpayOrder } from "./payments/createRazorpayOrder";
export { verifyRazorpayPayment } from "./payments/verifyRazorpayPayment";
/** @deprecated Phase 8: Maintained for legacy fallback; unused in modern automated online fees flow */
export { submitPaymentReference } from "./payments/submitPaymentReference";
export { adminPaymentAction } from "./payments/adminPaymentAction";
export { adminRefundPayment } from "./payments/adminRefundPayment";
export { enrollInFreeCourse } from "./payments/enrollInFreeCourse";
export { generateCertificate } from "./certificates/generateCertificate";
export { createStatusCheck } from "./status/statusChecks";

export { reactToStatus } from "./status/reactToStatus";

// ─── P0.1: Secure AI Gateway (Gemini key in Secret Manager — NOT in APK) ───────
export { askAITutor } from "./ai/askAITutor";
export { generateAIFlashcards } from "./ai/generateAIFlashcards";
export { generateAIQuiz } from "./ai/generateAIQuiz";

// ─── Phase 50/51: Multi-Tenant SaaS Organizations ─────────────────────────────
export {
  createOrganization,
  updateOrganizationStatus,
  recordManualPayment,
  updateOrganizationSettings,
  bulkImportStudents,
  inviteUserToOrganization,
} from "./organizations/organizationService";

// ─── Phase 65: New Student Welcome Message & Onboarding Communication ────────
export {
  onUserCreatedWelcomeTrigger,
  retryStudentWelcomeMessage,
  getWhatsAppProviderHealthCallable,
} from "./onboarding/welcomeCommunication";

// ─── Phase 74: Production Course Delete Safety (13 Dependency Checks) ───────────
export { deleteCourse } from "./courses/deleteCourse";

// ─── Teacher Claim / Access Code System ───────────────────────────────────────
export { claimTeacherAccessCode } from "./teachers/claimTeacherAccessCode";

// ─── Phase 78: End-to-End Automated Notification Triggers ───────────────────
export {
  onUserApprovalTrigger,
  onSubmissionWrittenTrigger,
  onLiveClassWrittenTrigger,
} from "./notifications/notificationTriggers";

// ─── Phase 79: User Data & Play Store Account Deletion Compliance ─────────────
export { processAccountDeletion } from "./privacy/processAccountDeletion";

