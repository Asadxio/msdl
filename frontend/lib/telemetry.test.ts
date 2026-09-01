// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: { version: '1.0.0' },
  platform: { android: {} },
}));

import {
  classifySeverity,
  reportTelemetryError,
  updateTelemetryErrorStatus,
} from './telemetry';

// Mock Firestore
jest.mock('firebase/firestore', () => {
  const actual = jest.requireActual('firebase/firestore');
  return {
    ...actual,
    collection: jest.fn(() => ({ id: 'telemetry_errors' })),
    doc: jest.fn((col, id) => ({ id: id || 'test_err_doc', path: 'telemetry_errors/' + (id || 'test_err_doc') })),
    setDoc: jest.fn().mockResolvedValue(undefined),
    updateDoc: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    onSnapshot: jest.fn((q, cb) => {
      cb({
        forEach: jest.fn(),
      });
      return jest.fn();
    }),
    serverTimestamp: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  };
});

describe('Real-Time Telemetry & Error Engine', () => {
  it('correctly classifies critical errors (payment failures, crashes)', () => {
    expect(classifySeverity('payment', 'Razorpay signature failed')).toBe('critical');
    expect(classifySeverity('crash', 'Unhandled React render crash')).toBe('critical');
    expect(classifySeverity('general', 'Fatal unexpected termination')).toBe('critical');
  });

  it('correctly classifies high severity errors (live class WebRTC, auth)', () => {
    expect(classifySeverity('live_class', 'WebRTC peer connection timeout')).toBe('high');
    expect(classifySeverity('auth', 'Firebase permission-denied')).toBe('high');
  });

  it('correctly classifies medium and low severity errors', () => {
    expect(classifySeverity('audio_dars', 'Network timeout while downloading audio')).toBe('medium');
    expect(classifySeverity('ui', 'Minor icon layout glitch')).toBe('low');
  });

  it('reports a telemetry error document and returns errorId', async () => {
    const errorId = await reportTelemetryError({
      category: 'payment',
      message: 'Payment verification failed for order_123',
      userId: 'u_student_99',
      userEmail: 'student@example.com',
      screenRoute: '/payment',
    });

    expect(errorId).toBeTruthy();
    expect(errorId).toContain('err_');
  });

  it('throttles duplicate error reports with the same fingerprint', async () => {
    const firstCall = await reportTelemetryError({
      category: 'network',
      message: 'Duplicate socket timeout',
      screenRoute: '/chat',
    });
    expect(firstCall).toBeTruthy();

    // Immediate second call should be throttled (return null)
    const secondCall = await reportTelemetryError({
      category: 'network',
      message: 'Duplicate socket timeout',
      screenRoute: '/chat',
    });
    expect(secondCall).toBeNull();
  });

  it('updates telemetry error status with admin notes', async () => {
    await expect(
      updateTelemetryErrorStatus('err_test_1', 'resolved', 'Fixed via server patch')
    ).resolves.not.toThrow();
  });
});
