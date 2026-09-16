const mockCallable = jest.fn();

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(() => mockCallable),
}));

jest.mock('@/lib/firebase', () => ({
  functions: {},
  auth: {
    currentUser: {
      uid: 'test_student_123',
      getIdToken: jest.fn().mockResolvedValue('mock_id_token'),
    },
  },
  app: {},
}));

import { verifyRazorpayPayment, createRazorpayOrder } from './razorpayFunctions';
import { auth } from '@/lib/firebase';

describe('Razorpay Client Functions (Task 4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as any).currentUser = {
      uid: 'test_student_123',
      getIdToken: jest.fn().mockResolvedValue('mock_id_token'),
    };
  });

  test('verifyRazorpayPayment invokes Cloud Function callable with correct payload', async () => {
    mockCallable.mockResolvedValueOnce({
      data: {
        success: true,
        verified: true,
        alreadyCompleted: false,
        paymentDocId: 'pay_doc_abc',
        enrollmentId: 'test_student_123:course_tajweed',
      },
    });

    const result = await verifyRazorpayPayment({
      paymentDocId: 'pay_doc_abc',
      orderId: 'order_12345',
      paymentId: 'pay_98765',
      signature: 'sig_hmac_abc',
    });

    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.paymentDocId).toBe('pay_doc_abc');
    expect(mockCallable).toHaveBeenCalledWith({
      paymentDocId: 'pay_doc_abc',
      orderId: 'order_12345',
      paymentId: 'pay_98765',
      signature: 'sig_hmac_abc',
    });
  });

  test('verifyRazorpayPayment rejects if currentUser is null', async () => {
    (auth as any).currentUser = null;

    await expect(
      verifyRazorpayPayment({
        paymentDocId: 'pay_doc_abc',
        orderId: 'order_12345',
        paymentId: 'pay_98765',
        signature: 'sig_hmac_abc',
      })
    ).rejects.toThrow('Authentication required');
  });

  test('verifyRazorpayPayment handles server verification rejection gracefully', async () => {
    mockCallable.mockRejectedValueOnce(new Error('Payment signature verification failed.'));

    await expect(
      verifyRazorpayPayment({
        paymentDocId: 'pay_doc_abc',
        orderId: 'order_12345',
        paymentId: 'pay_98765',
        signature: 'invalid_sig',
      })
    ).rejects.toThrow('Payment signature verification failed.');
  });
});
