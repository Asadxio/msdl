export type PurityState = 'pure' | 'haiz' | 'istihaza' | 'nifas';

export interface CycleEntry {
  id: string;
  startDate: string; // ISO string YYYY-MM-DDTHH:mm:ss
  endDate?: string;  // ISO string YYYY-MM-DDTHH:mm:ss
  type: 'haiz' | 'nifas' | 'istihaza';
  notes?: string;
  bleedingIntensity?: 'light' | 'medium' | 'heavy';
}

export interface UserHabit {
  haizDays: number; // typically 3 to 10, default 7
  tuhrDays: number; // minimum 15, default 21
  nifasDays?: number; // max 40, default 40
}

export interface PurityCalculationResult {
  state: PurityState;
  stateLabel: string;
  description: string;
  isSalahObligatory: boolean;
  isFastingObligatory: boolean;
  isGhuslRequiredNow: boolean;
  activeCycleDays: number;
  expectedGhuslDate?: string;
  fiqhDaleel: string;
}

export const HANAFI_FIQH_RULES = {
  MIN_HAIZ_HOURS: 72, // 3 days and 3 nights
  MAX_HAIZ_HOURS: 240, // 10 days and 10 nights
  MIN_TUHR_HOURS: 360, // 15 days and 15 nights
  MAX_NIFAS_HOURS: 960, // 40 days and 40 nights
};

export function calculateHoursBetween(startIso: string, endIso: string): number {
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  return Math.max(0, (e - s) / (1000 * 60 * 60));
}

export function classifyBleeding(
  startDateIso: string,
  endDateIso?: string,
  type: 'haiz' | 'nifas' = 'haiz',
  habit: UserHabit = { haizDays: 7, tuhrDays: 21 }
): {
  type: PurityState;
  durationHours: number;
  durationDays: number;
  isExceedingMax: boolean;
  isBelowMin: boolean;
  fiqhNote: string;
} {
  const nowIso = new Date().toISOString();
  const targetEnd = endDateIso || nowIso;
  const hours = calculateHoursBetween(startDateIso, targetEnd);
  const days = Math.floor(hours / 24) + 1;

  if (type === 'nifas') {
    if (hours > HANAFI_FIQH_RULES.MAX_NIFAS_HOURS) {
      return {
        type: 'istihaza',
        durationHours: hours,
        durationDays: days,
        isExceedingMax: true,
        isBelowMin: false,
        fiqhNote: 'Bleeding exceeding 40 days is not Nifas, but Istihadha (irregular bleeding). Ghusl is obligatory and prayers must be performed.',
      };
    }
    return {
      type: 'nifas',
      durationHours: hours,
      durationDays: days,
      isExceedingMax: false,
      isBelowMin: false,
      fiqhNote: 'During Nifas, prayers are exempt and fasts are to be made up later. The maximum period is 40 days.',
    };
  }

  // Haiz Classification
  if (endDateIso && hours < HANAFI_FIQH_RULES.MIN_HAIZ_HOURS) {
    return {
      type: 'istihaza',
      durationHours: hours,
      durationDays: days,
      isExceedingMax: false,
      isBelowMin: true,
      fiqhNote: 'Bleeding less than 3 days (72 hours) is not Hayd, but Istihadha. Any missed prayers must be made up (Qadha).'
    };
  }

  if (hours > HANAFI_FIQH_RULES.MAX_HAIZ_HOURS) {
    return {
      type: 'istihaza',
      durationHours: hours,
      durationDays: days,
      isExceedingMax: true,
      isBelowMin: false,
      fiqhNote: 'Bleeding exceeding 10 days is considered Istihadha. Ghusl becomes obligatory upon completing 10 days and prayers must resume.',
    };
  }

  return {
    type: 'haiz',
    durationHours: hours,
    durationDays: days,
    isExceedingMax: false,
    isBelowMin: false,
    fiqhNote: 'Bleeding between 3 to 10 days is valid Hayd. Prayers are exempt and Ramadan fasts must be made up later.',
  };
}

export function getCurrentPurityStatus(
  entries: CycleEntry[],
  habit: UserHabit = { haizDays: 7, tuhrDays: 21 }
): PurityCalculationResult {
  if (!entries || entries.length === 0) {
    return {
      state: 'pure',
      stateLabel: 'State of Purity (Tuhr)',
      description: 'You are currently in a state of ritual purity. Salah, Quran recitation, and worship are obligatory and encouraged.',
      isSalahObligatory: true,
      isFastingObligatory: true,
      isGhuslRequiredNow: false,
      activeCycleDays: 0,
      fiqhDaleel: 'Hanafi Fiqh: The default state remains purity until valid bleeding is established.',
    };
  }

  // Sort latest first
  const sorted = [...entries].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
  const latest = sorted[0];

  // If ongoing cycle (no end date)
  if (!latest.endDate) {
    const classification = classifyBleeding(latest.startDate, undefined, latest.type === 'nifas' ? 'nifas' : 'haiz', habit);
    const startObj = new Date(latest.startDate);
    const expectedGhusl = new Date(startObj.getTime() + habit.haizDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      weekday: 'long',
    });

    if (classification.type === 'haiz') {
      return {
        state: 'haiz',
        stateLabel: 'State of Hayd (Menstruation)',
        description: 'Salah is exempt and fasting is prohibited during this time. Only missed fasts must be made up later, not missed prayers.',
        isSalahObligatory: false,
        isFastingObligatory: false,
        isGhuslRequiredNow: false,
        activeCycleDays: classification.durationDays,
        expectedGhuslDate: expectedGhusl,
        fiqhDaleel: classification.fiqhNote,
      };
    }

    if (classification.type === 'nifas') {
      return {
        state: 'nifas',
        stateLabel: 'State of Nifas (Postnatal)',
        description: 'Salah is exempt during Nifas and fasts are deferred. Ghusl is obligatory when bleeding stops or upon 40 days.',
        isSalahObligatory: false,
        isFastingObligatory: false,
        isGhuslRequiredNow: false,
        activeCycleDays: classification.durationDays,
        expectedGhuslDate: expectedGhusl,
        fiqhDaleel: classification.fiqhNote,
      };
    }

    return {
      state: 'istihaza',
      stateLabel: 'State of Istihadha (Irregular Bleeding)',
      description: 'Salah is not exempt in Istihadha. Perform fresh Wudhu for each prayer time and offer obligatory prayers and fasts.',
      isSalahObligatory: true,
      isFastingObligatory: true,
      isGhuslRequiredNow: true,
      activeCycleDays: classification.durationDays,
      fiqhDaleel: classification.fiqhNote,
    };
  }

  // If latest cycle has ended, check if Ghusl is done and purity is active
  const hoursSinceEnd = calculateHoursBetween(latest.endDate, new Date().toISOString());
  return {
    state: 'pure',
    stateLabel: 'State of Purity (Tuhr)',
    description: 'Bleeding has ceased. If you have not performed Ghusl, please perform it immediately and resume prayers.',
    isSalahObligatory: true,
    isFastingObligatory: true,
    isGhuslRequiredNow: hoursSinceEnd < 24,
    activeCycleDays: Math.floor(hoursSinceEnd / 24),
    fiqhDaleel: 'Hanafi Fiqh: The minimum interval of valid purity (Tuhr) is 15 complete days.',
  };
}
