// ─────────────────────────────────────────────────────────────────────────────
// SUFFAH — Wirasat (Mirath / Islamic Inheritance Jurisprudence) Calculator & Guide
// Grounded in Qur'anic Fixed Shares (Ashab al-Furud — Surah An-Nisa 4:11-12)
// and Residuary Distribution ('Asabah).
// ─────────────────────────────────────────────────────────────────────────────

export type DeceasedGender = 'male' | 'female';

export interface WirasatInputs {
  estateAmount: number;
  funeralAndDebts: number;
  wasiyyahAmount: number; // Shariah caps Wasiyyah (non-heir will) at max 1/3 after debts
  deceasedGender: DeceasedGender;
  hasSpouse: boolean;
  sonsCount: number;
  daughtersCount: number;
  fatherAlive: boolean;
  motherAlive: boolean;
  fullBrothersCount: number;
  fullSistersCount: number;
}

export interface WirasatShareRow {
  heir: string;
  count: number;
  fractionLabel: string;
  percentage: number;
  totalAmount: number;
  perHeirAmount: number;
  ruleBasis: string;
}

export interface WirasatResult {
  netEstate: number;
  wasiyyahCapped: boolean;
  wasiyyahApplied: number;
  awlApplied: boolean;
  raddApplied: boolean;
  shares: WirasatShareRow[];
}

export const DEFAULT_WIRASAT_INPUTS: WirasatInputs = {
  estateAmount: 100000,
  funeralAndDebts: 0,
  wasiyyahAmount: 0,
  deceasedGender: 'male',
  hasSpouse: true,
  sonsCount: 1,
  daughtersCount: 1,
  fatherAlive: true,
  motherAlive: true,
  fullBrothersCount: 0,
  fullSistersCount: 0,
};

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Computes Qur'anic Inheritance (Mirath) distribution among primary heirs.
 * Implements Hijab (blocking), Fard fixed shares, 'Asabah residuary (2:1 male/female ratio),
 * proportional 'Awl reduction if fixed shares exceed 1.0, and Radd redistribution if residual remains with no 'Asabah.
 */
export function calculateWirasat(inputs: WirasatInputs): WirasatResult {
  const grossAfterDebt = Math.max(0, inputs.estateAmount - Math.max(0, inputs.funeralAndDebts));
  const maxWasiyyah = grossAfterDebt / 3;
  const rawWasiyyah = Math.max(0, inputs.wasiyyahAmount);
  const wasiyyahCapped = rawWasiyyah > maxWasiyyah && grossAfterDebt > 0;
  const wasiyyahApplied = round2(Math.min(rawWasiyyah, maxWasiyyah));
  const netEstate = round2(Math.max(0, grossAfterDebt - wasiyyahApplied));

  const sons = Math.max(0, Math.floor(inputs.sonsCount));
  const daughters = Math.max(0, Math.floor(inputs.daughtersCount));
  const hasChildren = sons > 0 || daughters > 0;
  const brothers = hasChildren || inputs.fatherAlive ? 0 : Math.max(0, Math.floor(inputs.fullBrothersCount));
  const sisters = hasChildren || inputs.fatherAlive ? 0 : Math.max(0, Math.floor(inputs.fullSistersCount));
  const siblingTotalCount = inputs.fullBrothersCount + inputs.fullSistersCount;

  interface InternalShare {
    heir: string;
    count: number;
    ratio: number;
    fractionLabel: string;
    ruleBasis: string;
    eligibleForRadd?: boolean;
  }

  const fixed: InternalShare[] = [];

  // 1. Spouse Fixed Share (Quran 4:12)
  if (inputs.hasSpouse) {
    if (inputs.deceasedGender === 'male') {
      const ratio = hasChildren ? 1 / 8 : 1 / 4;
      fixed.push({
        heir: 'Wife (Zawjah)',
        count: 1,
        ratio,
        fractionLabel: hasChildren ? '1/8' : '1/4',
        ruleBasis: hasChildren ? 'Qur’an 4:12 (with children)' : 'Qur’an 4:12 (no children)',
        eligibleForRadd: false,
      });
    } else {
      const ratio = hasChildren ? 1 / 4 : 1 / 2;
      fixed.push({
        heir: 'Husband (Zawj)',
        count: 1,
        ratio,
        fractionLabel: hasChildren ? '1/4' : '1/2',
        ruleBasis: hasChildren ? 'Qur’an 4:12 (with children)' : 'Qur’an 4:12 (no children)',
        eligibleForRadd: false,
      });
    }
  }

  // 2. Mother Fixed Share (Quran 4:11)
  if (inputs.motherAlive) {
    const sixth = hasChildren || siblingTotalCount >= 2;
    const ratio = sixth ? 1 / 6 : 1 / 3;
    fixed.push({
      heir: 'Mother (Umm)',
      count: 1,
      ratio,
      fractionLabel: sixth ? '1/6' : '1/3',
      ruleBasis: sixth ? 'Qur’an 4:11 (children or ≥2 siblings present)' : 'Qur’an 4:11 (no children, <2 siblings)',
      eligibleForRadd: true,
    });
  }

  // 3. Father Fixed / Residuary Share (Quran 4:11)
  let fatherAsabahHandled = false;
  if (inputs.fatherAlive) {
    if (sons > 0) {
      fixed.push({
        heir: 'Father (Ab)',
        count: 1,
        ratio: 1 / 6,
        fractionLabel: '1/6',
        ruleBasis: 'Qur’an 4:11 (with male descendant)',
        eligibleForRadd: false,
      });
    } else if (daughters > 0) {
      fixed.push({
        heir: 'Father (Ab)',
        count: 1,
        ratio: 1 / 6,
        fractionLabel: '1/6 + Residue',
        ruleBasis: 'Qur’an 4:11 (1/6 fixed + ’Asabah with daughters only)',
        eligibleForRadd: false,
      });
    }
    // If no children at all, Father takes all residual as 'Asabah
  }

  // 4. Daughters Fixed Share when NO Sons exist (Quran 4:11)
  if (sons === 0 && daughters > 0) {
    const ratio = daughters === 1 ? 1 / 2 : 2 / 3;
    fixed.push({
      heir: daughters === 1 ? 'Daughter' : 'Daughters',
      count: daughters,
      ratio,
      fractionLabel: daughters === 1 ? '1/2' : '2/3',
      ruleBasis: daughters === 1 ? 'Qur’an 4:11 (single daughter)' : 'Qur’an 4:11 (2+ daughters, no sons)',
      eligibleForRadd: true,
    });
  }

  // 5. Full Sisters Fixed Share when Kalalah (no father, no children, no brothers)
  if (!hasChildren && !inputs.fatherAlive && brothers === 0 && sisters > 0) {
    const ratio = sisters === 1 ? 1 / 2 : 2 / 3;
    fixed.push({
      heir: sisters === 1 ? 'Full Sister' : 'Full Sisters',
      count: sisters,
      ratio,
      fractionLabel: sisters === 1 ? '1/2' : '2/3',
      ruleBasis: sisters === 1 ? 'Qur’an 4:176 (Kalalah, 1 sister)' : 'Qur’an 4:176 (Kalalah, 2+ sisters)',
      eligibleForRadd: true,
    });
  }

  let totalFixedRatio = fixed.reduce((sum, s) => sum + s.ratio, 0);
  let awlApplied = false;
  let raddApplied = false;

  // Apply 'Awl proportional reduction if fixed shares exceed 100%
  if (totalFixedRatio > 1.0001) {
    awlApplied = true;
    for (const s of fixed) {
      s.ratio = s.ratio / totalFixedRatio;
      s.fractionLabel = `${s.fractionLabel} ('Awl)`;
    }
    totalFixedRatio = 1;
  }

  const residue = Math.max(0, 1 - totalFixedRatio);
  const allShares: InternalShare[] = [...fixed];

  if (residue > 0.0001) {
    if (sons > 0) {
      // Children as 'Asabah (2:1 male:female ratio)
      const totalParts = sons * 2 + daughters;
      const sonTotalRatio = (residue * (sons * 2)) / totalParts;
      allShares.push({
        heir: sons === 1 ? 'Son' : 'Sons',
        count: sons,
        ratio: sonTotalRatio,
        fractionLabel: daughters > 0 ? 'Residue (2 parts each)' : 'Residuary (’Asabah)',
        ruleBasis: 'Qur’an 4:11 (male takes double share of female)',
      });
      if (daughters > 0) {
        allShares.push({
          heir: daughters === 1 ? 'Daughter' : 'Daughters',
          count: daughters,
          ratio: (residue * daughters) / totalParts,
          fractionLabel: 'Residue (1 part each)',
          ruleBasis: 'Qur’an 4:11 (joint ’Asabah with brother)',
        });
      }
    } else if (inputs.fatherAlive) {
      const existingFather = allShares.find((s) => s.heir === 'Father (Ab)');
      if (existingFather) {
        existingFather.ratio += residue;
        fatherAsabahHandled = true;
      } else {
        allShares.push({
          heir: 'Father (Ab)',
          count: 1,
          ratio: residue,
          fractionLabel: fixed.length === 0 ? 'Full Estate (1/1)' : 'Residuary (’Asabah)',
          ruleBasis: 'Hadith (Bukhari #6732): Nearest male agnate takes residue',
        });
        fatherAsabahHandled = true;
      }
    } else if (brothers > 0) {
      const totalParts = brothers * 2 + sisters;
      allShares.push({
        heir: brothers === 1 ? 'Full Brother' : 'Full Brothers',
        count: brothers,
        ratio: (residue * (brothers * 2)) / totalParts,
        fractionLabel: sisters > 0 ? 'Kalalah Residue (2:1)' : 'Residuary (’Asabah)',
        ruleBasis: 'Qur’an 4:176 (Kalalah brothers/sisters 2:1)',
      });
      if (sisters > 0) {
        allShares.push({
          heir: sisters === 1 ? 'Full Sister' : 'Full Sisters',
          count: sisters,
          ratio: (residue * sisters) / totalParts,
          fractionLabel: 'Kalalah Residue (2:1)',
          ruleBasis: 'Qur’an 4:176 (joint ’Asabah with brother)',
        });
      }
    } else {
      // Radd to non-spouse blood Quranic heirs if eligible, otherwise spouse / Bayt al-Mal
      const raddPool = allShares.filter((s) => s.eligibleForRadd);
      const raddPoolSum = raddPool.reduce((sum, s) => sum + s.ratio, 0);
      if (raddPool.length > 0 && raddPoolSum > 0) {
        raddApplied = true;
        for (const item of raddPool) {
          item.ratio += residue * (item.ratio / raddPoolSum);
          item.fractionLabel = `${item.fractionLabel} + Radd`;
        }
      } else if (allShares.length > 0) {
        allShares[0].ratio += residue;
      }
    }
  }

  void fatherAsabahHandled;

  const formatted: WirasatShareRow[] = allShares.map((s) => {
    const pct = round2(s.ratio * 100);
    const totalAmt = round2(netEstate * s.ratio);
    const perHeir = round2(totalAmt / Math.max(1, s.count));
    return {
      heir: s.heir,
      count: s.count,
      fractionLabel: s.fractionLabel,
      percentage: pct,
      totalAmount: totalAmt,
      perHeirAmount: perHeir,
      ruleBasis: s.ruleBasis,
    };
  });

  return {
    netEstate,
    wasiyyahCapped,
    wasiyyahApplied,
    awlApplied,
    raddApplied,
    shares: formatted,
  };
}
