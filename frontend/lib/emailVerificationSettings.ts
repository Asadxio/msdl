import type { ActionCodeSettings } from 'firebase/auth';

/**
 * ActionCodeSettings for Madrasa Tus Salikat Lil Banat Email Verification.
 * 
 * Directs users back to the official application portal upon clicking the link
 * in the verification email.
 */
export const VERIFICATION_ACTION_CODE_SETTINGS: ActionCodeSettings = {
  url: 'https://madrasa-app-50d6c.firebaseapp.com/auth/login',
  handleCodeInApp: false,
};
