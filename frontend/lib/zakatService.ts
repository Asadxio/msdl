import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// SUFFAH — Zakat Calculator Service & Nisab Jurisprudence Engine
// Standard Rate: 2.5% (1/40th) on net zakatable wealth >= Nisab held 1 lunar year
// ─────────────────────────────────────────────────────────────────────────────

export type NisabStandard = 'silver' | 'gold';
export type WeightStandard = 'hanafi' | 'classical';
export type CurrencyCode = 'NONE' | 'INR' | 'USD' | 'PKR' | 'GBP' | 'SAR';

export const ZAKAT_RATE = 0.025; // 2.5% (one-fortieth)
export const TOLA_IN_GRAMS = 11.664;

export const NISAB_WEIGHTS: Record<
  WeightStandard,
  { goldGrams: number; silverGrams: number; label: string; summary: string }
> = {
  hanafi: {
    goldGrams: 87.48, // 20 Mithqal * 4.374g = 7.5 Tola
    silverGrams: 612.36, // 200 Dirhams * 3.0618g = 52.5 Tola
    label: 'Hanafi / Standard (87.48g Gold · 612.36g Silver)',
    summary: '7.5 Tola Gold (87.48g) or 52.5 Tola Silver (612.36g)',
  },
  classical: {
    goldGrams: 85, // 20 Mithqal * 4.25g
    silverGrams: 595, // 200 Dirhams * 2.975g
    label: 'Classical / 85g–595g (85g Gold · 595g Silver)',
    summary: '85g Gold or 595g Silver (4.25g Mithqal standard)',
  },
};

export const CURRENCY_OPTIONS: ReadonlyArray<{
  code: CurrencyCode;
  symbol: string;
  label: string;
}> = [
  { code: 'NONE', symbol: '', label: 'Numeric (0.00)' },
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'PKR', symbol: 'Rs ', label: 'PKR (Rs)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'SAR', symbol: 'SAR ', label: 'SAR' },
];

export type GoldKarat = 24 | 22 | 21 | 18;

export interface ZakatInputs {
  nisabStandard: NisabStandard;
  weightStandard: WeightStandard;
  currency: CurrencyCode;
  goldPricePerGram: string;
  silverPricePerGram: string;
  cashInHand: string;
  bankSavings: string;
  goldGrams: string;
  silverGrams: string;
  businessAssets: string;
  moneyOwedToYou: string;
  debtsAndBillsDue: string;
  goldPurityKarat?: GoldKarat;
  customNisabOffset?: string;
}

export interface ZakatBreakdown {
  goldPrice: number;
  silverPrice: number;
  cashInHand: number;
  bankSavings: number;
  goldGrams: number;
  goldValue: number;
  silverGrams: number;
  silverValue: number;
  businessAssets: number;
  moneyOwedToYou: number;
  totalAssets: number;
  totalLiabilities: number;
  netRawWealth: number;
  netZakatableWealth: number;
  nisabGramsUsed: number;
  nisabThreshold: number | null;
  nisabOffsetApplied?: number;
  goldPurityKaratUsed?: GoldKarat;
  isAboveNisab: boolean;
  zakatDue: number;
  missingSelectedNisabPrice: boolean;
  missingGoldPriceForOwnedGold: boolean;
  missingSilverPriceForOwnedSilver: boolean;
}

export const DEFAULT_ZAKAT_INPUTS: ZakatInputs = {
  nisabStandard: 'silver',
  weightStandard: 'hanafi',
  currency: 'NONE',
  goldPricePerGram: '',
  silverPricePerGram: '',
  cashInHand: '',
  bankSavings: '',
  goldGrams: '',
  silverGrams: '',
  businessAssets: '',
  moneyOwedToYou: '',
  debtsAndBillsDue: '',
  goldPurityKarat: 24,
  customNisabOffset: '',
};

const STORAGE_KEY = '@suffah_zakat_inputs_v1';

export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Sanitizes user input from mobile numeric keyboards: strips commas/non-digits,
 * allows at most one decimal separator, and avoids leading crashes.
 */
export function sanitizeDecimalInput(raw: string): string {
  const cleaned = raw.replace(/,/g, '').replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  const before = cleaned.slice(0, firstDot + 1);
  const after = cleaned.slice(firstDot + 1).replace(/\./g, '');
  return `${before}${after}`;
}

export function sanitizeSignedDecimalInput(raw: string): string {
  const trimmed = raw.trimStart();
  const isNeg = trimmed.startsWith('-');
  const unsigned = sanitizeDecimalInput(trimmed);
  return isNeg ? `-${unsigned}` : unsigned;
}

export function parseSignedAmount(raw: string): number {
  if (!raw || typeof raw !== 'string') return 0;
  const normalized = raw.replace(/,/g, '').trim();
  if (!normalized || normalized === '.' || normalized === '-' || normalized === '-.') return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseZakatAmount(raw: string): number {
  if (!raw || typeof raw !== 'string') return 0;
  const normalized = raw.replace(/,/g, '').trim();
  if (!normalized || normalized === '.') return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

export function formatZakatNumber(amount: number, currency: CurrencyCode = 'NONE'): string {
  const safe = Number.isFinite(amount) ? roundCurrency(amount) : 0;
  const formatted = safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const option = CURRENCY_OPTIONS.find((c) => c.code === currency);
  return option?.symbol ? `${option.symbol}${formatted}` : formatted;
}

/**
 * Computes full Zakat obligations following Islamic jurisprudence rules:
 * - Calculates gold (scaled by Karat purity, default 24K) & silver market value from gram weights * per-gram rates.
 * - Deducts immediate due liabilities/debts from total zakatable assets.
 * - Verifies Net Wealth against chosen Nisab standard (Silver or Gold) + optional Custom Nisab Offset.
 * - Applies standard 2.5% Zakat rate when net wealth meets or exceeds Nisab.
 */
export function calculateZakat(inputs: ZakatInputs): ZakatBreakdown {
  const weights = NISAB_WEIGHTS[inputs.weightStandard] || NISAB_WEIGHTS.hanafi;

  const goldPrice = parseZakatAmount(inputs.goldPricePerGram);
  const silverPrice = parseZakatAmount(inputs.silverPricePerGram);
  const cashInHand = parseZakatAmount(inputs.cashInHand);
  const bankSavings = parseZakatAmount(inputs.bankSavings);
  const goldGrams = parseZakatAmount(inputs.goldGrams);
  const silverGrams = parseZakatAmount(inputs.silverGrams);
  const businessAssets = parseZakatAmount(inputs.businessAssets);
  const moneyOwedToYou = parseZakatAmount(inputs.moneyOwedToYou);
  const totalLiabilities = roundCurrency(parseZakatAmount(inputs.debtsAndBillsDue));

  const goldPurityKaratUsed: GoldKarat = inputs.goldPurityKarat || 24;
  const purityMultiplier = goldPurityKaratUsed / 24;
  const goldValue = roundCurrency(goldGrams * goldPrice * purityMultiplier);
  const silverValue = roundCurrency(silverGrams * silverPrice);

  const totalAssets = roundCurrency(
    cashInHand + bankSavings + goldValue + silverValue + businessAssets + moneyOwedToYou
  );

  const netRawWealth = roundCurrency(totalAssets - totalLiabilities);
  const netZakatableWealth = Math.max(0, netRawWealth);

  const nisabGramsUsed =
    inputs.nisabStandard === 'gold' ? weights.goldGrams : weights.silverGrams;

  const missingSelectedNisabPrice =
    (inputs.nisabStandard === 'silver' && silverPrice <= 0) ||
    (inputs.nisabStandard === 'gold' && goldPrice <= 0);

  const missingGoldPriceForOwnedGold = goldGrams > 0 && goldPrice <= 0;
  const missingSilverPriceForOwnedSilver = silverGrams > 0 && silverPrice <= 0;

  const nisabOffsetApplied = roundCurrency(parseSignedAmount(inputs.customNisabOffset || ''));

  const baseNisab = !missingSelectedNisabPrice
    ? roundCurrency(
        inputs.nisabStandard === 'gold'
          ? nisabGramsUsed * goldPrice
          : nisabGramsUsed * silverPrice
      )
    : null;

  const nisabThreshold =
    baseNisab !== null ? Math.max(0, roundCurrency(baseNisab + nisabOffsetApplied)) : null;

  const isAboveNisab =
    nisabThreshold !== null && nisabThreshold > 0 && netZakatableWealth >= nisabThreshold;

  const zakatDue = isAboveNisab ? roundCurrency(netZakatableWealth * ZAKAT_RATE) : 0;

  return {
    goldPrice,
    silverPrice,
    cashInHand,
    bankSavings,
    goldGrams,
    goldValue,
    silverGrams,
    silverValue,
    businessAssets,
    moneyOwedToYou,
    totalAssets,
    totalLiabilities,
    netRawWealth,
    netZakatableWealth,
    nisabGramsUsed,
    nisabThreshold,
    nisabOffsetApplied,
    goldPurityKaratUsed,
    isAboveNisab,
    zakatDue,
    missingSelectedNisabPrice,
    missingGoldPriceForOwnedGold,
    missingSilverPriceForOwnedSilver,
  };
}

export async function loadZakatInputs(): Promise<ZakatInputs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ZAKAT_INPUTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_ZAKAT_INPUTS, ...parsed };
  } catch {
    return { ...DEFAULT_ZAKAT_INPUTS };
  }
}

export async function saveZakatInputs(inputs: ZakatInputs): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch {
    // Non-fatal persistence error
  }
}

export async function clearZakatInputs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
}

export const TROY_OUNCE_IN_GRAMS = 31.1034768;

export interface LiveMetalPricesResult {
  currency: Exclude<CurrencyCode, 'NONE'>;
  goldPerGram: number;
  silverPerGram: number;
  source: string;
  updatedAt: string;
}

/**
 * Converts a troy-ounce metal price into rounded per-gram price.
 */
export function convertTroyOunceToPerGram(pricePerTroyOunce: number): number {
  if (!Number.isFinite(pricePerTroyOunce) || pricePerTroyOunce <= 0) return 0;
  return roundCurrency(pricePerTroyOunce / TROY_OUNCE_IN_GRAMS);
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 9000): Promise<any> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

/**
 * Fetches live Gold (XAU) & Silver (XAG) spot prices per gram using free, keyless APIs:
 * 1. Primary: fawazahmed0/currency-api (jsDelivr CDN + pages.dev mirror) directly in target currency.
 * 2. Fallback: api.gold-api.com USD spot combined with USD->target currency conversion.
 */
export async function fetchLiveMetalPrices(
  currency: CurrencyCode
): Promise<LiveMetalPricesResult> {
  const targetCurrency: Exclude<CurrencyCode, 'NONE'> =
    currency === 'NONE' ? 'INR' : currency;
  const codeLower = targetCurrency.toLowerCase();

  // Primary: fawazahmed0/currency-api XAU & XAG JSON (price per 1 troy ounce)
  const mirrors = [
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies',
    'https://currency-api.pages.dev/v1/currencies',
  ];

  for (const base of mirrors) {
    try {
      const [xauJson, xagJson] = await Promise.all([
        fetchJsonWithTimeout(`${base}/xau.json`),
        fetchJsonWithTimeout(`${base}/xag.json`),
      ]);
      const xauPerOz = Number(xauJson?.xau?.[codeLower]);
      const xagPerOz = Number(xagJson?.xag?.[codeLower]);
      if (Number.isFinite(xauPerOz) && xauPerOz > 0 && Number.isFinite(xagPerOz) && xagPerOz > 0) {
        return {
          currency: targetCurrency,
          goldPerGram: convertTroyOunceToPerGram(xauPerOz),
          silverPerGram: convertTroyOunceToPerGram(xagPerOz),
          source: 'Currency Exchange Spot API',
          updatedAt: String(xauJson?.date || new Date().toISOString().split('T')[0]),
        };
      }
    } catch {
      // try next mirror
    }
  }

  // Fallback: api.gold-api.com USD spot + usd.json conversion
  const [goldSpot, silverSpot] = await Promise.all([
    fetchJsonWithTimeout('https://api.gold-api.com/price/XAU'),
    fetchJsonWithTimeout('https://api.gold-api.com/price/XAG'),
  ]);

  const xauUsd = Number(goldSpot?.price);
  const xagUsd = Number(silverSpot?.price);
  if (!Number.isFinite(xauUsd) || xauUsd <= 0 || !Number.isFinite(xagUsd) || xagUsd <= 0) {
    throw new Error('Invalid metal spot response');
  }

  let fxRate = 1;
  if (targetCurrency !== 'USD') {
    const usdRates = await fetchJsonWithTimeout(`${mirrors[0]}/usd.json`);
    fxRate = Number(usdRates?.usd?.[codeLower]);
    if (!Number.isFinite(fxRate) || fxRate <= 0) {
      throw new Error(`Missing FX rate for ${targetCurrency}`);
    }
  }

  return {
    currency: targetCurrency,
    goldPerGram: convertTroyOunceToPerGram(xauUsd * fxRate),
    silverPerGram: convertTroyOunceToPerGram(xagUsd * fxRate),
    source: 'Gold-API Spot',
    updatedAt: String(goldSpot?.updatedAt || new Date().toISOString()),
  };
}
