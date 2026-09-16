/**
 * MSLB Firebase Cloud Functions — Phase 1 Foundation
 * 
 * Entry point for all Cloud Functions.
 * Each function is in its own module for clean separation of security boundaries.
 */
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

