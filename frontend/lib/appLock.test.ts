const mockStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
  setItem: jest.fn((key: string, val: string) => { mockStore[key] = val; return Promise.resolve(); }),
  removeItem: jest.fn((key: string) => { delete mockStore[key]; return Promise.resolve(); }),
  multiSet: jest.fn((pairs: [string, string][]) => {
    pairs.forEach(([k, v]) => { mockStore[k] = v; });
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach((k) => { delete mockStore[k]; });
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
    return Promise.resolve();
  }),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([1]), // Fingerprint
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
  },
}));

import {
  saveAppLockConfig,
  verifyAppPin,
  isAppLockEnabled,
  isBiometricEnabled,
  getLockTimeoutMs,
  disableAppLock,
  isSessionUnlocked,
  unlockSession,
  lockSession,
  isLockedOut,
  resetFailedAttempts,
  checkBiometricCapabilities,
  authenticateWithBiometrics,
} from './appLock';

describe('appLock Module', () => {
  beforeEach(async () => {
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
    resetFailedAttempts();
    lockSession();
    jest.clearAllMocks();
  });

  describe('saveAppLockConfig & PIN Validation', () => {
    it('rejects invalid PINs (not 4 digits)', async () => {
      const res1 = await saveAppLockConfig('12', true);
      expect(res1.success).toBe(false);

      const res2 = await saveAppLockConfig('12345', true);
      expect(res2.success).toBe(false);

      const res3 = await saveAppLockConfig('abcd', true);
      expect(res3.success).toBe(false);
    });

    it('successfully saves valid 4-digit PIN and config', async () => {
      const res = await saveAppLockConfig('4321', true, 60000);
      expect(res.success).toBe(true);

      expect(await isAppLockEnabled()).toBe(true);
      expect(await isBiometricEnabled()).toBe(true);
      expect(await getLockTimeoutMs()).toBe(60000);
    });
  });

  describe('verifyAppPin', () => {
    beforeEach(async () => {
      await saveAppLockConfig('7860', true);
    });

    it('returns true when correct PIN is entered', async () => {
      const isValid = await verifyAppPin('7860');
      expect(isValid).toBe(true);
      expect(isSessionUnlocked()).toBe(true);
    });

    it('returns false when incorrect PIN is entered', async () => {
      const isValid = await verifyAppPin('1111');
      expect(isValid).toBe(false);
    });

    it('triggers security lockout after 5 consecutive failed attempts', async () => {
      expect(isLockedOut()).toBe(false);

      await verifyAppPin('0001');
      await verifyAppPin('0002');
      await verifyAppPin('0003');
      await verifyAppPin('0004');
      const res5 = await verifyAppPin('0005');

      expect(res5).toBe(false);
      expect(isLockedOut()).toBe(true);

      // Even correct PIN fails while locked out
      const lockedAttempt = await verifyAppPin('7860');
      expect(lockedAttempt).toBe(false);

      // After reset, correct PIN works again
      resetFailedAttempts();
      expect(isLockedOut()).toBe(false);
      const unlockedAttempt = await verifyAppPin('7860');
      expect(unlockedAttempt).toBe(true);
    });
  });

  describe('Session State', () => {
    it('toggles session lock and unlock in memory', () => {
      lockSession();
      expect(isSessionUnlocked()).toBe(false);

      unlockSession();
      expect(isSessionUnlocked()).toBe(true);
    });
  });

  describe('disableAppLock', () => {
    it('clears stored lock config and unlocks session', async () => {
      await saveAppLockConfig('9999', true);
      expect(await isAppLockEnabled()).toBe(true);

      await disableAppLock();
      expect(await isAppLockEnabled()).toBe(false);
      expect(await isBiometricEnabled()).toBe(false);
    });
  });

  describe('Biometric Capabilities', () => {
    it('detects fingerprint hardware and enrollment from mocked LocalAuthentication', async () => {
      const caps = await checkBiometricCapabilities();
      expect(caps.hasHardware).toBe(true);
      expect(caps.isEnrolled).toBe(true);
      expect(caps.biometricType).toBe('FINGERPRINT');
    });

    it('authenticates via biometrics successfully', async () => {
      const res = await authenticateWithBiometrics();
      expect(res.success).toBe(true);
      expect(isSessionUnlocked()).toBe(true);
    });
  });
});
