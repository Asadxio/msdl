import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const TUTORIAL_COMPLETED_KEY = 'tutorial_after_first_login_completed::';

export async function isTutorialCompleted(): Promise<boolean> {
  const appVersion = String(Constants.expoConfig?.version || (Constants.manifest as any)?.version || '1.0.0');
  const key = `${TUTORIAL_COMPLETED_KEY}${appVersion}`;
  try {
    const val = await AsyncStorage.getItem(key);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function markTutorialCompleted(): Promise<void> {
  const appVersion = String(Constants.expoConfig?.version || (Constants.manifest as any)?.version || '1.0.0');
  const key = `${TUTORIAL_COMPLETED_KEY}${appVersion}`;
  try {
    await AsyncStorage.setItem(key, 'true');
  } catch {}
}
