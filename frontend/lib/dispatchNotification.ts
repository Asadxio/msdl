import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { buildNotificationPayload, buildNotificationRoute } from '@/lib/notificationPayloads';
import type { DispatchNotificationInput, NotificationRecordInput } from '@/lib/notificationTypes';
import { getNotificationPreferences } from '@/lib/notificationCenter';
import { createTelemetryRecord, getTelemetryCreatedAtMs, markNotificationFailed, updateTelemetryStatus } from '@/lib/notificationTelemetryWriter';
import { withTimeout } from '@/lib/errors';
import { logFirestoreFailure } from '@/lib/firestoreDebug';

function toLegacyUserId(channel: string, recipientId: string, sendToAll?: boolean) {
  if (sendToAll) return 'all';
  if (channel === 'announcements') return recipientId;
  return recipientId;
}

function makeDedupeId(input: DispatchNotificationInput): string {
  return input.dedupeId || `${input.event}:${input.channel}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export async function writeNotificationRecord(input: NotificationRecordInput): Promise<void> {
  let ref;
  try {
    ref = await addDoc(collection(db, 'notifications'), {
      recipient_id: input.recipient_id,
      actor_id: input.actor_id,
      channel: input.channel,
      event: input.event,
      title: input.title,
      message: input.body,
      body: input.body,
      route: input.route,
      data: input.data,
      read: { [input.recipient_id]: false },
      user_id: toLegacyUserId(input.channel, input.recipient_id),
      dedupe_id: input.dedupe_id,
      created_at: serverTimestamp(),
    });
  } catch (error: unknown) {
    logFirestoreFailure({ collection: 'notifications', operation: 'add', path: 'notifications', query: `dispatch notification ${input.event}/${input.channel}` }, error);
    throw error;
  }
  await createTelemetryRecord({
    notificationId: ref.id,
    dedupeId: input.dedupe_id,
    recipientId: input.recipient_id,
    event: input.event,
    channel: input.channel,
    route: input.route,
    transport: 'expo_push',
  }).catch(() => {});
}

export async function dispatchNotification(input: DispatchNotificationInput): Promise<{ dedupeId: string; recipients: number }> {
  const started = Date.now();
  const dedupeId = makeDedupeId(input);
  logger.info('[notification_dispatch]', { event: input.event, channel: input.channel, target_count: input.recipientIds.length, dedupe_id: dedupeId });
  if (!input.title.trim() || !input.body.trim()) throw new Error('Notification title/body required');
  const uniqueRecipients = Array.from(new Set(input.recipientIds.filter(Boolean)));
  const allowed: string[] = [];
  for (const uid of uniqueRecipients) {
    const prefs = await getNotificationPreferences(uid).catch(() => null);
    if (!prefs) { allowed.push(uid); continue; }
    const mapped = input.channel === 'live_classes' ? 'live_class' : input.channel === 'stories' ? 'story' : input.channel;
    if ((prefs.channels as Record<string, boolean>)[mapped] === false) continue;
    allowed.push(uid);
  }
  const payload = buildNotificationPayload(input, dedupeId);
  const route = buildNotificationRoute(input);
  const actorId = String(input.actorId || auth.currentUser?.uid || 'system');

  // Step 1: Always save notification records to Firestore first (this is what shows in-app)
  await Promise.all(allowed.map((uid) => writeNotificationRecord({
    recipient_id: uid,
    actor_id: actorId,
    channel: input.channel,
    event: input.event,
    title: input.title,
    body: input.body,
    route,
    data: payload,
    dedupe_id: dedupeId,
  })));
  await Promise.all(allowed.map((uid) => updateTelemetryStatus({ dedupeId, recipientId: uid, status: 'queued' }).catch(() => {})));

  // Step 2: Try backend queue API first, fall back to direct Expo Push API
  let pushSent = false;
  try {
    const base = String(
      process.env.EXPO_PUBLIC_PUSH_API_URL
      || process.env.EXPO_PUBLIC_LIVE_API_URL
      || String(process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/api\/?$/, ''),
    ).replace(/\/$/, '');
    if (base) {
      const idToken = await auth.currentUser?.getIdToken?.();
      const res = await withTimeout(fetch(`${base}/api/push/enqueue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({
          dedupe_id: dedupeId,
          event: input.event,
          channel: input.channel,
          payload: { title: input.title, body: input.body, data: payload },
          recipients: allowed,
          priority: 5,
        }),
      }), 4000);
      if (res.ok) pushSent = true;
    }
  } catch {
    // Backend unavailable — will use direct Expo fallback below
  }

  if (!pushSent) {
    // Step 3: Direct Expo Push API fallback — works without any backend
    try {
      const tokensSet = new Set<string>();
      for (const uid of allowed.slice(0, 100)) {
        try {
          const { getDoc: _getDoc, doc: _doc } = await import('firebase/firestore');
          const userSnap = await _getDoc(_doc(db, 'users', uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            const tokens: string[] = Array.isArray(data.expo_push_tokens) ? data.expo_push_tokens : [];
            tokens.forEach((t) => { if (t && t.startsWith('ExponentPushToken[')) tokensSet.add(t); });
          }
        } catch { /* skip user */ }
      }
      const tokens = Array.from(tokensSet);
      if (tokens.length > 0) {
        const messages = tokens.map((token) => ({
          to: token,
          sound: 'default',
          title: input.title,
          body: input.body,
          data: payload,
          priority: 'high',
        }));
        for (let i = 0; i < messages.length; i += 20) {
          const batch = messages.slice(i, i + 20);
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
            body: JSON.stringify(batch),
          }).catch(() => {});
        }
        pushSent = true;
      }
    } catch (fallbackErr) {
      logger.warn('[notification_direct_push_failed]', { error: String((fallbackErr as any)?.message || fallbackErr) });
    }
  }

  await Promise.all(allowed.map(async (uid) => {
    const createdAt = await getTelemetryCreatedAtMs(dedupeId, uid).catch(() => 0);
    await updateTelemetryStatus({
      dedupeId, recipientId: uid,
      status: pushSent ? 'sent' : 'queued',
      latencyMs: createdAt > 0 ? Date.now() - createdAt : undefined,
    }).catch(() => {});
  }));

  logger.info('[notification_dispatch_success]', { event: input.event, channel: input.channel, recipient_count: allowed.length, dedupe_id: dedupeId, push_sent: pushSent, duration_ms: Date.now() - started });
  return { dedupeId, recipients: allowed.length };
}

