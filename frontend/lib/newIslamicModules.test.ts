const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage[key] || null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStorage[key];
  }),
}));

jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(async () => [
    { identifier: 'sunnah_fast_old_1' },
  ]),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => 'scheduled_id'),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

import {
  DEFAULT_ZAKAT_INPUTS,
  calculateZakat,
  sanitizeSignedDecimalInput,
} from './zakatService';
import {
  getSunnahFastingDays,
  scheduleSunnahFastingAlerts,
  loadFastingAlertsEnabled,
} from './islamicCalendarService';
import {
  SIX_KALMAS,
  getKalmaChunks,
  loadMemorizedKalmaIds,
  toggleMemorizedKalmaId,
} from './sixKalmasService';
import { parseOverpassElements, fetchNearbyPlaces } from './masjidFinderService';
import {
  getAllProphetNames,
  getDailyProphetName,
  searchProphetNames,
  getSeerahTimeline,
  toggleProphetFavoriteId,
} from './asmaUnNabiService';
import {
  MUHASABAH_HABITS,
  saveDailyMuhasabahLog,
  calculateMuhasabahStreak,
  addSadaqahEntry,
  loadSadaqahEntries,
  deleteSadaqahEntry,
} from './muhasabahService';
import { DEFAULT_WIRASAT_INPUTS, calculateWirasat } from './wirasatService';
import {
  RITUAL_STEPS,
  TAWAF_ROUND_LABELS,
  SAI_LAP_LABELS,
  saveTawafSaiState,
  loadTawafSaiState,
} from './umrahHajjService';

describe('Extended Madrasa & Islamic Ecosystem Modules', () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = origFetch;
  });

  it('calculates Zakat gold Karat purity scaling and signed custom Nisab offset', () => {
    expect(sanitizeSignedDecimalInput('-2,500abc.5')).toBe('-2500.5');

    const res = calculateZakat({
      ...DEFAULT_ZAKAT_INPUTS,
      nisabStandard: 'silver',
      silverPricePerGram: '100', // base Nisab 61,236
      customNisabOffset: '-1236', // adjusted Nisab 60,000
      goldPricePerGram: '8000',
      goldGrams: '12',
      goldPurityKarat: 18, // 18/24 = 0.75 * 12 * 8000 = 72,000
    });

    expect(res.goldPurityKaratUsed).toBe(18);
    expect(res.goldValue).toBe(72000);
    expect(res.nisabOffsetApplied).toBe(-1236);
    expect(res.nisabThreshold).toBe(60000);
    expect(res.isAboveNisab).toBe(true);
    expect(res.zakatDue).toBe(1800);
  });

  it('computes upcoming Sunnah fasting days and schedules alerts safely', async () => {
    const fasts = getSunnahFastingDays(new Date(2026, 10, 26, 12, 0, 0), 0, 21);
    expect(fasts.length).toBeGreaterThan(2);
    expect(fasts.some((f) => f.type === 'ayyam_al_bid' || f.type === 'mon_thu')).toBe(true);

    const count = await scheduleSunnahFastingAlerts(true, 0);
    expect(count).toBeGreaterThan(0);
    expect(await loadFastingAlertsEnabled()).toBe(true);
  });

  it('provides Six Kalmas audio URLs, Kids chunks, and memorization persistence', async () => {
    SIX_KALMAS.forEach((k) => {
      expect(k.audioUrl).toContain('https://archive.org/download/kalma_5/');
    });
    const chunks = getKalmaChunks(SIX_KALMAS[2].arabicText);
    expect(chunks.length).toBeGreaterThanOrEqual(4);

    const afterAdd = await toggleMemorizedKalmaId('kalma-1');
    expect(afterAdd).toContain('kalma-1');
    expect(await loadMemorizedKalmaIds()).toContain('kalma-1');
    const afterRemove = await toggleMemorizedKalmaId('kalma-1');
    expect(afterRemove).not.toContain('kalma-1');
  });

  it('finds nearby Halal restaurants and Masjids with Overpass & Nominatim', async () => {
    const halalParsed = parseOverpassElements(
      [{ type: 'node', id: 10, lat: 19.08, lon: 72.88, tags: { name: 'Al-Baik Halal', 'diet:halal': 'yes' } }],
      19.076,
      72.8777,
      'halal'
    );
    expect(halalParsed[0].category).toBe('halal');
    expect(halalParsed[0].name).toBe('Al-Baik Halal');

    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        elements: [{ type: 'node', id: 11, lat: 19.077, lon: 72.8777, tags: { name: 'Halal Kitchen' } }],
      }),
    })) as any;

    const halalSpots = await fetchNearbyPlaces(19.076, 72.8777, 5000, 'halal');
    expect(halalSpots).toHaveLength(1);
    expect(halalSpots[0].category).toBe('halal');
  });

  it('loads all 99 Asma-un-Nabi names and chronological Makki/Madani Seerah timeline', async () => {
    const names = getAllProphetNames();
    expect(names).toHaveLength(99);
    expect(names[0].transliteration).toBe('Muhammad');
    expect(getDailyProphetName(new Date(2026, 10, 26)).id).toBeGreaterThanOrEqual(1);
    expect(searchProphetNames('Trustworthy').some((n) => n.transliteration === 'Amin')).toBe(true);

    const makki = getSeerahTimeline('Makki');
    const madani = getSeerahTimeline('Madani');
    expect(makki.length).toBeGreaterThanOrEqual(7);
    expect(madani.length).toBeGreaterThanOrEqual(6);

    const favs = await toggleProphetFavoriteId(1);
    expect(favs).toContain(1);
  });

  it('tracks Daily Muhasabah streak and private Sadaqah journal entries', async () => {
    const today = new Date(2026, 10, 26);
    const logs = await saveDailyMuhasabahLog({
      dateKey: '2026-11-26',
      completedHabitIds: [MUHASABAH_HABITS[0].id, MUHASABAH_HABITS[1].id],
      reflectionNote: 'Alhamdulillah',
      updatedAt: Date.now(),
    });
    expect(calculateMuhasabahStreak(logs, today)).toBe(1);

    const added = await addSadaqahEntry({
      amount: 500,
      currency: 'INR',
      recipientCategory: 'Poor & Needy',
      intentionNote: 'Friday Sadaqah',
    });
    expect(added).toHaveLength(1);
    const loaded = await loadSadaqahEntries();
    expect(loaded[0].amount).toBe(500);
    const afterDel = await deleteSadaqahEntry(added[0].id);
    expect(afterDel).toHaveLength(0);
  });

  it('computes Qur’anic Mirath (Wirasat) shares accurately including Wasiyyah 1/3 cap', () => {
    // Husband deceased, Wife + Father + Mother + 1 Son + 1 Daughter, Estate 240,000
    // Wife 1/8 = 30k, Father 1/6 = 40k, Mother 1/6 = 40k -> Residue = 130k (Son 2/3, Daughter 1/3)
    const res = calculateWirasat({
      ...DEFAULT_WIRASAT_INPUTS,
      estateAmount: 240000,
      wasiyyahAmount: 120000, // exceeds 1/3 (80,000), must be capped at 80,000 -> net 160,000
    });
    expect(res.wasiyyahCapped).toBe(true);
    expect(res.netEstate).toBe(160000);

    const sumPct = res.shares.reduce((s, r) => s + r.percentage, 0);
    expect(Math.round(sumPct)).toBe(100);
  });

  it('provides Umrah/Hajj guide steps and persists 7-round Tawaf/Sa’i counter', async () => {
    expect(RITUAL_STEPS.filter((r) => r.ritual === 'Umrah')).toHaveLength(5);
    expect(RITUAL_STEPS.filter((r) => r.ritual === 'Hajj')).toHaveLength(4);
    expect(TAWAF_ROUND_LABELS).toHaveLength(7);
    expect(SAI_LAP_LABELS).toHaveLength(7);

    await saveTawafSaiState({ mode: 'sai', completedRounds: 5, updatedAt: Date.now() });
    const st = await loadTawafSaiState();
    expect(st.mode).toBe('sai');
    expect(st.completedRounds).toBe(5);
  });
});
