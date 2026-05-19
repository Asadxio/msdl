import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'live_class_recovery_v1';

export type LiveClassRecoveryState = {
  classId: string;
  userId: string;
  reconnectPhase?: string;
  handRaised?: boolean;
  recordingState?: string;
  pendingModerationCount?: number;
  savedAtMs: number;
};

function key(classId: string, userId: string): string {
  return `${KEY_PREFIX}:${classId}:${userId}`;
}

export async function saveLiveClassRecovery(state: LiveClassRecoveryState): Promise<void> {
  await AsyncStorage.setItem(key(state.classId, state.userId), JSON.stringify(state)).catch(() => {});
}

export async function loadLiveClassRecovery(classId: string, userId: string): Promise<LiveClassRecoveryState | null> {
  const raw = await AsyncStorage.getItem(key(classId, userId)).catch(() => null);
  if (!raw) return null;
  try { return JSON.parse(raw) as LiveClassRecoveryState; } catch { return null; }
}

export async function clearLiveClassRecovery(classId: string, userId: string): Promise<void> {
  await AsyncStorage.removeItem(key(classId, userId)).catch(() => {});
}
