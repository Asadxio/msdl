jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import { SIX_KALMAS, getSixKalmas, searchKalmas } from './sixKalmasService';
import {
  DEFAULT_ZAKAT_INPUTS,
  calculateZakat,
  formatZakatNumber,
  parseZakatAmount,
  sanitizeDecimalInput,
} from './zakatService';

describe('Six Kalmas Service', () => {
  it('contains all 6 canonical Kalmas with Arabic, transliteration, English and Urdu', () => {
    const kalmas = getSixKalmas();
    expect(kalmas).toHaveLength(6);
    expect(SIX_KALMAS.map((k) => k.title)).toEqual([
      'First Kalma: Tayyab',
      'Second Kalma: Shahadat',
      'Third Kalma: Tamjeed',
      'Fourth Kalma: Tawheed',
      'Fifth Kalma: Astaghfar',
      'Sixth Kalma: Radde Kufr',
    ]);

    kalmas.forEach((k, idx) => {
      expect(k.number).toBe(idx + 1);
      expect(k.badge).toBe(`Kalma ${idx + 1}`);
      expect(k.arabicText.length).toBeGreaterThan(15);
      expect(k.transliteration.length).toBeGreaterThan(15);
      expect(k.englishTranslation.length).toBeGreaterThan(20);
      expect(k.urduTranslation.length).toBeGreaterThan(15);
    });
  });

  it('searches Six Kalmas by English title, Urdu term, and Arabic phrase', () => {
    expect(searchKalmas('Astaghfar')[0].number).toBe(5);
    expect(searchKalmas('شہادت')[0].number).toBe(2);
    expect(searchKalmas('سُبْحَانَ اللّٰهِ')[0].number).toBe(3);
  });
});

describe('Zakat Calculator Service', () => {
  it('returns zero due when metal price for selected Nisab standard is missing', () => {
    const res = calculateZakat({
      ...DEFAULT_ZAKAT_INPUTS,
      nisabStandard: 'silver',
      cashInHand: '500000',
      silverPricePerGram: '',
    });

    expect(res.netZakatableWealth).toBe(500000);
    expect(res.nisabThreshold).toBeNull();
    expect(res.missingSelectedNisabPrice).toBe(true);
    expect(res.isAboveNisab).toBe(false);
    expect(res.zakatDue).toBe(0);
  });

  it('calculates Silver Nisab (612.36g) threshold and 2.5% Zakat accurately', () => {
    // Silver price = 100 per gram -> Nisab = 61,236.00
    const res = calculateZakat({
      ...DEFAULT_ZAKAT_INPUTS,
      nisabStandard: 'silver',
      weightStandard: 'hanafi',
      silverPricePerGram: '100',
      goldPricePerGram: '8000',
      cashInHand: '20000',
      bankSavings: '80000',
      goldGrams: '10', // 80,000
      silverGrams: '50', // 5,000
      businessAssets: '25000',
      moneyOwedToYou: '10000',
      debtsAndBillsDue: '20000',
    });

    // Assets = 20k + 80k + 80k + 5k + 25k + 10k = 220,000
    // Net wealth = 220,000 - 20,000 = 200,000 >= 61,236
    // Zakat due = 200,000 * 0.025 = 5,000
    expect(res.nisabGramsUsed).toBe(612.36);
    expect(res.nisabThreshold).toBe(61236);
    expect(res.goldValue).toBe(80000);
    expect(res.silverValue).toBe(5000);
    expect(res.totalAssets).toBe(220000);
    expect(res.totalLiabilities).toBe(20000);
    expect(res.netZakatableWealth).toBe(200000);
    expect(res.isAboveNisab).toBe(true);
    expect(res.zakatDue).toBe(5000);
  });

  it('returns zero Zakat when Net Zakatable Wealth is below Nisab threshold', () => {
    const res = calculateZakat({
      ...DEFAULT_ZAKAT_INPUTS,
      nisabStandard: 'gold',
      weightStandard: 'hanafi',
      goldPricePerGram: '8000', // Gold Nisab = 87.48 * 8000 = 699,840
      cashInHand: '500000',
      debtsAndBillsDue: '50000',
    });

    expect(res.nisabGramsUsed).toBe(87.48);
    expect(res.nisabThreshold).toBe(699840);
    expect(res.netZakatableWealth).toBe(450000);
    expect(res.isAboveNisab).toBe(false);
    expect(res.zakatDue).toBe(0);
  });

  it('supports classical 85g / 595g weight option cleanly', () => {
    const res = calculateZakat({
      ...DEFAULT_ZAKAT_INPUTS,
      nisabStandard: 'gold',
      weightStandard: 'classical',
      goldPricePerGram: '100',
      cashInHand: '8500',
    });

    expect(res.nisabGramsUsed).toBe(85);
    expect(res.nisabThreshold).toBe(8500);
    expect(res.isAboveNisab).toBe(true);
    expect(res.zakatDue).toBe(212.5);
  });

  it('clamps Net Zakatable Wealth to 0 when liabilities exceed assets', () => {
    const res = calculateZakat({
      ...DEFAULT_ZAKAT_INPUTS,
      silverPricePerGram: '100',
      cashInHand: '10000',
      debtsAndBillsDue: '50000',
    });

    expect(res.netRawWealth).toBe(-40000);
    expect(res.netZakatableWealth).toBe(0);
    expect(res.isAboveNisab).toBe(false);
    expect(res.zakatDue).toBe(0);
  });

  it('flags missing metal rate when owned grams exist without rate', () => {
    const res = calculateZakat({
      ...DEFAULT_ZAKAT_INPUTS,
      nisabStandard: 'silver',
      silverPricePerGram: '100',
      goldGrams: '20',
      goldPricePerGram: '',
    });

    expect(res.missingGoldPriceForOwnedGold).toBe(true);
    expect(res.missingSilverPriceForOwnedSilver).toBe(false);
  });

  it('sanitizes decimals and formats currency cleanly', () => {
    expect(sanitizeDecimalInput('1,234.56abc')).toBe('1234.56');
    expect(sanitizeDecimalInput('12.34.56')).toBe('12.3456');
    expect(parseZakatAmount('1,500.75')).toBe(1500.75);
    expect(parseZakatAmount('-100')).toBe(0);
    expect(formatZakatNumber(0, 'NONE')).toBe('0.00');
    expect(formatZakatNumber(12500.5, 'INR')).toBe('₹12,500.50');
  });
});
