/**
 * MSLB Firebase Cloud Functions — Phase 1 Foundation
 * 
 * Entry point for all Cloud Functions.
 * Each function is in its own module for clean separation of security boundaries.
 * 
 * PHASE 1 STATUS:
 * [x] sendNotification  — Admin-only FCM dispatch (FOUNDATION READY)
 * [x] submitQuiz        — Server-side quiz grading (SKELETON — Phase 4)
 * [x] razorpayWebhook   — Razorpay HMAC webhook (SKELETON — Phase 5)
 * [x] generateCertificate — PDF certificate generation (SKELETON — Phase 6)
 * [x] createStatusCheck — MongoDB→Firestore migration foundation (READY)
 */
export { sendNotification } from "./notifications/sendNotification";
export { getQuizQuestions } from "./quiz/getQuizQuestions";
export { getQuizCategoryCounts } from "./quiz/getQuizCategoryCounts";
export { submitQuiz } from "./quiz/submitQuiz";
export { razorpayWebhook } from "./payments/razorpayWebhook";
export { createRazorpayOrder } from "./payments/createRazorpayOrder";
/** @deprecated Phase 8: Maintained for legacy fallback; unused in modern automated online fees flow */
export { submitPaymentReference } from "./payments/submitPaymentReference";
export { adminPaymentAction } from "./payments/adminPaymentAction";
export { adminRefundPayment } from "./payments/adminRefundPayment";
export { generateCertificate } from "./certificates/generateCertificate";
export { createStatusCheck } from "./status/statusChecks";

export { reactToStatus } from "./status/reactToStatus";

