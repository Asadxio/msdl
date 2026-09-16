/**
 * MSLB New Student Welcome Message & Onboarding Communication System
 * 
 * Official Sender Number: +91 63669 19122
 * Official Helpline URL: https://wa.me/916366919122
 * 
 * Core Guarantees:
 * 1. 100% Server-side execution in Firebase Cloud Functions v2 (Secret Manager).
 * 2. Zero secrets in Expo frontend client bundle or APK.
 * 3. Non-blocking: Signup never fails if welcome dispatch is slow or errors.
 * 4. Strict idempotency: 'sent' permanently prevents duplicates.
 * 5. Safe retries: 'pending_configuration' and 'failed' remain safely retryable.
 * 6. Zero fake success: If Meta credentials are missing, records 'pending_configuration'.
 * 7. Authentic Islamic institutional tone reflecting Madrasatu-s-Salikat Lil Banat.
 */

import { logger, https } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { db, messaging } from "../config/admin";
import { collections } from "../shared/firestore";
import { requireAdminUser } from "../auth/verifyAuth";
import { invalidArgumentError, notFoundError } from "../shared/errors";
import {
  WHATSAPP_API_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_BUSINESS_ACCOUNT_ID,
  SMS_GATEWAY_API_KEY,
  SELF_HOSTED_WHATSAPP_URL,
  SELF_HOSTED_WHATSAPP_API_KEY,
} from "../config/secrets";
import {
  dispatchWelcomeWhatsApp,
  checkWhatsAppProviderHealth,
} from "../whatsapp/provider";
import { WhatsAppProviderType } from "../whatsapp/types";

// Official Constants
export const OFFICIAL_SENDER_NUMBER = "+916366919122";
export const OFFICIAL_HELPLINE_URL = "https://wa.me/916366919122";
export const INSTITUTION_NAME_URDU = "مدرسۃ السالکات للبنات";
export const INSTITUTION_NAME_EN = "Madrasatu-s-Salikat Lil Banat";

// Confirmed Academic Classes / Levels in MSLB
export const CONFIRMED_ACADEMIC_LEVELS = [
  "Rabiya",
  "Ula",
  "Aaidadiya",
  "Salisa",
  "Qirat",
] as const;

export type AcademicLevel = (typeof CONFIRMED_ACADEMIC_LEVELS)[number];

export type OnboardingStatus =
  | "sent"
  | "completed"
  | "in_app_sent"
  | "pending_configuration"
  | "failed"
  | "skipped_invalid_phone"
  | "skipped_no_consent"
  | "processing";

export interface PhoneNormalizationResult {
  isValid: boolean;
  rawPhone: string;
  e164Phone?: string;
  maskedPhone?: string;
  reason?: string;
}

/**
 * Safely normalizes Indian mobile numbers into canonical E.164 (+91XXXXXXXXXX)
 * Accepts formats:
 * - 9876543210
 * - 09876543210
 * - 919876543210
 * - +919876543210
 * Also strips whitespace, dashes, dots, and brackets.
 */
export function normalizeIndianPhoneNumber(rawPhone?: string | null): PhoneNormalizationResult {
  if (!rawPhone || typeof rawPhone !== "string") {
    return { isValid: false, rawPhone: "", reason: "missing_phone" };
  }

  const cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, "");
  if (!cleaned) {
    return { isValid: false, rawPhone, reason: "empty_phone" };
  }

  // Indian mobile numbers have 10 digits starting with 6, 7, 8, or 9
  const match = cleaned.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  if (!match) {
    return { isValid: false, rawPhone, reason: "invalid_indian_mobile_format" };
  }

  const tenDigits = match[1];
  const e164 = `+91${tenDigits}`;
  const masked = `+91******${tenDigits.slice(-4)}`;

  return {
    isValid: true,
    rawPhone,
    e164Phone: e164,
    maskedPhone: masked,
  };
}

/**
 * Generates the authentic Islamic, educational welcome message for WhatsApp.
 * Accurately represents Madrasatu-s-Salikat Lil Banat without marketing hype.
 */
export function generateWhatsAppWelcomeMessage(
  studentName: string,
  enrolledCourse?: string | null
): string {
  const safeName = studentName.trim() || "طالبہ";
  const enrollmentLine = enrolledCourse
    ? `\n📖 *منتخب کردہ شعبہ:* ${enrolledCourse}\n`
    : "";

  return (
`بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ

السلام علیکم ورحمۃ اللہ وبرکاتہ

محترمہ *${safeName}* صاحبہ!
مدرسۃ السالکات للبنات میں آپ کا دلی خیر مقدم ہے۔ اللہ تعالیٰ آپ کے اس بابرکت تعلیمی سفر کو قبول فرمائے اور علم نافع عطا فرمائے۔ آمین۔${enrollmentLine}
مدرسۃ السالکات للبنات طالبات کے لیے ایک مستند آن لائن دینی و تعلیمی ادارہ ہے جہاں مکمل شرعی پردہ اور شرعی اصولوں کے تحت علوم اسلامیہ کی معیاری تعلیم دی جاتی ہے۔

🔹 *ہمارے تعلیمی شعبہ جات (Academic Levels):*
• رابعہ (Rabiya)
• اولیٰ (Ula)
• اعدادیہ (Aaidadiya)
• ثالثہ (Salisa)
• تجوید و قراءت (Qirat)

📱 *ایپ کی خصوصیات اور سہولیات (App Features):*
• معلمات کے ساتھ آن لائن لائیو کلاسز (Live Interactive Classes)
• محفوظ آڈیو و ویڈیو اسباق کی لائبریری (Recorded Lessons & Library)
• معلمات کے ساتھ علمی سوال و جواب اور رہنمائی (Teacher Chat & Q&A)
• نماز کے اوقات، قبلہ رخ اور تلاوتِ قرآن کی سہولت (Prayer Times, Qibla & Quran)
• داخلے اور تکمیل کے بعد باقاعدہ معائنہ، امتحانات اور مصدقہ اسناد (Assessments & Sanad)

📌 *اگلا مرحلہ (Next Steps):*
آپ کا رجسٹریشن بحمداللہ کامیابی سے درج ہو چکا ہے۔ پردہ اور تعلیمی قواعد کی توثیق کے بعد انتظامیہ کی جانب سے آپ کے داخلے کی تصدیق کی جائے گی۔ داخلے کے بعد آپ اپنے درجات کے اسباق اور لائیو کلاسز تک مکمل رسائی حاصل کر سکیں گی۔

📞 *رابطہ و رہنمائی (Official Helpline):*
کسی بھی معلومات یا رہنمائی کے لیے ہماری آفیشل ہیلپ لائن پر رابطہ فرمائیں:
👉 https://wa.me/916366919122

والسلام علیکم ورحمۃ اللہ وبرکاتہ
*انتظامیہ و معلمات، مدرسۃ السالکات للبنات*`
  );
}

/**
 * Generates the short transactional welcome message for standard SMS.
 * Prioritizes student name, institution welcome, and clickable official support link.
 */
export function generateSmsWelcomeMessage(studentName: string): string {
  const safeName = (studentName || "Student").trim().slice(0, 25);
  return `Bismillah. Assalamu Alaikum ${safeName}, Madrasatu-s-Salikat Lil Banat me aapka registration darj ho gaya hai. Support: https://wa.me/916366919122`;
}

export interface SendWhatsAppResult {
  success: boolean;
  status: OnboardingStatus;
  providerMessageId?: string;
  error?: string;
  reason?: string;
}

/**
 * Meta WhatsApp Cloud API Dispatcher
 * Sends message strictly from official WhatsApp Business sender: +91 63669 19122
 */
export async function sendWhatsAppViaCloudApi(
  e164Phone: string,
  messageText: string,
  credentials?: { apiToken?: string; phoneNumberId?: string }
): Promise<SendWhatsAppResult> {
  // Resolve credentials from argument or environment
  let token = credentials?.apiToken;
  let phoneId = credentials?.phoneNumberId;

  if (!token) {
    try {
      token = WHATSAPP_API_TOKEN.value();
    } catch {
      token = process.env.WHATSAPP_API_TOKEN;
    }
  }

  if (!phoneId) {
    try {
      phoneId = WHATSAPP_PHONE_NUMBER_ID.value();
    } catch {
      phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    }
  }

  // Zero Fake Delivery: If credentials are not configured, return pending_configuration
  if (!token || !phoneId) {
    logger.warn(
      `[WelcomeCommunication] Meta WhatsApp Cloud API credentials missing for sender ${OFFICIAL_SENDER_NUMBER}. Marked pending_configuration.`
    );
    return {
      success: false,
      status: "pending_configuration",
      reason: `Meta WhatsApp Cloud API credentials missing (WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID) for sender ${OFFICIAL_SENDER_NUMBER}`,
    };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: e164Phone.replace("+", ""), // Meta accepts digits with country code
      type: "text",
      text: {
        preview_url: true,
        body: messageText,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseJson = (await response.json()) as any;

    if (!response.ok) {
      const errMsg =
        responseJson?.error?.message ||
        `HTTP ${response.status} ${response.statusText}`;
      logger.error("[WelcomeCommunication] WhatsApp Cloud API error response:", errMsg);
      return {
        success: false,
        status: "failed",
        error: errMsg,
      };
    }

    const messageId = responseJson?.messages?.[0]?.id || "wa_msg_" + Date.now();
    logger.info(
      `[WelcomeCommunication] WhatsApp delivered to recipient. messageId=${messageId}`
    );

    return {
      success: true,
      status: "sent",
      providerMessageId: messageId,
    };
  } catch (err: any) {
    logger.error("[WelcomeCommunication] Network exception calling WhatsApp API:", err);
    return {
      success: false,
      status: "failed",
      error: err?.message || "Network timeout or connection error",
    };
  }
}

export interface ProcessWelcomeOptions {
  forceRetry?: boolean;
  adminUid?: string;
  providerType?: WhatsAppProviderType;
  credentialsOverride?: any;
}

export interface ProcessWelcomeResult {
  success: boolean;
  status: OnboardingStatus;
  messageId?: string;
  reason?: string;
  error?: string;
  duplicate?: boolean;
  maskedPhone?: string;
}

/**
 * Look up registered push tokens for a user.
 */
export async function getUserPushTokens(uid: string): Promise<{ fcmToken?: string; expoToken?: string }> {
  try {
    const snap = await collections.userTokens().doc(uid).get();
    if (snap.exists) {
      const d = snap.data() || {};
      const fcmCandidate = (typeof d.fcmToken === "string" && d.fcmToken.trim()) ? d.fcmToken.trim() : "";
      const tokenCandidate = (typeof d.token === "string" && d.token.trim()) ? d.token.trim() : "";
      const expoCandidate = (typeof d.expoPushToken === "string" && d.expoPushToken.trim()) ? d.expoPushToken.trim() : "";
      if (fcmCandidate && !fcmCandidate.startsWith("ExponentPushToken[") && !fcmCandidate.startsWith("ExpoPushToken[")) {
        return { fcmToken: fcmCandidate };
      }
      if (tokenCandidate && !tokenCandidate.startsWith("ExponentPushToken[") && !tokenCandidate.startsWith("ExpoPushToken[")) {
        return { fcmToken: tokenCandidate };
      }
      if (expoCandidate) {
        return { expoToken: expoCandidate };
      }
      if (tokenCandidate) {
        return { expoToken: tokenCandidate };
      }
    }

    const userDoc = await collections.users().doc(uid).get();
    if (userDoc.exists) {
      const uData = userDoc.data() || {};
      const fcmList: string[] = Array.isArray(uData.fcm_tokens) ? uData.fcm_tokens : [];
      const expoList: string[] = Array.isArray(uData.expo_push_tokens) ? uData.expo_push_tokens : [];
      const nativeFcm = fcmList.find((t) => typeof t === "string" && t.trim() && !t.startsWith("ExponentPushToken[") && !t.startsWith("ExpoPushToken["));
      if (nativeFcm) return { fcmToken: nativeFcm.trim() };
      const nativeExpo = expoList.find((t) => typeof t === "string" && t.trim());
      if (nativeExpo) return { expoToken: nativeExpo.trim() };
    }
  } catch (err) {
    logger.warn(`[WelcomeCommunication] Error looking up push tokens for ${uid}:`, err);
  }
  return {};
}

/**
 * Core Idempotent Onboarding Welcome Processor (Phase 65.3: Firebase-Only Free Architecture)
 * 
 * Rules:
 * 1. 'completed', 'in_app_sent', and legacy 'sent' status permanently prevents duplicate automatic delivery.
 * 2. 'pending_configuration' and 'failed' are safely retryable.
 * 3. Uses atomic Firestore transaction to claim processing rights.
 * 4. Never throws unhandled errors that could break student account creation (Non-blocking).
 * 5. Automatic WhatsApp sending is DISABLED by default (zero external network calls during signup).
 * 6. Dispatches canonical In-App notification to notifications collection.
 * 7. Dispatches FCM push notification via Firebase Admin Messaging.
 * 8. Records honest channel metadata (inApp: sent, push: sent|no_token|failed, whatsapp: disabled).
 */
export async function processWelcomeCommunication(
  userId: string,
  userData: {
    name?: string;
    phone?: string;
    email?: string;
    role?: string;
    enrolledCourse?: string;
    whatsappConsent?: boolean;
  },
  options: ProcessWelcomeOptions = {}
): Promise<ProcessWelcomeResult> {
  const studentName = (userData.name || "طالبہ").trim();
  const rawPhone = userData.phone;
  const userEmail = (userData.email || "").trim().toLowerCase();

  // 1. Validate & Normalize Phone Number if provided
  const norm = normalizeIndianPhoneNumber(rawPhone);

  const docRef = collections.onboardingCommunications().doc(userId);

  // 2. Atomic Firestore Transaction / Claim Logic
  let canProceed = false;
  let claimError: string | null = null;
  let existingStatus: OnboardingStatus | null = null;

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const now = Date.now();

      if (snap.exists) {
        const data = snap.data() || {};
        existingStatus = data.status;

        // Rule: 'completed', 'in_app_sent', or legacy 'sent' permanently prevents duplicate automatic delivery
        if (
          (existingStatus === "completed" || existingStatus === "in_app_sent" || existingStatus === "sent") &&
          !options.forceRetry
        ) {
          canProceed = false;
          return;
        }

        // Rule: If already processing and lease active (<60s), avoid race
        if (
          existingStatus === "processing" &&
          data.lastAttemptAtMs &&
          now - data.lastAttemptAtMs < 60000 &&
          !options.forceRetry
        ) {
          canProceed = false;
          claimError = "in_flight_lease_active";
          return;
        }

        // Safe retry allowed for 'pending_configuration' and 'failed'
        tx.update(docRef, {
          status: "processing",
          lastAttemptAtMs: now,
          attemptCount: (data.attemptCount || 0) + 1,
          updatedAtMs: now,
          ...(options.adminUid ? { lastRetriedByAdminUid: options.adminUid } : {}),
        });
      } else {
        // Initial creation
        tx.set(docRef, {
          userId,
          studentName,
          phoneMasked: norm.isValid ? norm.maskedPhone : (rawPhone ? "[PROVIDED_INVALID]" : null),
          e164Phone: norm.isValid ? norm.e164Phone : null,
          email: userEmail,
          role: userData.role || "student",
          senderNumber: OFFICIAL_SENDER_NUMBER,
          channel: "firebase",
          inApp: "processing",
          push: "processing",
          whatsapp: "disabled",
          status: "processing",
          attemptCount: 1,
          lastAttemptAtMs: now,
          createdAtMs: now,
          updatedAtMs: now,
        });
      }

      canProceed = true;
    });
  } catch (txErr: any) {
    logger.error("[WelcomeCommunication] Transaction claim error:", txErr);
    return {
      success: false,
      status: "failed",
      error: txErr?.message || "Transaction failure",
    };
  }

  // If already sent or completed, exit cleanly with duplicate indication
  if (!canProceed) {
    if (existingStatus === "completed" || existingStatus === "in_app_sent" || existingStatus === "sent") {
      logger.info(
        `[WelcomeCommunication] Welcome already completed for user ${userId}. Duplicate prevented.`
      );
      return {
        success: true,
        status: existingStatus,
        duplicate: true,
        reason: "already_delivered",
      };
    }
    return {
      success: false,
      status: existingStatus || "processing",
      reason: claimError || "cannot_claim_lock",
    };
  }

  // 3. Dispatch Canonical In-App Notification
  let inAppStatus: "sent" | "failed" = "failed";
  let inAppNotificationId: string | null = null;
  try {
    const notifRef = await collections.notifications().add({
      user_id: userId,
      title: "🌙 Welcome to Madrasatu-s-Salikat Lil Banat",
      message: `Assalamu Alaikum ${studentName}! Aapka registration darj ho gaya hai. Idara me aapka dilli khair-maqdam hai.`,
      category: "announcement",
      type: "welcome_onboarding",
      data: {
        type: "welcome_onboarding",
        route: "/(tabs)/notifications",
        studentName,
        enrolledCourse: userData.enrolledCourse || "",
        helpline: OFFICIAL_HELPLINE_URL,
      },
      dedupe_id: `welcome_inapp_${userId}`,
      read: {},
      created_at: FieldValue.serverTimestamp(),
      created_at_ms: Date.now(),
    });
    inAppStatus = "sent";
    inAppNotificationId = notifRef.id;
    logger.info(`[WelcomeCommunication] In-app notification created id=${notifRef.id}`);
  } catch (notifErr: any) {
    logger.error(`[WelcomeCommunication] Non-fatal error creating in-app notification for ${userId}:`, notifErr);
    inAppStatus = "failed";
  }

  // 4. Dispatch FCM Push Notification (Accepted by provider semantics)
  let pushStatus: "sent" | "no_token" | "failed" = "no_token";
  let fcmMessageId: string | null = null;
  try {
    const tokens = await getUserPushTokens(userId);
    if (tokens.fcmToken) {
      const resp = await messaging.send({
        token: tokens.fcmToken,
        notification: {
          title: "🌙 Madrasatu-s-Salikat Lil Banat",
          body: `Assalamu Alaikum ${studentName}! Aapka Madrasa registration successfully receive ho gaya hai. Welcome message app mein aapka intezar kar raha hai.`,
        },
        data: {
          type: "welcome_onboarding",
          route: "/(tabs)/notifications",
          studentName,
        },
        android: {
          priority: "high",
          notification: {
            channelId: "announcements",
          },
        },
      });
      pushStatus = "sent";
      fcmMessageId = resp;
      logger.info(`[WelcomeCommunication] FCM push send accepted. messageId=${resp}`);
    } else if (tokens.expoToken) {
      const expResp = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: tokens.expoToken,
          sound: "default",
          title: "🌙 Madrasatu-s-Salikat Lil Banat",
          body: `Assalamu Alaikum ${studentName}! Aapka Madrasa registration successfully receive ho gaya hai. Welcome message app mein aapka intezar kar raha hai.`,
          data: {
            type: "welcome_onboarding",
            route: "/(tabs)/notifications",
            studentName,
          },
          channelId: "announcements",
          priority: "high",
        }),
      });
      if (expResp.ok) {
        pushStatus = "sent";
        fcmMessageId = "expo_accepted";
        logger.info(`[WelcomeCommunication] Expo push accepted for ${userId}`);
      } else {
        pushStatus = "failed";
      }
    } else {
      pushStatus = "no_token";
      logger.info(`[WelcomeCommunication] No push token registered yet for ${userId}. In-app notification preserved.`);
    }
  } catch (pushErr: any) {
    logger.warn(`[WelcomeCommunication] Non-fatal push delivery error for ${userId}:`, pushErr?.message);
    pushStatus = "failed";
  }

  // 5. Automatic WhatsApp Channel Handling (DISABLED by default; Meta/SelfHosted preserved for testing/future)
  let whatsappStatus: string = "disabled";
  let whatsappMessageId: string | null = null;
  let whatsappReason: string | null = null;

  if (userData.whatsappConsent === false) {
    whatsappStatus = "skipped_no_consent";
    whatsappReason = "student_opted_out";
  } else if (options.providerType === "meta" || options.providerType === "self_hosted") {
    // Preserved for admin testing or explicit provider activation
    if (norm.isValid && norm.e164Phone) {
      const messageBody = generateWhatsAppWelcomeMessage(studentName, userData.enrolledCourse);
      const res = await dispatchWelcomeWhatsApp(
        {
          recipientE164: norm.e164Phone,
          messageText: messageBody,
          studentName,
          enrolledCourse: userData.enrolledCourse,
        },
        {
          providerType: options.providerType,
          credentialsOverride: options.credentialsOverride,
        }
      );
      whatsappStatus = res.status;
      whatsappMessageId = res.providerMessageId || null;
      whatsappReason = res.reason || null;
    } else {
      whatsappStatus = "skipped_invalid_phone";
      whatsappReason = norm.reason || "invalid_phone";
    }
  } else {
    // Default: Automatic WhatsApp sending is OFF
    whatsappStatus = "disabled";
    whatsappReason = "Automatic WhatsApp sending is disabled by institutional policy (In-App + FCM active).";
  }

  // 6. Record Final Status in onboarding_communications
  const isCompleted = inAppStatus === "sent";
  const finalUpdate: any = {
    status: isCompleted ? ("completed" as OnboardingStatus) : ("failed" as OnboardingStatus),
    channel: "firebase",
    inApp: inAppStatus,
    push: pushStatus,
    whatsapp: whatsappStatus,
    inAppNotificationId,
    fcmMessageId,
    whatsappMessageId,
    phoneMasked: norm.isValid ? norm.maskedPhone : (rawPhone ? "[PROVIDED_INVALID]" : null),
    e164Phone: norm.isValid ? norm.e164Phone : null,
    updatedAtMs: Date.now(),
    lastAttemptResult: {
      success: isCompleted,
      inApp: inAppStatus,
      push: pushStatus,
      whatsapp: whatsappStatus,
      whatsappReason,
      timestamp: Date.now(),
    },
  };

  if (whatsappMessageId) {
    finalUpdate.providerMessageId = whatsappMessageId;
  }

  await docRef.set(finalUpdate, { merge: true }).catch((err) => {
    logger.error("[WelcomeCommunication] Failed to update final status doc:", err);
  });

  return {
    success: isCompleted,
    status: isCompleted ? "completed" : "failed",
    messageId: inAppNotificationId || fcmMessageId || undefined,
    reason: whatsappReason || undefined,
    maskedPhone: norm.maskedPhone,
  };
}

/**
 * Automatic Background Firestore Trigger on users/{userId} creation
 * 
 * Non-blocking: Wraps all execution in try/catch to ensure user creation in
 * Firestore and Firebase Auth is NEVER affected by messaging outcome.
 */
export const onUserCreatedWelcomeTrigger = onDocumentCreated(
  {
    document: "users/{userId}",
    region: "us-central1",
    secrets: [
      WHATSAPP_API_TOKEN,
      WHATSAPP_PHONE_NUMBER_ID,
      WHATSAPP_BUSINESS_ACCOUNT_ID,
      SMS_GATEWAY_API_KEY,
      SELF_HOSTED_WHATSAPP_URL,
      SELF_HOSTED_WHATSAPP_API_KEY,
    ],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.info("[onUserCreatedWelcomeTrigger] No data snapshot in event.");
      return;
    }

    const userId = event.params.userId;
    const userData = snap.data() || {};

    // Only process students (or new signups)
    if (userData.role && userData.role !== "student") {
      logger.info(`[onUserCreatedWelcomeTrigger] Non-student role (${userData.role}) skipped.`);
      return;
    }

    try {
      logger.info(`[onUserCreatedWelcomeTrigger] Processing welcome for new user ${userId}`);
      await processWelcomeCommunication(userId, {
        name: userData.name,
        phone: userData.phone,
        email: userData.email,
        role: userData.role,
        enrolledCourse: userData.enrolled_course || userData.course,
        whatsappConsent: userData.whatsapp_consent,
      });
    } catch (err) {
      // NON-BLOCKING GUARANTEE: Never throw unhandled exceptions from background trigger
      logger.error(
        `[onUserCreatedWelcomeTrigger] Non-fatal error processing welcome message for ${userId}:`,
        err
      );
    }
  }
);

/**
 * Admin-Authorized Callable for Retrying Welcome Communication
 * 
 * Enforces strict Admin authorization. Normal users cannot call this.
 * Allows safe retry of 'pending_configuration' and 'failed' messages.
 * Prevents duplicates if already 'sent'.
 */
export const retryStudentWelcomeMessage = onCall(
  {
    region: "us-central1",
    secrets: [
      WHATSAPP_API_TOKEN,
      WHATSAPP_PHONE_NUMBER_ID,
      WHATSAPP_BUSINESS_ACCOUNT_ID,
      SMS_GATEWAY_API_KEY,
      SELF_HOSTED_WHATSAPP_URL,
      SELF_HOSTED_WHATSAPP_API_KEY,
    ],
  },
  async (request: https.CallableRequest<{ targetUserId: string; force?: boolean; providerType?: WhatsAppProviderType }>) => {
    // 1. Verify caller has Admin role
    const adminUser = await requireAdminUser(request);
    logger.info(`[retryStudentWelcomeMessage] Invoked by admin ${adminUser.uid}`);

    const { targetUserId, force, providerType } = request.data || {};
    if (!targetUserId || typeof targetUserId !== "string") {
      throw invalidArgumentError("targetUserId is required.");
    }

    // 2. Fetch target user doc
    const userDocSnap = await collections.users().doc(targetUserId).get();
    if (!userDocSnap.exists) {
      throw notFoundError(`Student user document not found for ${targetUserId}`);
    }

    const userData = userDocSnap.data() || {};

    // 3. Process welcome message with safe retry
    const result = await processWelcomeCommunication(
      targetUserId,
      {
        name: userData.name,
        phone: userData.phone,
        email: userData.email,
        role: userData.role,
        enrolledCourse: userData.enrolled_course || userData.course,
        whatsappConsent: userData.whatsapp_consent,
      },
      {
        forceRetry: Boolean(force),
        adminUid: adminUser.uid,
        providerType,
      }
    );

    return {
      success: result.success,
      status: result.status,
      messageId: result.messageId,
      reason: result.reason,
      error: result.error,
      duplicate: result.duplicate,
      maskedPhone: result.maskedPhone,
    };
  }
);

/**
 * Admin-Authorized Callable for Checking WhatsApp Provider Health
 * 
 * Reports whether Meta Cloud API or Self-Hosted WhatsApp gateway
 * is CONNECTED, DISCONNECTED, or requires QR/auth.
 */
export const getWhatsAppProviderHealthCallable = onCall(
  {
    region: "us-central1",
    secrets: [
      WHATSAPP_API_TOKEN,
      WHATSAPP_PHONE_NUMBER_ID,
      SELF_HOSTED_WHATSAPP_URL,
      SELF_HOSTED_WHATSAPP_API_KEY,
    ],
  },
  async (request: https.CallableRequest<{ providerType?: WhatsAppProviderType }>) => {
    await requireAdminUser(request);
    const providerType = request.data?.providerType;
    return checkWhatsAppProviderHealth(providerType);
  }
);
