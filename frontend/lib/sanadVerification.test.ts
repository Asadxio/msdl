import {
  getSanadVerificationUrl,
  getSanadQrCodeUrl,
  verifySanadById,
} from './sanadVerification';

// Mock Firestore
jest.mock('firebase/firestore', () => {
  const actual = jest.requireActual('firebase/firestore');
  return {
    ...actual,
    collection: jest.fn(() => ({ id: 'certificates' })),
    doc: jest.fn((...args: any[]) => {
      const docId = args[args.length - 1] || 'test_cert_id';
      return { id: docId, path: 'certificates/' + docId };
    }),
    getDoc: jest.fn((docRef: any) => {
      if (docRef.id === 'MSLB-VALID-123') {
        return Promise.resolve({
          exists: () => true,
          data: () => ({
            user_name: 'Fatima Zahra',
            course_name: 'Fiqh & Hadith Course',
            completion_date: '2026-09-02',
            hijri_date: '1448ھ',
            grade_label: 'ممتاز (Distinction)',
            percentage: 98,
          }),
        });
      }
      return Promise.resolve({ exists: () => false });
    }),
    getDocs: jest.fn(() =>
      Promise.resolve({
        empty: true,
        docs: [],
      })
    ),
    query: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
  };
});

describe('Sanad Verification & QR Code Module', () => {
  it('generates accurate verification URLs', () => {
    const url = getSanadVerificationUrl('MSLB-CERT-786');
    expect(url).toBe('https://mslb.app/verify-sanad?id=MSLB-CERT-786');
  });

  it('generates high-res QR code URL with official styling', () => {
    const qrUrl = getSanadQrCodeUrl('MSLB-CERT-786');
    expect(qrUrl).toContain('https://api.qrserver.com/v1/create-qr-code/');
    expect(qrUrl).toContain('005F46');
  });

  it('verifies an authentic Sanad document correctly', async () => {
    const result = await verifySanadById('MSLB-VALID-123');
    expect(result).not.toBeNull();
    expect(result?.verified).toBe(true);
    expect(result?.studentName).toBe('Fatima Zahra');
    expect(result?.courseName).toBe('Fiqh & Hadith Course');
    expect(result?.gradeLabel).toContain('ممتاز');
  });

  it('gracefully returns null for fabricated/invalid certificate IDs', async () => {
    const result = await verifySanadById('INVALID-FAKE-ID');
    expect(result).toBeNull();
  });

  it('returns null for empty or too short IDs', async () => {
    const result = await verifySanadById('a');
    expect(result).toBeNull();
  });
});
