jest.mock('expo-device', () => ({
  isDevice: true,
  modelName: 'TestDevice',
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'mock-expo-token' }),
  getDevicePushTokenAsync: jest.fn().mockResolvedValue({ data: 'mock-device-token' }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { MAX: 5 },
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'mock-project' } } },
}));

jest.mock('firebase/firestore', () => {
  return {
    doc: jest.fn((_db, col, id) => ({ path: `${col}/${id}`, id })),
    updateDoc: jest.fn().mockResolvedValue(undefined),
    deleteDoc: jest.fn().mockResolvedValue(undefined),
    setDoc: jest.fn().mockResolvedValue(undefined),
    serverTimestamp: jest.fn(() => ({ _methodName: 'serverTimestamp' })),
    arrayRemove: jest.fn((val) => ({ _methodName: 'arrayRemove', val })),
    arrayUnion: jest.fn((val) => ({ _methodName: 'arrayUnion', val })),
  };
});

jest.mock('@/lib/firebase', () => ({
  auth: { currentUser: { uid: 'userA' } },
  db: {},
}));

import { unregisterDevicePushToken, resetPushTokenMemoryCache } from './pushNotifications';

describe('Push Token Logout Cleanup (Task 2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPushTokenMemoryCache();
  });

  test('unregisterDevicePushToken handles missing userId gracefully without error', async () => {
    await expect(unregisterDevicePushToken('')).resolves.toBeUndefined();
    await expect(unregisterDevicePushToken('   ')).resolves.toBeUndefined();
  });

  test('unregisterDevicePushToken invokes deleteDoc on user_tokens and resets memory cache', async () => {
    const { deleteDoc } = require('firebase/firestore');
    await unregisterDevicePushToken('userA', 'token-device-123');

    expect(deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'user_tokens/userA' })
    );
  });

  test('unregisterDevicePushToken removes specific device token via arrayRemove', async () => {
    const { updateDoc, arrayRemove } = require('firebase/firestore');
    await unregisterDevicePushToken('userA', 'token-device-123');

    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/userA' }),
      expect.objectContaining({
        expo_push_tokens: expect.objectContaining({ _methodName: 'arrayRemove', val: 'token-device-123' }),
      })
    );
    expect(arrayRemove).toHaveBeenCalledWith('token-device-123');
  });

  test('network error or timeout during token removal does not throw or crash logout', async () => {
    const { updateDoc, deleteDoc } = require('firebase/firestore');
    updateDoc.mockRejectedValueOnce(new Error('Network request failed'));
    deleteDoc.mockRejectedValueOnce(new Error('Network request failed'));

    await expect(unregisterDevicePushToken('userA', 'token-device-123')).resolves.not.toThrow();
  });
});
