import type { ActionCodeSettings } from 'firebase/auth';

/**
 * ActionCodeSettings for Madrasa Tus Salikat Lil Banat Email Verification.
 * 
 * Directs users back to the official application portal upon clicking the link
 * in the verification email, with native Android app redirection and fallback.
 */
export const VERIFICATION_ACTION_CODE_SETTINGS: ActionCodeSettings = {
  url: 'https://madrasa-app-50d6c.firebaseapp.com/auth/verify-redirect',
  handleCodeInApp: true,
  android: {
    packageName: 'com.madrasatussalikat.lilbanat',
    installApp: true,
    minimumVersion: '1',
  },
};

/**
 * ActionCodeSettings for Madrasa Tus Salikat Lil Banat Password Reset.
 * 
 * Directs users back to the official application portal upon completing password reset.
 */
export const PASSWORD_RESET_ACTION_CODE_SETTINGS: ActionCodeSettings = {
  url: 'https://madrasa-app-50d6c.firebaseapp.com/auth/verify-redirect',
  handleCodeInApp: true,
  android: {
    packageName: 'com.madrasatussalikat.lilbanat',
    installApp: true,
    minimumVersion: '1',
  },
};
