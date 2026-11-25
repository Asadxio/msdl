import AsyncStorage from '@react-native-async-storage/async-storage';
import { SALAH_STEPS } from '@/constants/salahGuideData';
import { FiqhSchool, SalahStep } from '@/types/islamic';

const FIQH_PREF_KEY = '@suffah_fiqh_preference_v1';
const SALAH_PROGRESS_KEY = '@suffah_salah_progress_v1';

/**
 * Get all 14 steps of Salah
 */
export function getSalahSteps(): SalahStep[] {
  return SALAH_STEPS;
}

/**
 * Get step by number (1 to 14)
 */
export function getSalahStep(stepNumber: number): SalahStep | undefined {
  return SALAH_STEPS.find((s) => s.stepNumber === stepNumber);
}

/**
 * User Fiqh Preference (Hanafi vs Shafi'i / General)
 */
export async function getPreferredFiqh(): Promise<FiqhSchool> {
  try {
    const raw = await AsyncStorage.getItem(FIQH_PREF_KEY);
    if (raw === 'shafii') return 'shafii';
  } catch {}
  return 'hanafi'; // Default is Hanafi in Subcontinent / South Asia
}

export async function setPreferredFiqh(fiqh: FiqhSchool): Promise<void> {
  try {
    await AsyncStorage.setItem(FIQH_PREF_KEY, fiqh);
  } catch {}
}

/**
 * Progress tracking for learners
 */
export async function getCompletedSalahSteps(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(SALAH_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function markSalahStepCompleted(stepNumber: number): Promise<number[]> {
  const current = await getCompletedSalahSteps();
  if (!current.includes(stepNumber)) {
    const next = [...current, stepNumber];
    await AsyncStorage.setItem(SALAH_PROGRESS_KEY, JSON.stringify(next));
    return next;
  }
  return current;
}
