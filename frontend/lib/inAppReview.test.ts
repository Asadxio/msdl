jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Linking: {
    canOpenURL: jest.fn().mockResolvedValue(true),
    openURL: jest.fn().mockResolvedValue(true),
  },
}));

const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
  setItem: jest.fn((key: string, val: string) => { mockStorage[key] = val; return Promise.resolve(); }),
  removeItem: jest.fn((key: string) => { delete mockStorage[key]; return Promise.resolve(); }),
  clear: jest.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); return Promise.resolve(); }),
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.7',
    android: { versionCode: 40 },
  },
}));

jest.mock('./firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  shouldPromptReview,
  recordReviewPromptShown,
  recordReviewCompleted,
  REVIEW_LAST_PROMPT_KEY,
  REVIEW_HAS_RATED_KEY,
} from './inAppReview';

describe('inAppReview', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('allows prompting review when user has never been prompted', async () => {
    const shouldPrompt = await shouldPromptReview();
    expect(shouldPrompt).toBe(true);
  });

  it('blocks review prompt if user has already rated', async () => {
    await AsyncStorage.setItem(REVIEW_HAS_RATED_KEY, 'true');
    const shouldPrompt = await shouldPromptReview();
    expect(shouldPrompt).toBe(false);
  });

  it('blocks review prompt during 30-day cooldown window', async () => {
    // Prompted 5 days ago
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(REVIEW_LAST_PROMPT_KEY, fiveDaysAgo.toString());

    const shouldPrompt = await shouldPromptReview();
    expect(shouldPrompt).toBe(false);
  });

  it('allows review prompt after 30-day cooldown has elapsed', async () => {
    // Prompted 35 days ago
    const thirtyFiveDaysAgo = Date.now() - 35 * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(REVIEW_LAST_PROMPT_KEY, thirtyFiveDaysAgo.toString());

    const shouldPrompt = await shouldPromptReview();
    expect(shouldPrompt).toBe(true);
  });

  it('recordReviewPromptShown updates last prompt timestamp', async () => {
    const before = Date.now();
    await recordReviewPromptShown();
    const stored = await AsyncStorage.getItem(REVIEW_LAST_PROMPT_KEY);
    expect(stored).toBeTruthy();
    const storedTime = parseInt(stored || '0', 10);
    expect(storedTime).toBeGreaterThanOrEqual(before);
  });

  it('recordReviewCompleted sets has_rated flag to true', async () => {
    await recordReviewCompleted();
    const hasRated = await AsyncStorage.getItem(REVIEW_HAS_RATED_KEY);
    expect(hasRated).toBe('true');
  });
});
