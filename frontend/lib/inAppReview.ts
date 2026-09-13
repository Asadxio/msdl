/**
 * inAppReview.ts
 * Google Play In-App Review & Rating Management for Madrasatu-s-Salikat.
 * Strictly respects Google Play guidelines and a 30-day user cooldown to avoid nagging.
 */

import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PLAY_STORE_MARKET_URL, PLAY_STORE_WEB_URL } from './versionCheck';

export const REVIEW_LAST_PROMPT_KEY = '@mslb_review_last_prompt_time';
export const REVIEW_HAS_RATED_KEY = '@mslb_review_has_rated';
const REVIEW_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Checks if the user is eligible for an automatic review prompt:
 * - Has not already rated/reviewed.
 * - At least 30 days have passed since the last prompt.
 */
export async function shouldPromptReview(): Promise<boolean> {
  try {
    const hasRated = await AsyncStorage.getItem(REVIEW_HAS_RATED_KEY);
    if (hasRated === 'true') {
      return false;
    }

    const lastPrompt = await AsyncStorage.getItem(REVIEW_LAST_PROMPT_KEY);
    if (!lastPrompt) {
      return true;
    }

    const lastPromptTime = parseInt(lastPrompt, 10);
    if (isNaN(lastPromptTime)) return true;

    return Date.now() - lastPromptTime >= REVIEW_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * Records that a review prompt was shown, resetting the 30-day cooldown.
 */
export async function recordReviewPromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_LAST_PROMPT_KEY, Date.now().toString());
  } catch {}
}

/**
 * Records that the user clicked to rate on Google Play, permanently suppressing auto-prompts.
 */
export async function recordReviewCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_HAS_RATED_KEY, 'true');
    await AsyncStorage.setItem(REVIEW_LAST_PROMPT_KEY, Date.now().toString());
  } catch {}
}

/**
 * Opens the Google Play Store directly to the app's listing page.
 * Uses market:// URL first for direct Play Store app launch, falling back to HTTPS.
 */
export async function openGooglePlayStore(): Promise<boolean> {
  try {
    await recordReviewCompleted();

    if (Platform.OS === 'android') {
      const supported = await Linking.canOpenURL(PLAY_STORE_MARKET_URL);
      if (supported) {
        await Linking.openURL(PLAY_STORE_MARKET_URL);
        return true;
      }
    }
    await Linking.openURL(PLAY_STORE_WEB_URL);
    return true;
  } catch (error) {
    try {
      await Linking.openURL(PLAY_STORE_WEB_URL);
      return true;
    } catch {
      return false;
    }
  }
}
