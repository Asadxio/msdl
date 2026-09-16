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
 * Meta WhatsApp Cloud API credentials for Official Madrasa WhatsApp Business Sender (+91 63669 19122)
 * Bound ONLY to server-side onboarding communication functions.
 * NEVER exposed to client, APK, or public documents.
 */
export const WHATSAPP_API_TOKEN = defineSecret('WHATSAPP_API_TOKEN');
export const WHATSAPP_PHONE_NUMBER_ID = defineSecret('WHATSAPP_PHONE_NUMBER_ID');
export const WHATSAPP_BUSINESS_ACCOUNT_ID = defineSecret('WHATSAPP_BUSINESS_ACCOUNT_ID');

/**
 * Optional Transactional SMS gateway API key
 */
export const SMS_GATEWAY_API_KEY = defineSecret('SMS_GATEWAY_API_KEY');

/**
 * Self-Hosted WhatsApp Gateway credentials (e.g. Baileys / Evolution API standalone container)
 * Bound ONLY to server-side functions.
 */
export const SELF_HOSTED_WHATSAPP_URL = defineSecret('SELF_HOSTED_WHATSAPP_URL');
export const SELF_HOSTED_WHATSAPP_API_KEY = defineSecret('SELF_HOSTED_WHATSAPP_API_KEY');
