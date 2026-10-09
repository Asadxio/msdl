/**
 * MSLB Secret Manager Configuration
 * 
 * Firebase Functions v2 defineSecret() declarations.
 * Actual secret values are stored in Google Cloud Secret Manager.
 * 
 * DEPLOYMENT:
 *   firebase functions:secrets:set RAZORPAY_KEY_ID
 *   firebase functions:secrets:set RAZORPAY_KEY_SECRET
 *   firebase functions:secrets:set GEMINI_API_KEY
 * 
 * EMULATOR:
 *   Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET as environment variables.
 *   These are NEVER committed to source control.
 * 
 * IMPORTANT:
 *   RAZORPAY_KEY_ID = public key (rzp_live_... or rzp_test_...)
 *   RAZORPAY_KEY_SECRET = private key — NEVER expose to frontend
 *   GEMINI_API_KEY = Google AI Studio key — NEVER expose to frontend or APK
 */
import { defineSecret } from 'firebase-functions/params';

export const RAZORPAY_KEY_ID = defineSecret('RAZORPAY_KEY_ID');
export const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');

/**
 * Gemini API key — stored in Secret Manager, bound ONLY to AI callable functions.
 * NEVER returned to client. NEVER logged. NEVER in EXPO_PUBLIC_* env vars.
 */
export const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

/**
 * Optional Secret Accessor interface matching SecretParam interface
 */
export interface OptionalSecretParam {
  name: string;
  value: () => string;
}

/**
 * Creates an optional secret accessor that resolves dynamically without registering
 * an unfulfilled SecretParam in Firebase Functions v2 deployment manifests.
 * Prevents missing WhatsApp secrets from blocking unrelated core Cloud Functions deployment.
 */
function defineOptionalSecret(name: string): OptionalSecretParam {
  return {
    name,
    value: (): string => {
      const val = process.env[name];
      if (!val) {
        throw new Error(`Secret parameter "${name}" is not configured in environment or Secret Manager.`);
      }
      return val;
    },
  };
}

/**
 * Meta WhatsApp Cloud API credentials for Official Madrasa WhatsApp Business Sender (+91 63669 19122)
 * Bound ONLY to server-side onboarding communication functions.
 * NEVER exposed to client, APK, or public documents.
 * 
 * Phase 74.1: Decoupled to allow independent deployment of core academic & payment functions.
 * When real credentials are provided by institution, configure via:
 *   firebase functions:secrets:set WHATSAPP_API_TOKEN
 *   firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
 */
export const WHATSAPP_API_TOKEN = defineOptionalSecret('WHATSAPP_API_TOKEN');
export const WHATSAPP_PHONE_NUMBER_ID = defineOptionalSecret('WHATSAPP_PHONE_NUMBER_ID');
export const WHATSAPP_BUSINESS_ACCOUNT_ID = defineOptionalSecret('WHATSAPP_BUSINESS_ACCOUNT_ID');

/**
 * Optional Transactional SMS gateway API key
 */
export const SMS_GATEWAY_API_KEY = defineOptionalSecret('SMS_GATEWAY_API_KEY');

/**
 * Self-Hosted WhatsApp Gateway credentials (e.g. Baileys / Evolution API standalone container)
 * Bound ONLY to server-side functions.
 */
export const SELF_HOSTED_WHATSAPP_URL = defineOptionalSecret('SELF_HOSTED_WHATSAPP_URL');
export const SELF_HOSTED_WHATSAPP_API_KEY = defineOptionalSecret('SELF_HOSTED_WHATSAPP_API_KEY');

/**
 * Transactional Email delivery secrets (for Account Deletion Ownership Verification)
 * Managed via Google Cloud Secret Manager and bound to Cloud Functions v2 callables.
 * NEVER exposed to client, APK, or public documents.
 * 
 * Configured in Secret Manager via:
 *   firebase functions:secrets:set SMTP_HOST
 *   firebase functions:secrets:set SMTP_PORT
 *   firebase functions:secrets:set SMTP_USER
 *   firebase functions:secrets:set SMTP_PASS
 *   firebase functions:secrets:set SMTP_FROM
 */
export const SMTP_HOST = defineSecret('SMTP_HOST');
export const SMTP_PORT = defineSecret('SMTP_PORT');
export const SMTP_USER = defineSecret('SMTP_USER');
export const SMTP_PASS = defineSecret('SMTP_PASS');
export const SMTP_FROM = defineSecret('SMTP_FROM');

/**
 * Unused placeholder: Resend API Key.
 * NOTE: The active email delivery service (emailDeliveryService.ts) exclusively implements
 * standard SMTP transport via nodemailer. RESEND_API_KEY is not implemented or used.
 * If Resend is used, configure it as an SMTP relay using SMTP_HOST=smtp.resend.com,
 * SMTP_PORT=465 or 587, SMTP_USER=resend, and SMTP_PASS=<your_resend_api_key>.
 */
export const RESEND_API_KEY = defineOptionalSecret('RESEND_API_KEY');
