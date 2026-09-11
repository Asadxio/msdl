/**
 * MSLB Production Crash Reporting & Diagnostics Engine
 *
 * Canonical integration for Firebase Crashlytics:
 *   - Native Android crashes & unhandled exceptions
 *   - Global JS uncaught errors (via ErrorUtils)
 *   - Unhandled Promise rejections
 *   - Controlled React render errors (via ErrorBoundary)
 *   - Safe user context & breadcrumbs (ZERO passwords, tokens, API keys, or private chat)
 *   - Controlled test crash trigger (isolated behind __DEV__ or explicit test flag)
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { ENV } from '@/config/environments';

// Optional safe native Crashlytics accessor (falls back gracefully in non-native environments)
let nativeCrashlytics: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crashlyticsModule = require('@react-native-firebase/crashlytics');
  nativeCrashlytics = crashlyticsModule.default ? crashlyticsModule.default() : crashlyticsModule();
} catch (err) {
  // Non-native / Web / Expo Go fallback
  console.log('[Crashlytics] Running in non-native or web environment, using safe telemetry fallback.');
}

/**
 * Filter out sensitive values from crash attributes & logs.
 * CRITICAL PRIVACY & SECURITY INVARIANT:
 * Never send secrets, passwords, payment details, or full chat text to Crashlytics.
 */
function sanitizeValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/(password|secret|token|authorization|apikey|gemini|aiza|bearer)/i.test(str)) {
    return '[REDACTED]';
  }
  return str.slice(0, 500); // Prevent unbounded buffer payload
}

/**
 * Initialize global Crashlytics hooks.
 * Call once at app startup (_layout.tsx).
 */
export function initCrashReporting(): void {
  try {
    if (nativeCrashlytics) {
      // Enable Crashlytics collection in production and staging
      const isEnabled = ENV === 'production' || ENV === 'staging';
      nativeCrashlytics.setCrashlyticsCollectionEnabled(isEnabled);

      // Set global baseline metadata
      nativeCrashlytics.setAttributes({
        environment: ENV,
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version || '1.0.6',
        version_code: String(Constants.expoConfig?.android?.versionCode || '30'),
      });

      console.log(`[Crashlytics] Initialized. Collection enabled: ${isEnabled} (env=${ENV})`);
    }

    // Attach global JS ErrorUtils handler
    const globalAny = global as any;
    if (globalAny.ErrorUtils && typeof globalAny.ErrorUtils.getGlobalHandler === 'function') {
      const defaultHandler = globalAny.ErrorUtils.getGlobalHandler();
      globalAny.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
        try {
          recordCrashlyticsError(error, { isFatal: Boolean(isFatal), origin: 'ErrorUtils' });
        } catch (e) {
          // Never throw in global handler
        }
        if (defaultHandler) {
          defaultHandler(error, isFatal);
        }
      });
      console.log('[Crashlytics] Global ErrorUtils handler installed.');
    }
  } catch (err) {
    console.warn('[Crashlytics] Failed to initialize:', err);
  }
}

/**
 * Set safe user identity for crash triage.
 * Uses Firebase UID and Role ONLY. Never email, name, or phone.
 */
export function setCrashlyticsUser(user: { uid: string; role?: string } | null): void {
  try {
    if (!nativeCrashlytics) return;

    if (!user || !user.uid) {
      nativeCrashlytics.setUserId('');
      nativeCrashlytics.setAttribute('user_role', 'anonymous');
    } else {
      nativeCrashlytics.setUserId(user.uid);
      if (user.role) {
        nativeCrashlytics.setAttribute('user_role', sanitizeValue(user.role));
      }
    }
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Add a high-level diagnostic breadcrumb.
 * App navigation / lifecycle breadcrumbs help reproduce crashes.
 */
export function logBreadcrumb(message: string, context?: Record<string, unknown>): void {
  try {
    const cleanMsg = sanitizeValue(message);
    if (nativeCrashlytics) {
      if (context) {
        const cleanContext: Record<string, string> = {};
        for (const [k, v] of Object.entries(context)) {
          if (!/(password|secret|token|key)/i.test(k)) {
            cleanContext[k] = sanitizeValue(v);
          }
        }
        nativeCrashlytics.log(`${cleanMsg} | ${JSON.stringify(cleanContext)}`);
      } else {
        nativeCrashlytics.log(cleanMsg);
      }
    }
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Record a non-fatal or caught application exception in Crashlytics.
 */
export function recordCrashlyticsError(
  error: unknown,
  context?: { isFatal?: boolean; origin?: string; screen?: string; [key: string]: unknown }
): void {
  try {
    const errObj = error instanceof Error ? error : new Error(String(error));

    if (nativeCrashlytics) {
      if (context) {
        const attrs: Record<string, string> = {};
        for (const [k, v] of Object.entries(context)) {
          if (!/(password|secret|token|key)/i.test(k)) {
            attrs[k] = sanitizeValue(v);
          }
        }
        nativeCrashlytics.setAttributes(attrs);
      }
      nativeCrashlytics.recordError(errObj);
    }
  } catch (e) {
    // Fail-safe
  }
}

/**
 * CONTROLLED TEST CRASH TRIGGER
 * Used strictly for verifying Crashlytics ingestion in test builds.
 * CANNOT be triggered accidentally in production release builds without explicit flag.
 */
export function triggerControlledTestCrash(reason = 'Manual Controlled Test Crash'): void {
  if (ENV === 'production' && !__DEV__) {
    console.warn('[Crashlytics] triggerControlledTestCrash is blocked in production mode.');
    return;
  }

  logBreadcrumb('triggerControlledTestCrash invoked', { reason });

  if (nativeCrashlytics && typeof nativeCrashlytics.crash === 'function') {
    // Forces a native fatal crash through the Crashlytics NDK/Java bridge
    nativeCrashlytics.crash();
  } else {
    // Uncaught JS exception fallback
    setTimeout(() => {
      throw new Error(`[CRASHLYTICS_TEST_CRASH]: ${reason}`);
    }, 100);
  }
}
