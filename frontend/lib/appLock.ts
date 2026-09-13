/**
 * appLock.ts
 * Enterprise Biometric (Fingerprint/Face ID) & 4-Digit PIN App Lock Engine
 * for Madrasatu-s-Salikat Lil Banat.
 * 
 * Provides defense-in-depth protection for female students' confidential records,
 * Taharat logs, Fatawa inquiries, and teacher communications.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Safe dynamic access to expo-local-authentication with defensive fallback
let LocalAuth: typeof import('expo-local-authentication') | null = null;
try {
  LocalAuth = require('expo-local-authentication');
} catch {
  LocalAuth = null;
}

export const APP_LOCK_ENABLED_KEY = '@mslb_app_lock_enabled';
export const APP_LOCK_PIN_KEY = '@mslb_app_lock_pin';
export const APP_LOCK_BIOMETRIC_KEY = '@mslb_app_lock_biometric';
export const APP_LOCK_TIMEOUT_KEY = '@mslb_app_lock_timeout_ms';

export const TIMEOUT_OPTIONS = [
  { label: 'Immediately on exit', value: 0 },
  { label: 'After 1 minute', value: 60 * 1000 },
  { label: 'After 5 minutes', value: 5 * 60 * 1000 },
] as const;

export interface BiometricCapabilities {
  hasHardware: boolean;
  isEnrolled: boolean;
  biometricType: 'FINGERPRINT' | 'FACIAL_RECOGNITION' | 'BIOMETRIC' | 'NONE';
}

// In-memory session state
let _sessionUnlocked = false;
let _lastBackgroundTimestamp = 0;
let _failedAttempts = 0;
let _lockoutUntil = 0;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds

/**
 * Checks if the device has biometric hardware and registered fingerprints/faces
 */
export async function checkBiometricCapabilities(): Promise<BiometricCapabilities> {
  if (!LocalAuth) {
    return { hasHardware: false, isEnrolled: false, biometricType: 'NONE' };
  }

  try {
    const hasHardware = await LocalAuth.hasHardwareAsync();
    const isEnrolled = hasHardware ? await LocalAuth.isEnrolledAsync() : false;
    let biometricType: BiometricCapabilities['biometricType'] = 'NONE';

    if (hasHardware) {
      const types = await LocalAuth.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuth.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = 'FACIAL_RECOGNITION';
      } else if (types.includes(LocalAuth.AuthenticationType.FINGERPRINT)) {
        biometricType = 'FINGERPRINT';
      } else if (types.length > 0) {
        biometricType = 'BIOMETRIC';
      }
    }

    return { hasHardware, isEnrolled, biometricType };
  } catch (err) {
    console.log('[AppLock] Error checking biometrics:', err);
    return { hasHardware: false, isEnrolled: false, biometricType: 'NONE' };
  }
}

/**
 * Triggers native system biometric prompt (Fingerprint / Face ID)
 */
export async function authenticateWithBiometrics(
  promptMessage = 'Verify your identity to unlock Madrasatu-s-Salikat'
): Promise<{ success: boolean; error?: string }> {
  if (!LocalAuth) {
    return { success: false, error: 'Biometric hardware unavailable' };
  }

  try {
    const caps = await checkBiometricCapabilities();
    if (!caps.hasHardware || !caps.isEnrolled) {
      return { success: false, error: 'No biometrics registered on device' };
    }

    const result = await LocalAuth.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true, // We provide our own custom in-app 4-digit PIN fallback
    });

    if (result.success) {
      unlockSession();
      resetFailedAttempts();
      return { success: true };
    }

    return { success: false, error: result.error || 'Authentication cancelled' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Biometric authentication error' };
  }
}

/**
 * Configuration & Persistence
 */
export async function isAppLockEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(APP_LOCK_BIOMETRIC_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function getLockTimeoutMs(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(APP_LOCK_TIMEOUT_KEY);
    return val !== null ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export async function saveAppLockConfig(
  pin: string,
  useBiometric: boolean,
  timeoutMs = 0
): Promise<{ success: boolean; error?: string }> {
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return { success: false, error: 'PIN must be exactly 4 digits' };
  }

  try {
    await AsyncStorage.multiSet([
      [APP_LOCK_ENABLED_KEY, 'true'],
      [APP_LOCK_PIN_KEY, pin],
      [APP_LOCK_BIOMETRIC_KEY, useBiometric ? 'true' : 'false'],
      [APP_LOCK_TIMEOUT_KEY, timeoutMs.toString()],
    ]);
    _sessionUnlocked = true;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save App Lock settings' };
  }
}

export async function verifyAppPin(enteredPin: string): Promise<boolean> {
  if (isLockedOut()) return false;

  try {
    const storedPin = await AsyncStorage.getItem(APP_LOCK_PIN_KEY);
    if (!storedPin) return false;

    if (enteredPin === storedPin) {
      unlockSession();
      resetFailedAttempts();
      return true;
    } else {
      recordFailedPinAttempt();
      return false;
    }
  } catch {
    return false;
  }
}

export async function disableAppLock(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      APP_LOCK_ENABLED_KEY,
      APP_LOCK_PIN_KEY,
      APP_LOCK_BIOMETRIC_KEY,
    ]);
    _sessionUnlocked = true;
    resetFailedAttempts();
  } catch {}
}

/**
 * Session State Management
 */
export function isSessionUnlocked(): boolean {
  return _sessionUnlocked;
}

export function unlockSession(): void {
  _sessionUnlocked = true;
}

export function lockSession(): void {
  _sessionUnlocked = false;
}

export function recordBackgroundTimestamp(): void {
  _lastBackgroundTimestamp = Date.now();
}

export async function shouldLockOnResume(): Promise<boolean> {
  const enabled = await isAppLockEnabled();
  if (!enabled) return false;

  if (_lastBackgroundTimestamp === 0) {
    return true;
  }

  const timeoutMs = await getLockTimeoutMs();
  const elapsed = Date.now() - _lastBackgroundTimestamp;
  return elapsed >= timeoutMs;
}

/**
 * Failed Attempts & Cooldown Lockout Protection
 */
export function isLockedOut(): boolean {
  if (_lockoutUntil > Date.now()) {
    return true;
  }
  return false;
}

export function getRemainingLockoutSeconds(): number {
  if (!isLockedOut()) return 0;
  return Math.ceil((_lockoutUntil - Date.now()) / 1000);
}

export function recordFailedPinAttempt(): { isLockedOut: boolean; remainingSeconds: number } {
  _failedAttempts++;
  if (_failedAttempts >= MAX_FAILED_ATTEMPTS) {
    _lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    return { isLockedOut: true, remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000) };
  }
  return { isLockedOut: false, remainingSeconds: 0 };
}

export function resetFailedAttempts(): void {
  _failedAttempts = 0;
  _lockoutUntil = 0;
}
