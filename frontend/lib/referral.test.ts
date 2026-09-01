import {
  generateReferralCode,
  getSadqahTier,
  getReferralShareMessage,
  recordReferralSignup,
} from './referral';

// Mock Firestore
jest.mock('firebase/firestore', () => {
  const actual = jest.requireActual('firebase/firestore');
  return {
    ...actual,
    collection: jest.fn(() => ({ id: 'referral_records' })),
    doc: jest.fn((col, id) => ({ id: id || 'test_doc', path: 'referral_records/' + (id || 'test_doc') })),
    setDoc: jest.fn().mockResolvedValue(undefined),
    updateDoc: jest.fn().mockResolvedValue(undefined),
    getDocs: jest.fn().mockResolvedValue({
      empty: false,
      docs: [{ id: 'ref_user_1', data: () => ({ name: 'Umm Fatima' }) }],
    }),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    increment: jest.fn((n) => n),
    onSnapshot: jest.fn((q, cb) => {
      cb({
        forEach: jest.fn(),
      });
      return jest.fn();
    }),
    serverTimestamp: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  };
});

describe('Sadqah-e-Jariyah & Dawat Referral Module', () => {
  it('generates a clean Islamic referral code', () => {
    const code = generateReferralCode('user_abc1234', 'Fatima');
    expect(code).toBe('MSLB-FATIM-1234');
  });

  it('calculates Sadqah-e-Jariyah milestone tiers accurately', () => {
    const beginner = getSadqahTier(2);
    expect(beginner.badge).toContain('داعیۂ ابتدائی');

    const ambassador = getSadqahTier(7);
    expect(ambassador.badge).toContain('مبلّغۂ خیر');

    const senior = getSadqahTier(20);
    expect(senior.badge).toContain('داعیۂ اسلام');
  });

  it('formats Islamic WhatsApp invitation share message with Hadith', () => {
    const msg = getReferralShareMessage('MSLB-AYESH-999', 'Ayesha');
    expect(msg).toContain('MSLB-AYESH-999');
    expect(msg).toContain('مَنْ دَلَّ عَلَى خَيْرٍ فَلَهُ مِثْلُ أَجْرِ فَاعِلِهِ');
    expect(msg).toContain('مدرسۃ السالکات للبنات');
  });

  it('records referral signup and links to referrer', async () => {
    const result = await recordReferralSignup({
      newStudentUid: 'new_student_55',
      newStudentName: 'Zainab Bibi',
      referralCode: 'MSLB-AYESH-999',
    });

    expect(result).toBe(true);
  });

  it('gracefully rejects invalid referral codes', async () => {
    const result = await recordReferralSignup({
      newStudentUid: 'new_student_55',
      newStudentName: 'Zainab Bibi',
      referralCode: 'INVALID-CODE',
    });

    expect(result).toBe(false);
  });
});
