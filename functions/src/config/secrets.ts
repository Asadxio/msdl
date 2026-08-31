/**
 * MSLB Secret Manager Configuration
 * 
 * Firebase Functions v2 defineSecret() declarations.
 * Actual secret values are stored in Google Cloud Secret Manager.
 * 
 * DEPLOYMENT:
 *   firebase functions:secrets:set RAZORPAY_KEY_ID
 *   firebase functions:secrets:set RAZORPAY_KEY_SECRET
 * 
 * EMULATOR:
 *   Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET as environment variables.
 *   These are NEVER committed to source control.
 * 
 * IMPORTANT:
 *   RAZORPAY_KEY_ID = public key (rzp_live_... or rzp_test_...)
 *   RAZORPAY_KEY_SECRET = private key — NEVER expose to frontend
 */
import { defineSecret } from 'firebase-functions/params';

export const RAZORPAY_KEY_ID = defineSecret('RAZORPAY_KEY_ID');
export const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');
