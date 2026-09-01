import {
  classifyBleeding,
  getCurrentPurityStatus,
  calculateHoursBetween,
  HANAFI_FIQH_RULES,
  CycleEntry,
} from './taharatCalculator';

describe('Women Purity & Taharat Hanafi Fiqh Calculator', () => {
  it('correctly calculates hour differences between two ISO timestamps', () => {
    const start = '2026-09-01T00:00:00.000Z';
    const end = '2026-09-04T00:00:00.000Z'; // 3 days = 72h
    expect(calculateHoursBetween(start, end)).toBe(72);
  });

  it('classifies valid 5-day bleeding as valid Haiz under Hanafi Fiqh', () => {
    const start = '2026-09-01T00:00:00.000Z';
    const end = '2026-09-06T00:00:00.000Z'; // 5 days = 120h
    const res = classifyBleeding(start, end, 'haiz');

    expect(res.type).toBe('haiz');
    expect(res.durationDays).toBe(6);
    expect(res.isBelowMin).toBe(false);
    expect(res.isExceedingMax).toBe(false);
  });

  it('classifies bleeding under 72 hours as Istihaza (under minimum requirement)', () => {
    const start = '2026-09-01T00:00:00.000Z';
    const end = '2026-09-02T12:00:00.000Z'; // 36 hours (< 72h)
    const res = classifyBleeding(start, end, 'haiz');

    expect(res.type).toBe('istihaza');
    expect(res.isBelowMin).toBe(true);
  });

  it('classifies bleeding exceeding 10 days (240 hours) as Istihaza', () => {
    const start = '2026-09-01T00:00:00.000Z';
    const end = '2026-09-12T12:00:00.000Z'; // 11.5 days (> 240h)
    const res = classifyBleeding(start, end, 'haiz');

    expect(res.type).toBe('istihaza');
    expect(res.isExceedingMax).toBe(true);
  });

  it('classifies post-natal bleeding exceeding 40 days (960 hours) as Istihaza', () => {
    const start = '2026-08-01T00:00:00.000Z';
    const end = '2026-09-15T00:00:00.000Z'; // 45 days (> 40 days)
    const res = classifyBleeding(start, end, 'nifas');

    expect(res.type).toBe('istihaza');
    expect(res.isExceedingMax).toBe(true);
  });

  it('returns pure status when no entries are logged', () => {
    const status = getCurrentPurityStatus([]);
    expect(status.state).toBe('pure');
    expect(status.isSalahObligatory).toBe(true);
    expect(status.isFastingObligatory).toBe(true);
  });

  it('returns active Haiz status when an active cycle is in progress', () => {
    const entries: CycleEntry[] = [
      {
        id: 'c1',
        startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        type: 'haiz',
      },
    ];

    const status = getCurrentPurityStatus(entries, { haizDays: 7, tuhrDays: 21 });
    expect(status.state).toBe('haiz');
    expect(status.isSalahObligatory).toBe(false);
    expect(status.isFastingObligatory).toBe(false);
    expect(status.expectedGhuslDate).toBeDefined();
  });
});
