import { doc, getDoc, setDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import type { NotificationDeliveryStatus, NotificationFailureCategory } from '@/lib/notificationTelemetry';

function key(dedupeId: string, recipientId: string) { return `${dedupeId}:${recipientId || 'broadcast'}`; }

function nowState() { return (AppState.currentState || 'unknown') as 'active' | 'background' | 'inactive' | 'unknown'; }

export function classifyNotificationFailure(error: unknown): NotificationFailureCategory {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  if (msg.includes('network') || msg.includes('timeout')) return 'network';
  if (msg.includes('token') && (msg.includes('invalid') || msg.includes('unregistered'))) return 'invalid_token';
  if (msg.includes('permission') || msg.includes('not allowed')) return 'permissions';
  if (msg.includes('payload') || msg.includes('malformed')) return 'payload';
  if (msg.includes('transport') || msg.includes('push')) return 'transport';
  return 'unknown';
}

export async function createTelemetryRecord(input: { dedupeId: string; recipientId: string; event: string; channel: string; notificationId?: string; route?: string; transport?: 'expo_push' | 'fcm' | 'unknown' }) {
  try {
    const ref = doc(db, 'notification_delivery_logs', key(input.dedupeId, input.recipientId));
    await setDoc(ref, {
      notification_id: input.notificationId || '',
      dedupe_id: input.dedupeId,
      recipient_id: input.recipientId,
      event: input.event,
      channel: input.channel,
      status: 'created',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      retry_count: 0,
      last_error: '',
      transport: input.transport || 'expo_push',
      device_id: String(Constants.sessionId || ''),
      app_state: nowState(),
      route: input.route || '',
      app_version: String(Constants.expoConfig?.version || ''),
      platform: Platform.OS,
    }, { merge: true });
    logger.info('[notification_telemetry_created]', { dedupe_id: input.dedupeId, recipient_id: input.recipientId, event: input.event, channel: input.channel });
  } catch (error) {
    logger.warn('[notificationTelemetryWriter] Failed to create telemetry record:', error);
  }
}

export async function updateTelemetryStatus(input: { dedupeId: string; recipientId: string; status: NotificationDeliveryStatus; latencyMs?: number; lastError?: string; failureCategory?: NotificationFailureCategory }) {
  try {
    const ref = doc(db, 'notification_delivery_logs', key(input.dedupeId, input.recipientId));
    const patch: Record<string, unknown> = { status: input.status, updated_at: serverTimestamp(), app_state: nowState() };
    if (typeof input.latencyMs === 'number') patch.latency_ms = input.latencyMs;
    if (input.lastError) patch.last_error = input.lastError;
    if (input.failureCategory) patch.failure_category = input.failureCategory;
    if (input.status === 'sent') patch.sent_at = serverTimestamp();
    if (input.status === 'delivered') patch.delivered_at = serverTimestamp();
    if (input.status === 'opened') patch.opened_at = serverTimestamp();
    if (input.status === 'failed') patch.failed_at = serverTimestamp();
    await updateDoc(ref, patch).catch(async () => {
      await setDoc(ref, patch, { merge: true }).catch(() => {});
    });
  } catch (error) {
    logger.warn('[notificationTelemetryWriter] Failed to update telemetry status:', error);
  }
}

export async function markNotificationOpened(dedupeId: string, recipientId: string, route: string) {
  await updateTelemetryStatus({ dedupeId, recipientId, status: 'opened' });
  await updateDoc(doc(db, 'notification_delivery_logs', key(dedupeId, recipientId)), { route }).catch(() => {});
  logger.info('[notification_opened]', { dedupe_id: dedupeId, recipient_id: recipientId, route });
}

export async function markNotificationDelivered(dedupeId: string, recipientId: string, latencyMs?: number) {
  await updateTelemetryStatus({ dedupeId, recipientId, status: 'delivered', latencyMs });
}

export async function markNotificationFailed(dedupeId: string, recipientId: string, error: unknown) {
  const category = classifyNotificationFailure(error);
  await updateTelemetryStatus({ dedupeId, recipientId, status: 'failed', lastError: String((error as any)?.message || error || ''), failureCategory: category });
  logger.warn('[notification_delivery_failed]', { dedupe_id: dedupeId, recipient_id: recipientId, failure_category: category });
}

export async function markProviderAccepted(dedupeId: string, recipientId: string, providerTicketId: string) {
  await updateTelemetryStatus({ dedupeId, recipientId, status: 'provider_accepted' });
  await updateDoc(doc(db, 'notification_delivery_logs', key(dedupeId, recipientId)), {
    provider_ticket_id: providerTicketId,
    provider_status: 'provider_accepted',
  }).catch(() => {});
}

export async function markProviderDelivered(dedupeId: string, recipientId: string, providerReceiptId: string, receiptLatencyMs?: number) {
  await updateTelemetryStatus({ dedupeId, recipientId, status: 'provider_delivered' });
  await updateDoc(doc(db, 'notification_delivery_logs', key(dedupeId, recipientId)), {
    provider_receipt_id: providerReceiptId,
    provider_status: 'provider_delivered',
    receipt_latency_ms: receiptLatencyMs || 0,
    receipt_checked_at: serverTimestamp(),
  }).catch(() => {});
}

export async function markProviderFailed(dedupeId: string, recipientId: string, providerError: string, category: NotificationFailureCategory = 'unknown') {
  await updateTelemetryStatus({ dedupeId, recipientId, status: 'provider_failed', lastError: providerError, failureCategory: category });
  await updateDoc(doc(db, 'notification_delivery_logs', key(dedupeId, recipientId)), {
    provider_status: 'provider_failed',
    provider_error: providerError,
    receipt_checked_at: serverTimestamp(),
  }).catch(() => {});
}

export async function updateProviderReceipt(dedupeId: string, recipientId: string, providerResponse: Record<string, unknown>) {
  await updateDoc(doc(db, 'notification_delivery_logs', key(dedupeId, recipientId)), {
    provider_response: providerResponse,
    receipt_checked_at: serverTimestamp(),
  }).catch(() => {});
}

export async function incrementRetryCount(dedupeId: string, recipientId: string) {
  try {
    const ref = doc(db, 'notification_delivery_logs', key(dedupeId, recipientId));
    await updateDoc(ref, { retry_count: increment(1), status: 'retrying', updated_at: serverTimestamp() }).catch(async () => {
      await setDoc(ref, { retry_count: 1, status: 'retrying', updated_at: serverTimestamp() }, { merge: true }).catch(() => {});
    });
    logger.info('[notification_retry]', { dedupe_id: dedupeId, recipient_id: recipientId });
  } catch (error) {
    logger.warn('[notificationTelemetryWriter] Failed to increment retry count:', error);
  }
}

export async function getTelemetryCreatedAtMs(dedupeId: string, recipientId: string): Promise<number> {
  const snap = await getDoc(doc(db, 'notification_delivery_logs', key(dedupeId, recipientId))).catch(() => null);
  const created = (snap?.data() as any)?.created_at;
  const dt = created?.toDate ? created.toDate().getTime() : 0;
  return Number(dt || 0);
}
