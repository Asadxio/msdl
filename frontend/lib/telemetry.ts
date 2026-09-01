import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore';
import Constants from 'expo-constants';
import { db } from '@/lib/firebase';

export type TelemetrySeverity = 'critical' | 'high' | 'medium' | 'low';

export type TelemetryCategory =
  | 'payment'
  | 'auth'
  | 'live_class'
  | 'audio_dars'
  | 'network'
  | 'crash'
  | 'ui'
  | 'general';

export interface TelemetryErrorDoc {
  id: string;
  fingerprint: string;
  severity: TelemetrySeverity;
  category: TelemetryCategory;
  message: string;
  stack_snippet?: string;
  screen_route: string;
  user_id: string;
  user_email?: string;
  user_role?: string;
  app_version: string;
  device_os: string;
  status: 'active' | 'investigating' | 'resolved';
  occurrence_count: number;
  admin_notes?: string;
  created_at?: Timestamp | any;
  last_occurred_at?: Timestamp | any;
}

// In-memory throttling cache: fingerprint -> last reported timestamp ms
const recentErrorThrottle = new Map<string, number>();
const THROTTLE_WINDOW_MS = 60000; // 60 seconds per unique fingerprint

function createFingerprint(category: string, message: string, route: string): string {
  const cleanMsg = (message || '').slice(0, 100).replace(/\s+/g, '_');
  const cleanRoute = (route || 'unknown').replace(/[\/\\:]/g, '_');
  return (category + '__' + cleanRoute + '__' + cleanMsg).slice(0, 120);
}

export function classifySeverity(category: TelemetryCategory, message: string): TelemetrySeverity {
  const msg = (message || '').toLowerCase();
  if (
    category === 'payment' ||
    category === 'crash' ||
    msg.includes('fatal') ||
    msg.includes('razorpay') ||
    msg.includes('unhandled')
  ) {
    return 'critical';
  }
  if (
    category === 'live_class' ||
    category === 'auth' ||
    msg.includes('permission-denied') ||
    msg.includes('webrtc') ||
    msg.includes('agora')
  ) {
    return 'high';
  }
  if (category === 'audio_dars' || category === 'network' || msg.includes('timeout') || msg.includes('network')) {
    return 'medium';
  }
  return 'low';
}

export async function reportTelemetryError(params: {
  category: TelemetryCategory;
  message: string;
  stack?: string;
  screenRoute?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  severityOverride?: TelemetrySeverity;
}): Promise<string | null> {
  const route = params.screenRoute || 'app_root';
  const rawMsg = params.message || 'Unknown runtime error';
  const fingerprint = createFingerprint(params.category, rawMsg, route);

  const now = Date.now();
  const lastReported = recentErrorThrottle.get(fingerprint);
  if (lastReported && now - lastReported < THROTTLE_WINDOW_MS) {
    // Throttled to protect battery & network
    return null;
  }
  recentErrorThrottle.set(fingerprint, now);

  const severity = params.severityOverride || classifySeverity(params.category, rawMsg);
  const appVersion = String(
    Constants.expoConfig?.version || (Constants.manifest as any)?.version || '1.0.0'
  );

  const errorId = 'err_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const docRef = doc(db, 'telemetry_errors', errorId);

  const payload: TelemetryErrorDoc = {
    id: errorId,
    fingerprint,
    severity,
    category: params.category,
    message: rawMsg.slice(0, 500),
    stack_snippet: params.stack ? params.stack.slice(0, 400) : undefined,
    screen_route: route,
    user_id: params.userId || 'anonymous',
    user_email: params.userEmail,
    user_role: params.userRole || 'student',
    app_version: appVersion,
    device_os: Constants.platform?.ios ? 'ios' : 'android',
    status: 'active',
    occurrence_count: 1,
    created_at: serverTimestamp(),
    last_occurred_at: serverTimestamp(),
  };

  try {
    await setDoc(docRef, payload);
    return errorId;
  } catch (err) {
    console.warn('[Telemetry] Failed to write telemetry error:', err);
    return null;
  }
}

export function subscribeToTelemetryErrors(
  options: {
    statusFilter?: 'all' | 'active' | 'investigating' | 'resolved';
    severityFilter?: 'all' | 'critical' | 'high' | 'medium' | 'low';
    maxLimit?: number;
  },
  callback: (errors: TelemetryErrorDoc[]) => void
): () => void {
  const colRef = collection(db, 'telemetry_errors');
  let q = query(colRef, orderBy('created_at', 'desc'), limit(options.maxLimit || 100));

  if (options.statusFilter && options.statusFilter !== 'all') {
    q = query(colRef, where('status', '==', options.statusFilter), orderBy('created_at', 'desc'), limit(options.maxLimit || 100));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const list: TelemetryErrorDoc[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as TelemetryErrorDoc);
      });
      callback(list);
    },
    (err) => {
      console.warn('[Telemetry] Error subscribing to telemetry stream:', err);
      callback([]);
    }
  );
}

export async function updateTelemetryErrorStatus(
  errorId: string,
  status: 'active' | 'investigating' | 'resolved',
  adminNotes?: string
): Promise<void> {
  const docRef = doc(db, 'telemetry_errors', errorId);
  await updateDoc(docRef, {
    status,
    admin_notes: adminNotes || '',
    updated_at: serverTimestamp(),
  });
}
