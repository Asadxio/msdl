/**
 * MSLB Teacher ID Counter — Atomic Firestore Transaction-Based Allocation
 *
 * Replaces the legacy fetchExistingTeacherIds() + getNextTeacherId() pattern.
 * Uses a Firestore transaction on app_settings/teacher_id_counter so that
 * two concurrent Admin promotions can never receive the same Teacher ID.
 *
 * Format: TCH-0001, TCH-0002, ..., TCH-9999, TCH-10000, ...
 */

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  getDocs,
  collection,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const COUNTER_DOC_PATH = 'app_settings/teacher_id_counter';
const TEACHER_ID_PREFIX = 'TCH-';

/**
 * Atomically allocates the next unique Teacher ID.
 *
 * Uses a Firestore transaction to increment a persistent counter so that
 * concurrent callers can never receive duplicate IDs.
 *
 * @returns e.g. 'TCH-0001', 'TCH-0002', …
 */
export async function allocateNextTeacherId(): Promise<string> {
  const counterRef = doc(db, 'app_settings', 'teacher_id_counter');

  const nextId = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current: number = snap.exists()
      ? (snap.data().last_sequence ?? 0)
      : 0;
    const next = current + 1;
    tx.set(
      counterRef,
      {
        last_sequence: next,
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );
    return `${TEACHER_ID_PREFIX}${String(next).padStart(4, '0')}`;
  });

  return nextId;
}

/**
 * One-time initialiser — ensures the counter is set to at least the highest
 * sequence already present in the teachers collection.
 *
 * Safe to call repeatedly: it will never decrease the counter.
 * Run once during migration from the legacy algorithm.
 */
export async function initializeTeacherIdCounter(): Promise<{
  counterSet: number;
  previousCounter: number;
}> {
  // Scan existing teacher IDs to find the highest sequence
  let maxSeq = 0;
  try {
    const snap = await getDocs(collection(db, 'teachers'));
    snap.forEach((d) => {
      const tid: unknown = d.data().teacher_id;
      if (typeof tid === 'string') {
        const match = tid.trim().match(/^TCH-(\d+)$/i);
        if (match) {
          const n = parseInt(match[1], 10);
          if (!isNaN(n) && n > maxSeq) maxSeq = n;
        }
      }
    });
  } catch (_) {
    // Non-fatal — counter will start from 0 if scan fails
  }

  const counterRef = doc(db, 'app_settings', 'teacher_id_counter');
  let previousCounter = 0;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    previousCounter = snap.exists() ? (snap.data().last_sequence ?? 0) : 0;
    if (maxSeq > previousCounter) {
      tx.set(
        counterRef,
        {
          last_sequence: maxSeq,
          initialized_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        },
        { merge: true },
      );
    }
  });

  return { counterSet: Math.max(maxSeq, previousCounter), previousCounter };
}

/**
 * Reads the current counter value without incrementing it.
 * Useful for diagnostics / admin display.
 */
export async function readTeacherIdCounter(): Promise<number> {
  const snap = await getDoc(doc(db, 'app_settings', 'teacher_id_counter'));
  if (!snap.exists()) return 0;
  return snap.data().last_sequence ?? 0;
}
