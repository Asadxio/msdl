/**
 * MSLB Push Transport Gateway
 * Delegates to canonical dispatchNotification to ensure single-path delivery.
 */
import { logger } from '@/lib/logger';
import { dispatchNotification } from '@/lib/dispatchNotification';

type TransportInput = {
  title: string;
  body: string;
  data: Record<string, unknown>;
  recipientIds: string[];
  sendToAll?: boolean;
  dedupeId: string;
  channel?: string;
};

export async function sendPushTransport(input: TransportInput): Promise<void> {
  try {
    await dispatchNotification({
      channel: (input.channel as any) || 'announcements',
      event: 'system_alert',
      title: input.title,
      body: input.body,
      recipientIds: input.recipientIds,
      sendToAll: input.sendToAll,
      data: input.data,
      dedupeId: input.dedupeId,
    });
    logger.info('[push_transport_success]', { recipients: input.recipientIds.length, dedupe_id: input.dedupeId });
  } catch (error) {
    logger.warn('[push_transport_failed]', { error, dedupe_id: input.dedupeId });
    throw error;
  }
}
