/**
 * Safe Timestamp Utilities
 * Provides crash-safe wrappers for Firestore timestamp operations
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Type guard to check if a value is a Firestore Timestamp
 */
export function isFirestoreTimestamp(value: any): value is Timestamp {
  return value && typeof value.toDate === 'function';
}

/**
 * Safely converts a Firestore timestamp to a Date object
 * Returns null if the value is not a valid timestamp
 */
export function safeToDate(value: any): Date | null {
  try {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (isFirestoreTimestamp(value)) {
      return value.toDate();
    }
    // Handle milliseconds or seconds timestamp
    if (typeof value === 'number') {
      const ms = value > 1e12 ? value : value * 1000;
      return new Date(ms);
    }
    // Handle ISO string
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  } catch (error) {
    console.log('[safeToDate] Error converting timestamp:', error);
    return null;
  }
}

/**
 * Safely converts a Firestore timestamp to epoch milliseconds
 * Returns 0 if the value is not a valid timestamp
 */
export function safeToMillis(value: any): number {
  try {
    const date = safeToDate(value);
    return date ? date.getTime() : 0;
  } catch {
    return 0;
  }
}

/**
 * Safely converts a Firestore timestamp to ISO string
 * Returns empty string if the value is not a valid timestamp
 */
export function safeToISOString(value: any): string {
  try {
    const date = safeToDate(value);
    return date ? date.toISOString() : '';
  } catch {
    return '';
  }
}

/**
 * Safely formats a Firestore timestamp to a locale string
 * Returns fallback string if the value is not a valid timestamp
 */
export function safeToLocaleString(value: any, fallback: string = 'Just now'): string {
  try {
    const date = safeToDate(value);
    return date ? date.toLocaleString() : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Safely formats a Firestore timestamp to a relative time string
 * e.g., "2 hours ago", "3 days ago"
 */
export function safeToRelativeTime(value: any, fallback: string = 'Just now'): string {
  try {
    const date = safeToDate(value);
    if (!date) return fallback;

    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    if (diffHour > 0) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffMin > 0) return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
    return fallback;
  } catch {
    return fallback;
  }
}
