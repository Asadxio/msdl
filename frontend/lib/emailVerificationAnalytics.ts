import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';

export type EmailVerificationEventName =
  | 'signup_started'
  | 'signup_completed'
  | 'verification_email_sent'
  | 'verification_modal_shown'
  | 'verification_modal_continue_clicked'
  | 'verification_screen_opened'
  | 'verification_status_checked'
  | 'verification_status_verified'
  | 'verification_status_unverified'
  | 'verification_email_resent'
  | 'verification_signout_clicked'
  | 'verification_funnel_metrics'
  | 'verification_dropoff_pending_never_opened'
  | 'verification_dropoff_never_verified'
  | 'verification_dropoff_pending_signout'
  | 'verification_dropoff_resend_overuse'
  | 'verification_reload_failed'
  | 'verification_email_send_failed'
  | 'verification_timeout'
  | 'verification_navigation_failed'
  | 'verification_user_entered_app';

type VerificationFunnelRecord = {
  uid: string;
  signupCreatedAt?: number;
  modalShownAt?: number;
  pendingOpenedAt?: number;
  emailVerifiedAt?: number;
  enteredAppAt?: number;
  lastEmailSentAt?: number;
  resendCount: number;
  pendingSignoutAt?: number;
  pendingNeverOpenedDropoffAt?: number;
  neverVerifiedDropoffAt?: number;
  resendOveruseDropoffAt?: number;
};

export type VerificationFunnelMetrics = {
  signupCreated: number;
  verificationModalShown: number;
  pendingScreenOpened: number;
  emailVerified: number;
  userEnteredApp: number;
  verificationCompletionRate: number;
  averageVerificationTimeMs: number | null;
  resendRate: number;
  dropOffRate: number;
};

const STORE_KEY = 'email_verification_funnel_records_v1';
const APP_VERSION = Constants.expoConfig?.version || Constants.manifest2?.extra?.expoClient?.version || 'unknown';
const PENDING_OPEN_DROPOFF_MS = 5 * 60 * 1000;
const NEVER_VERIFIED_DROPOFF_MS = 24 * 60 * 60 * 1000;

function now() {
  return Date.now();
}

function basePayload(event: EmailVerificationEventName, payload: Record<string, unknown>) {
  return {
    metric: 'email_verification',
    event,
    timestamp: now(),
    platform: Platform.OS,
    app_version: APP_VERSION,
    ...payload,
  };
}

export function trackEmailVerificationEvent(
  event: EmailVerificationEventName,
  payload: Record<string, unknown> = {},
  dedupeKey?: string,
) {
  try {
    trackEvent('custom', basePayload(event, payload), dedupeKey);
  } catch (error) {
    logger.warn('email_verification.analytics.track_failed', { event, error: String((error as any)?.message || error) });
  }
}

export function trackEmailVerificationError(
  event: Extract<EmailVerificationEventName, 'verification_reload_failed' | 'verification_email_send_failed' | 'verification_timeout' | 'verification_navigation_failed'>,
  error: unknown,
  payload: Record<string, unknown> = {},
) {
  const err = error as any;
  trackEmailVerificationEvent(event, {
    error_code: err?.code || payload.error_code || 'unknown',
    error_message: err?.message || String(error),
    ...payload,
  });
}

async function readRecords(): Promise<Record<string, VerificationFunnelRecord>> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, VerificationFunnelRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    logger.warn('email_verification.analytics.read_failed', { error: String((error as any)?.message || error) });
    return {};
  }
}

async function writeRecords(records: Record<string, VerificationFunnelRecord>) {
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(records));
  } catch (error) {
    logger.warn('email_verification.analytics.write_failed', { error: String((error as any)?.message || error) });
  }
}

function calculateMetrics(records: Record<string, VerificationFunnelRecord>): VerificationFunnelMetrics {
  const list = Object.values(records);
  const signupRecords = list.filter((record) => Boolean(record.signupCreatedAt));
  const signupCreated = signupRecords.length;
  const verificationModalShown = signupRecords.filter((record) => Boolean(record.modalShownAt)).length;
  const pendingScreenOpened = signupRecords.filter((record) => Boolean(record.pendingOpenedAt)).length;
  const verifiedRecords = signupRecords.filter((record) => Boolean(record.emailVerifiedAt));
  const emailVerified = verifiedRecords.length;
  const userEnteredApp = signupRecords.filter((record) => Boolean(record.enteredAppAt)).length;
  const resendUsers = signupRecords.filter((record) => record.resendCount > 0).length;
  const totalVerificationTime = verifiedRecords.reduce((sum, record) => {
    if (!record.signupCreatedAt || !record.emailVerifiedAt) return sum;
    return sum + Math.max(0, record.emailVerifiedAt - record.signupCreatedAt);
  }, 0);

  return {
    signupCreated,
    verificationModalShown,
    pendingScreenOpened,
    emailVerified,
    userEnteredApp,
    verificationCompletionRate: signupCreated ? emailVerified / signupCreated : 0,
    averageVerificationTimeMs: verifiedRecords.length ? Math.round(totalVerificationTime / verifiedRecords.length) : null,
    resendRate: signupCreated ? resendUsers / signupCreated : 0,
    dropOffRate: signupCreated ? (signupCreated - pendingScreenOpened) / signupCreated : 0,
  };
}

async function updateRecord(uid: string, patch: Partial<VerificationFunnelRecord>) {
  if (!uid) return null;
  const records = await readRecords();
  const previous = records[uid] || { uid, resendCount: 0 };
  const next = { ...previous, ...patch, uid, resendCount: patch.resendCount ?? previous.resendCount ?? 0 };
  records[uid] = next;
  await writeRecords(records);
  trackEmailVerificationEvent('verification_funnel_metrics', calculateMetrics(records), 'email-verification-funnel-metrics');
  return next;
}

export async function getVerificationFunnelRecord(uid: string) {
  const records = await readRecords();
  return records[uid] || null;
}

export async function getVerificationFunnelMetrics() {
  return calculateMetrics(await readRecords());
}

export function markSignupStarted() {
  trackEmailVerificationEvent('signup_started');
}

export async function markSignupCompleted(uid: string) {
  trackEmailVerificationEvent('signup_completed', { uid }, `signup_completed:${uid}`);
  await updateRecord(uid, { signupCreatedAt: now() });
  schedulePendingScreenDropoffCheck(uid);
}

export async function markVerificationEmailSent(uid: string, resendCount = 0) {
  const sentAt = now();
  trackEmailVerificationEvent('verification_email_sent', { uid, resend_count: resendCount, last_sent_at: sentAt });
  await updateRecord(uid, { lastEmailSentAt: sentAt, resendCount });
}

export async function markVerificationModalShown(uid: string) {
  trackEmailVerificationEvent('verification_modal_shown', { uid }, `verification_modal_shown:${uid}`);
  await updateRecord(uid, { modalShownAt: now() });
}

export async function markVerificationModalContinue(uid?: string) {
  trackEmailVerificationEvent('verification_modal_continue_clicked', { uid: uid || '' });
}

export async function markPendingScreenOpened(uid: string, resendCount: number) {
  trackEmailVerificationEvent('verification_screen_opened', { uid, resend_count: resendCount }, `verification_screen_opened:${uid}`);
  await updateRecord(uid, { pendingOpenedAt: now(), resendCount });
  scheduleNeverVerifiedDropoffCheck(uid);
}

export async function markVerificationStatus(uid: string, verified: boolean, resendCount: number) {
  trackEmailVerificationEvent('verification_status_checked', { uid, resend_count: resendCount, verified });
  trackEmailVerificationEvent(verified ? 'verification_status_verified' : 'verification_status_unverified', { uid, resend_count: resendCount });
  if (verified) {
    await updateRecord(uid, { emailVerifiedAt: now(), resendCount });
  }
}

export async function markVerificationEmailResent(uid: string, resendCount: number) {
  const sentAt = now();
  trackEmailVerificationEvent('verification_email_resent', { uid, resend_count: resendCount, last_sent_at: sentAt });
  const record = await updateRecord(uid, { lastEmailSentAt: sentAt, resendCount });
  if (resendCount > 3 && record && !record.resendOveruseDropoffAt) {
    trackEmailVerificationEvent('verification_dropoff_resend_overuse', { uid, resend_count: resendCount });
    await updateRecord(uid, { resendOveruseDropoffAt: now(), resendCount });
  }
}

export async function markPendingSignout(uid: string, resendCount: number) {
  trackEmailVerificationEvent('verification_signout_clicked', { uid, resend_count: resendCount });
  trackEmailVerificationEvent('verification_dropoff_pending_signout', { uid, resend_count: resendCount });
  await updateRecord(uid, { pendingSignoutAt: now(), resendCount });
}

export async function markUserEnteredApp(uid: string) {
  trackEmailVerificationEvent('verification_user_entered_app', { uid }, `verification_user_entered_app:${uid}`);
  await updateRecord(uid, { enteredAppAt: now() });
}

async function detectPendingScreenDropoff(uid: string) {
  const records = await readRecords();
  const record = records[uid];
  if (!record?.signupCreatedAt || record.pendingOpenedAt || record.pendingNeverOpenedDropoffAt) return;
  if (now() - record.signupCreatedAt < PENDING_OPEN_DROPOFF_MS) return;
  trackEmailVerificationEvent('verification_dropoff_pending_never_opened', { uid, age_ms: now() - record.signupCreatedAt });
  records[uid] = { ...record, pendingNeverOpenedDropoffAt: now() };
  await writeRecords(records);
}

async function detectNeverVerifiedDropoff(uid: string) {
  const records = await readRecords();
  const record = records[uid];
  if (!record?.pendingOpenedAt || record.emailVerifiedAt || record.neverVerifiedDropoffAt) return;
  if (now() - record.pendingOpenedAt < NEVER_VERIFIED_DROPOFF_MS) return;
  trackEmailVerificationEvent('verification_dropoff_never_verified', { uid, age_ms: now() - record.pendingOpenedAt, resend_count: record.resendCount });
  records[uid] = { ...record, neverVerifiedDropoffAt: now() };
  await writeRecords(records);
}

export function schedulePendingScreenDropoffCheck(uid: string) {
  if (!uid) return;
  setTimeout(() => {
    detectPendingScreenDropoff(uid).catch((error) => logger.warn('email_verification.pending_dropoff_check_failed', { error: String((error as any)?.message || error) }));
  }, PENDING_OPEN_DROPOFF_MS + 1000);
}

export function scheduleNeverVerifiedDropoffCheck(uid: string) {
  if (!uid) return;
  setTimeout(() => {
    detectNeverVerifiedDropoff(uid).catch((error) => logger.warn('email_verification.never_verified_check_failed', { error: String((error as any)?.message || error) }));
  }, NEVER_VERIFIED_DROPOFF_MS + 1000);
}
