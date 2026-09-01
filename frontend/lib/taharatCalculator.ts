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
        fiqhNote: '۴۰ دن سے زائد کا خون نفاس نہیں بلکہ استحاضہ (بیماری کا خون) ہے، غسل کر کے نماز ادا کرنا فرض ہے۔',
      };
    }
    return {
      type: 'nifas',
      durationHours: hours,
      durationDays: days,
      isExceedingMax: false,
      isBelowMin: false,
      fiqhNote: 'حالتِ نفاس میں نماز معاف ہے اور روزے بعد میں قضاء کرنے ہوں گے۔ زیادہ سے زیادہ مدت ۴۰ دن ہے۔',
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
      fiqhNote: '۳ دن (۷۲ گھنٹے) سے کم کا خون حیض نہیں بلکہ استحاضہ ہے۔ چھوٹی ہوئی نمازوں کی قضاء لازم ہے۔',
    };
  }

  if (hours > HANAFI_FIQH_RULES.MAX_HAIZ_HOURS) {
    return {
      type: 'istihaza',
      durationHours: hours,
      durationDays: days,
      isExceedingMax: true,
      isBelowMin: false,
      fiqhNote: '۱۰ دن سے زائد کا خون استحاضہ شمار ہوگا۔ ۱۰ دن مکمل ہوتے ہی غسل فرض ہے اور نماز ادا کرنا لازم ہے۔',
    };
  }

  return {
    type: 'haiz',
    durationHours: hours,
    durationDays: days,
    isExceedingMax: false,
    isBelowMin: false,
    fiqhNote: '۳ تا ۱۰ دن کا خون شرعی حیض ہے۔ اس دوران نماز معاف ہے اور رمضان کے روزوں کی بعد میں قضاء لازم ہے۔',
  };
}

export function getCurrentPurityStatus(
  entries: CycleEntry[],
  habit: UserHabit = { haizDays: 7, tuhrDays: 21 }
): PurityCalculationResult {
  if (!entries || entries.length === 0) {
    return {
      state: 'pure',
      stateLabel: 'حالتِ طہارت (پاک)',
      description: 'آپ حالتِ طہارت میں ہیں۔ نماز ادا کرنا، تلاوتِ قرآن اور تمام عبادات فرض و مسنون ہیں۔',
      isSalahObligatory: true,
      isFastingObligatory: true,
      isGhuslRequiredNow: false,
      activeCycleDays: 0,
      fiqhDaleel: 'فقہ حنفی: عام حالت میں طہارت برقرار رہتی ہے۔',
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
    const expectedGhusl = new Date(startObj.getTime() + habit.haizDays * 24 * 60 * 60 * 1000).toLocaleDateString('ur-PK', {
      day: 'numeric',
      month: 'long',
      weekday: 'long',
    });

    if (classification.type === 'haiz') {
      return {
        state: 'haiz',
        stateLabel: 'حالتِ حیض (معذوری کا شرعی وقت)',
        description: 'اس وقت نماز معاف ہے اور روزہ رکھنا منع ہے۔ بعد میں صرف روزوں کی قضاء لازم ہوگی، نمازوں کی قضاء نہیں۔',
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
        stateLabel: 'حالتِ نفاس (ولادت کے بعد)',
        description: 'نفاس کے ایام میں نماز معاف ہے اور روزے موخر ہیں۔ خون بند ہوتے ہی یا ۴۰ دن پر غسل فرض ہے۔',
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
      stateLabel: 'حالتِ استحاضہ (بیماری کا عذر)',
      description: 'استحاضہ میں نماز معاف نہیں ہے۔ ہر نماز کے وقت نیا وضو فرما کر نماز ادا کرنا اور روزہ رکھنا فرض ہے۔',
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
    stateLabel: 'حالتِ طہارت (پاک)',
    description: 'خون مکمل رک چکا ہے۔ اگر غسل نہیں فرمایا تو فوراً غسل فرما کر نماز بحال فرمائیں۔',
    isSalahObligatory: true,
    isFastingObligatory: true,
    isGhuslRequiredNow: hoursSinceEnd < 24,
    activeCycleDays: Math.floor(hoursSinceEnd / 24),
    fiqhDaleel: 'فقہ حنفی: پاکی کا کم از کم وقفہ ۱۵ دن ہے۔',
  };
}
