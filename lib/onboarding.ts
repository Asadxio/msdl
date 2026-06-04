import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const ONBOARDING_COMPLETION_VERSION_KEY = '@madrasatussalikat/onboarding_entry_completed_version';

export function getOnboardingAppVersion(): string {
  return Constants.expoConfig?.version || '0.0.0';
}

export async function shouldShowOnboardingEntry(): Promise<boolean> {
  const completedVersion = await AsyncStorage.getItem(ONBOARDING_COMPLETION_VERSION_KEY);
  return completedVersion !== getOnboardingAppVersion();
}

export async function markOnboardingEntryComplete(): Promise<string> {
  const version = getOnboardingAppVersion();
  await AsyncStorage.setItem(ONBOARDING_COMPLETION_VERSION_KEY, version);
  return version;
}
