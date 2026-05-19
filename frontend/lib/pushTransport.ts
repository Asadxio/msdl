import { logger } from '@/lib/logger';
import { sendPushToAllUsers, sendPushToUserIds } from '@/lib/pushNotifications';
import { incrementRetryCount } from '@/lib/notificationTelemetryWriter';

type TransportInput = { title: string; body: string; data: Record<string, unknown>; recipientIds: string[]; sendToAll?: boolean; dedupeId: string };

function shouldRetry(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  if (msg.includes('invalid token') || msg.includes('unregistered') || msg.includes('malformed payload')) return false;
  return msg.includes('network') || msg.includes('timeout') || msg.includes('503') || msg.includes('transport');
}

export async function sendPushTransport(input: TransportInput): Promise<void> {
  const started = Date.now();
  let attempt = 0;
  let waitMs = 400;
  while (attempt < 3) {
    try {
      if (input.sendToAll) {
        await sendPushToAllUsers({ title: input.title, body: input.body, data: input.data });
      } else if (input.recipientIds.length > 0) {
        await sendPushToUserIds(input.recipientIds, { title: input.title, body: input.body, data: input.data });
      }
      logger.info('[push_transport_success]', { recipients: input.recipientIds.length, duration_ms: Date.now() - started, retries: attempt });
      return;
    } catch (error) {
      const retry = shouldRetry(error) && attempt < 2;
      if (!retry) {
        logger.warn('[push_transport_failed]', { recipients: input.recipientIds.length, duration_ms: Date.now() - started, error, retries: attempt });
        throw error;
      }
      attempt += 1;
      await Promise.all(input.recipientIds.map((uid) => incrementRetryCount(input.dedupeId, uid).catch(() => {})));
      logger.info('[notification_retry]', { dedupe_id: input.dedupeId, attempt, backoff_ms: waitMs });
      await new Promise((r) => setTimeout(r, waitMs));
      waitMs *= 2;
    }
  }
}
