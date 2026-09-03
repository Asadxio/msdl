import { addDoc, collection, doc, getDoc, getDocs, limit as limitQ, query, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { buildNotificationPayload, buildNotificationRoute } from '@/lib/notificationPayloads';
import type { DispatchNotificationInput, NotificationRecordInput } from '@/lib/notificationTypes';
import { getNotificationPreferences } from '@/lib/notificationCenter';
import { createTelemetryRecord, getTelemetryCreatedAtMs, updateTelemetryStatus } from '@/lib/notificationTelemetryWriter';
import { withTimeout } from '@/lib/errors';
import { logFirestoreFailure } from '@/lib/firestoreDebug';

function makeDedupeId(input: DispatchNotificationInput): string {
  return input.dedupeId || `${input.event}:${input.channel}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export async function writeNotificationRecord(input: NotificationRecordInput & { user_id?: string }): Promise<string> {
  try {
    const ref = await addDoc(collection(db, 'notifications'), {
      recipient_id: input.recipient_id,
      actor_id: input.actor_id,
      channel: input.channel,
      event: input.event,
      title: input.title,
      message: input.body,
      body: input.body,
      route: input.route,
      data: input.data,
      read: input.recipient_id === 'all' ? {} : { [input.recipient_id]: false },
      user_id: input.user_id || input.recipient_id,
      dedupe_id: input.dedupe_id,
      created_at: serverTimestamp(),
      created_at_ms: Date.now(),
    });

    await createTelemetryRecord({
      notificationId: ref.id,
      dedupeId: input.dedupe_id,
      recipientId: input.recipient_id,
      event: input.event,
      channel: input.channel,
      route: input.route,
      transport: 'expo_push',
    }).catch(() => {});

    return ref.id;
  } catch (error: unknown) {
    logFirestoreFailure({ collection: 'notifications', operation: 'add', path: 'notifications', query: `dispatch notification ${input.event}/${input.channel}` }, error);
    throw error;
  }
}

async function collectPushTokens(targetUids: string[], isSendToAll: boolean): Promise<string[]> {
  const tokensSet = new Set<string>();

  const isExpoPushToken = (t: unknown): t is string =>
    typeof t === 'string' && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));

  if (isSendToAll) {
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), limitQ(500)));
      usersSnap.forEach((d) => {
        const data = d.data();
        const tokens = Array.isArray(data.expo_push_tokens) ? data.expo_push_tokens : [];
        tokens.forEach((t: unknown) => { if (isExpoPushToken(t)) tokensSet.add(t); });
      });
    } catch (e) {
      console.warn('[Push] Error querying users for tokens:', e);
    }

    try {
      const userTokensSnap = await getDocs(query(collection(db, 'user_tokens'), limitQ(500)));
      userTokensSnap.forEach((d) => {
        const data = d.data();
        if (isExpoPushToken(data.token)) tokensSet.add(data.token);
        if (isExpoPushToken(data.expoPushToken)) tokensSet.add(data.expoPushToken);
      });
    } catch (e) {
      console.warn('[Push] Error querying user_tokens:', e);
    }
  } else if (targetUids.length > 0) {
    const chunkSize = 20;
    for (let i = 0; i < targetUids.length; i += chunkSize) {
      const chunk = targetUids.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (uid) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (userSnap.exists()) {
              const data = userSnap.data();
              const tokens = Array.isArray(data.expo_push_tokens) ? data.expo_push_tokens : [];
              tokens.forEach((t: unknown) => { if (isExpoPushToken(t)) tokensSet.add(t); });
            }
          } catch {}

          try {
            const tokenSnap = await getDoc(doc(db, 'user_tokens', uid));
            if (tokenSnap.exists()) {
              const data = tokenSnap.data();
              if (isExpoPushToken(data.token)) tokensSet.add(data.token);
              if (isExpoPushToken(data.expoPushToken)) tokensSet.add(data.expoPushToken);
            }
          } catch {}
        })
      );
    }
  }

  return Array.from(tokensSet);
}

async function sendExpoPushBatches(
  tokens: string[],
  title: string,
  body: string,
  payload: Record<string, unknown>,
  channel: string
): Promise<number> {
  if (tokens.length === 0) return 0;

  let totalSent = 0;
  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default',
    title: title.trim(),
    body: body.trim(),
    data: {
      ...payload,
      url: channel === 'live_classes' ? '/live-class' : '/notifications',
      channel,
    },
    priority: 'high',
    channelId: 'announcements',
    _displayInForeground: true,
  }));

  const batchSize = 50;
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });
      if (res.ok) {
        totalSent += batch.length;
      }
    } catch (err) {
      console.warn('[Push] Expo push batch send failed:', err);
    }
  }

  return totalSent;
}

export async function dispatchNotification(
  input: DispatchNotificationInput
): Promise<{ dedupeId: string; recipients: number; pushCount: number }> {
  const started = Date.now();
  const dedupeId = makeDedupeId(input);
  const isSendToAll = Boolean(input.sendToAll);

  logger.info('[notification_dispatch]', {
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
  const actorId = String(input.actorId || auth.currentUser?.uid || 'admin');

  let writtenRecipients = 0;

  if (isSendToAll) {
    await writeNotificationRecord({
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
    writtenRecipients = 1;
  } else {
    const uniqueRecipients = Array.from(new Set(input.recipientIds.filter(Boolean)));
    const allowed: string[] = [];

    for (const uid of uniqueRecipients) {
      const prefs = await getNotificationPreferences(uid).catch(() => null);
      if (!prefs) {
        allowed.push(uid);
        continue;
      }
      const mapped =
        input.channel === 'live_classes' ? 'live_class' : input.channel === 'stories' ? 'story' : input.channel;
      if ((prefs.channels as Record<string, boolean>)[mapped] === false) continue;
      allowed.push(uid);
    }

    await Promise.all(
      allowed.map((uid) =>
        writeNotificationRecord({
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
        })
      )
    );
    writtenRecipients = allowed.length;

    await Promise.all(
      allowed.map((uid) =>
        updateTelemetryStatus({ dedupeId, recipientId: uid, status: 'queued' }).catch(() => {})
      )
    );
  }

  let pushTokensSent = 0;
  try {
    const tokens = await collectPushTokens(input.recipientIds, isSendToAll);
    logger.info('[notification_tokens_collected]', { count: tokens.length, isSendToAll });

    if (tokens.length > 0) {
      pushTokensSent = await sendExpoPushBatches(
        tokens,
        input.title,
        input.body,
        payload,
        input.channel
      );
    }
  } catch (pushErr) {
    logger.warn('[notification_push_failed]', { error: String(pushErr) });
  }

  try {
    const base = String(
      process.env.EXPO_PUBLIC_PUSH_API_URL ||
        process.env.EXPO_PUBLIC_LIVE_API_URL ||
        String(process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/api\/?$/, '')
    ).replace(/\/$/, '');

    if (base) {
      const idToken = await auth.currentUser?.getIdToken?.();
      void withTimeout(
        fetch(`${base}/api/push/enqueue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({
            dedupe_id: dedupeId,
            event: input.event,
            channel: input.channel,
            payload: { title: input.title, body: input.body, data: payload },
            recipients: isSendToAll ? ['all'] : input.recipientIds,
            priority: 5,
          }),
        }),
        3000
      ).catch(() => {});
    }
  } catch {}

  logger.info('[notification_dispatch_complete]', {
    dedupe_id: dedupeId,
    duration_ms: Date.now() - started,
    writtenRecipients,
    pushTokensSent,
  });

  return {
    dedupeId,
    recipients: writtenRecipients,
    pushCount: pushTokensSent,
  };
}
