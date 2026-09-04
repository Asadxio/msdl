/**
 * MSLB Canonical Notification Dispatcher — Phase 48
 *
 * Architecture:
 *   EVENT
 *     → writeNotificationRecord (idempotent, dedupe_id key)
 *     → collectPushTokens (expo + native FCM from users.expo_push_tokens + users.fcm_tokens)
 *     → push routed through backend /api/push/send (Firebase Admin handles FCM+Expo)
 *     → structured dispatch result: { sent, failed, skipped, noToken, deduped }
 *
 * DO NOT call Expo push API directly from the frontend — native FCM tokens
 * (produced by standalone release APK) are NOT accepted by exp.host.
 * The backend /api/push/send correctly routes FCM tokens → Firebase Admin
 * and Expo tokens → Expo Push API.
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  runTransaction,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { buildNotificationPayload, buildNotificationRoute } from '@/lib/notificationPayloads';
import type { DispatchNotificationInput, NotificationRecordInput } from '@/lib/notificationTypes';
import { getNotificationPreferences, shouldDeliverNotification } from '@/lib/notificationCenter';
import { createTelemetryRecord, updateTelemetryStatus } from '@/lib/notificationTelemetryWriter';
import { withTimeout } from '@/lib/errors';
import { logFirestoreFailure } from '@/lib/firestoreDebug';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DispatchResult = {
  dedupeId: string;
  /** Notification records written to Firestore */
  recipients: number;
  /** Tokens push was sent to (may differ from recipients) */
  pushCount: number;
  /** Tokens with no registered push token */
  noToken: number;
  /** Recipients skipped by notification preference */
  skipped: number;
  /** Was the whole dispatch skipped due to dedupe? */
  deduped: boolean;
  /** Provider error count (non-fatal, logged) */
  providerErrors: number;
};

export type DispatchStatus =
  | 'queued'
  | 'sent'
  | 'skipped_by_preference'
  | 'no_token'
  | 'provider_failed'
  | 'invalid_token'
  | 'deduplicated';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeDedupeId(input: DispatchNotificationInput): string {
  if (input.dedupeId) return input.dedupeId;
  // Deterministic if caller provides event+channel, random suffix otherwise
  return `${input.event}:${input.channel}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Idempotent notification record writer
// Uses a transaction to atomically check+write a dedupe marker, preventing
// duplicate records on retry/network timeout.
// ─────────────────────────────────────────────────────────────────────────────

export async function writeNotificationRecord(
  input: NotificationRecordInput & { user_id?: string }
): Promise<{ id: string; alreadyExists: boolean }> {
  try {
    const dedupeDocId = `${input.dedupe_id}:${input.recipient_id}`;
    const dedupeRef = doc(db, 'notification_dedupe', dedupeDocId);
    const notifRef = doc(collection(db, 'notifications'));

    // Check dedupe marker first (fast path before transaction)
    const existingMarker = await withTimeout(getDoc(dedupeRef), 4000).catch(() => null);
    if (existingMarker?.exists()) {
      const existingNotifId = existingMarker.data()?.notification_id as string | undefined;
      return { id: existingNotifId || dedupeDocId, alreadyExists: true };
    }

    await withTimeout(
      runTransaction(db, async (tx) => {
        const markerSnap = await tx.get(dedupeRef);
        if (markerSnap.exists()) return; // already written by concurrent caller

        const docData: Record<string, unknown> = {
          recipient_id: input.recipient_id,
          actor_id: input.actor_id,
          channel: input.channel,
          event: input.event,
          title: input.title,
          message: input.body,
          body: input.body,
          route: input.route,
          data: input.data || {},
          read: input.recipient_id === 'all' ? {} : { [input.recipient_id]: false },
          user_id: input.user_id || input.recipient_id,
          dedupe_id: input.dedupe_id,
          created_at: serverTimestamp(),
          created_at_ms: Date.now(),
        };

        tx.set(notifRef, docData);
        tx.set(dedupeRef, {
          notification_id: notifRef.id,
          recipient_id: input.recipient_id,
          created_at: serverTimestamp(),
          created_at_ms: Date.now(),
        });
      }),
      8000
    );

    void createTelemetryRecord({
      notificationId: notifRef.id,
      dedupeId: input.dedupe_id,
      recipientId: input.recipient_id,
      event: input.event,
      channel: input.channel,
      route: input.route,
      transport: 'expo_push',
    }).catch(() => {});

    return { id: notifRef.id, alreadyExists: false };
  } catch (error: unknown) {
    logFirestoreFailure(
      {
        collection: 'notifications',
        operation: 'add',
        path: 'notifications',
        query: `dispatch notification ${input.event}/${input.channel}/${input.recipient_id}`,
      },
      error
    );
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Push delivery via backend
// The backend /api/push/send routes:
//   native FCM tokens → Firebase Admin Messaging (works in release APK)
//   Expo tokens       → Expo Push API
// This is the CANONICAL push path. Do NOT call exp.host directly from frontend.
// ─────────────────────────────────────────────────────────────────────────────

type BackendPushResult = {
  ok: boolean;
  sent: number;
  failed: number;
  skipped: number;
  noToken: number;
  providerErrors: number;
  raw?: unknown;
};

async function sendPushViaBackend(params: {
  title: string;
  body: string;
  data: Record<string, unknown>;
  recipientIds: string[];
  sendToAll: boolean;
  dedupeId: string;
  channel: string;
}): Promise<BackendPushResult> {
  const base = String(
    process.env.EXPO_PUBLIC_PUSH_API_URL ||
      process.env.EXPO_PUBLIC_LIVE_API_URL ||
      String(process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/api\/?$/, '')
  ).replace(/\/$/, '');

  if (!base) {
    logger.warn('[notification_push_skipped]', {
      reason: 'no_backend_url',
      dedupe_id: params.dedupeId,
    });
    return { ok: false, sent: 0, failed: 0, skipped: 0, noToken: 0, providerErrors: 1 };
  }

  let idToken: string | undefined;
  try {
    idToken = await auth.currentUser?.getIdToken?.();
  } catch {
    // Continue without token — backend will reject with 401 and we'll log it
  }

  if (!idToken) {
    logger.warn('[notification_push_skipped]', {
      reason: 'no_auth_token',
      dedupe_id: params.dedupeId,
    });
    return { ok: false, sent: 0, failed: 0, skipped: 0, noToken: 0, providerErrors: 1 };
  }

  try {
    const res = await withTimeout(
      fetch(`${base}/api/push/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          title: params.title,
          body: params.body,
          data: {
            ...params.data,
            channelId: params.channel === 'live_classes' ? 'announcements' : params.channel,
            push_dedupe_id: params.dedupeId,
          },
          send_to_all: params.sendToAll,
          user_ids: params.sendToAll ? [] : params.recipientIds,
          event_type: params.data.type || 'announcement',
        }),
      }),
      20000
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn('[notification_push_provider_error]', {
        status: res.status,
        body: body.slice(0, 200),
        dedupe_id: params.dedupeId,
      });
      return { ok: false, sent: 0, failed: 1, skipped: 0, noToken: 0, providerErrors: 1, raw: body };
    }

    const json = await res.json().catch(() => ({})) as Record<string, unknown>;

    // Backend returns { ok, sent, failed, stale_removed, ... }
    const sent = Number(json.sent ?? 0);
    const failed = Number(json.failed ?? 0);

    logger.info('[notification_push_delivered]', {
      dedupe_id: params.dedupeId,
      sent,
      failed,
      raw: json,
    });

    return {
      ok: res.ok,
      sent,
      failed,
      skipped: 0,
      noToken: 0,
      providerErrors: failed,
      raw: json,
    };
  } catch (err) {
    logger.warn('[notification_push_network_error]', {
      error: String(err),
      dedupe_id: params.dedupeId,
    });
    return { ok: false, sent: 0, failed: 0, skipped: 0, noToken: 0, providerErrors: 1 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical dispatchNotification
// ─────────────────────────────────────────────────────────────────────────────

export async function dispatchNotification(
  input: DispatchNotificationInput
): Promise<DispatchResult> {
  const started = Date.now();
  const dedupeId = makeDedupeId(input);
  const isSendToAll = Boolean(input.sendToAll);

  logger.info('[notification_dispatch_start]', {
    event: input.event,
    channel: input.channel,
    target_count: input.recipientIds.length,
    sendToAll: isSendToAll,
    dedupe_id: dedupeId,
  });

  if (!input.title.trim() || !input.body.trim()) {
    throw new Error('Notification title and message body are required.');
  }

  const payload = buildNotificationPayload(input, dedupeId);
  const route = buildNotificationRoute(input);
  const actorId = String(input.actorId || auth.currentUser?.uid || 'system');

  let writtenRecipients = 0;
  let skipped = 0;

  // ── Step 1: Write Firestore notification records ──────────────────────────
  if (isSendToAll) {
    // Single "all" broadcast record
    try {
      const { alreadyExists } = await writeNotificationRecord({
        recipient_id: 'all',
        user_id: 'all',
        actor_id: actorId,
        channel: input.channel,
        event: input.event,
        title: input.title,
        body: input.body,
        route,
        data: { ...payload, is_broadcast: true },
        dedupe_id: dedupeId,
      });
      if (!alreadyExists) writtenRecipients = 1;
    } catch (err) {
      logger.warn('[notification_record_write_failed]', {
        event: input.event,
        recipient: 'all',
        dedupe_id: dedupeId,
        error: String(err),
      });
    }
  } else {
    const uniqueRecipients = Array.from(new Set(input.recipientIds.filter(Boolean)));
    const allowed: string[] = [];

    // Preference filtering (per-recipient)
    await Promise.all(
      uniqueRecipients.map(async (uid) => {
        try {
          const channelKey = input.channel === 'live_classes'
            ? 'live_class'
            : input.channel === 'stories'
            ? 'story'
            : input.channel;
          const canDeliver = await shouldDeliverNotification(
            uid,
            channelKey as any,
            payload as Record<string, unknown>
          );
          if (canDeliver) {
            allowed.push(uid);
          } else {
            skipped += 1;
            logger.info('[notification_skipped_by_preference]', {
              uid,
              channel: input.channel,
              dedupe_id: dedupeId,
            });
          }
        } catch {
          // If preference check fails, deliver anyway (fail-open)
          allowed.push(uid);
        }
      })
    );

    // Write per-recipient records (idempotent)
    await Promise.allSettled(
      allowed.map(async (uid) => {
        try {
          const { alreadyExists } = await writeNotificationRecord({
            recipient_id: uid,
            user_id: uid,
            actor_id: actorId,
            channel: input.channel,
            event: input.event,
            title: input.title,
            body: input.body,
            route,
            data: payload,
            dedupe_id: dedupeId,
          });
          if (!alreadyExists) writtenRecipients += 1;
        } catch (err) {
          logger.warn('[notification_record_write_failed]', {
            event: input.event,
            recipient: uid,
            dedupe_id: dedupeId,
            error: String(err),
          });
        }
      })
    );

    // Mark telemetry queued
    void Promise.allSettled(
      allowed.map((uid) =>
        updateTelemetryStatus({ dedupeId, recipientId: uid, status: 'queued' }).catch(() => {})
      )
    );
  }

  // ── Step 2: Push via backend (FCM + Expo) ────────────────────────────────
  const pushResult = await sendPushViaBackend({
    title: input.title,
    body: input.body,
    data: payload,
    recipientIds: isSendToAll ? [] : input.recipientIds,
    sendToAll: isSendToAll,
    dedupeId,
    channel: input.channel,
  });

  logger.info('[notification_dispatch_complete]', {
    dedupe_id: dedupeId,
    duration_ms: Date.now() - started,
    written_records: writtenRecipients,
    push_sent: pushResult.sent,
    push_failed: pushResult.failed,
    skipped_by_pref: skipped,
    provider_errors: pushResult.providerErrors,
  });

  return {
    dedupeId,
    recipients: writtenRecipients,
    pushCount: pushResult.sent,
    noToken: pushResult.noToken,
    skipped,
    deduped: writtenRecipients === 0 && pushResult.sent === 0,
    providerErrors: pushResult.providerErrors,
  };
}
