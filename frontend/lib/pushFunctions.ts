/**
 * MSLB Push Notification Cloud Function Client Helper
 * 
 * Invokes the admin-authorized sendNotification Cloud Function.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export interface SendNotificationRequest {
  recipientUid: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendAdminNotification(payload: SendNotificationRequest): Promise<{ success: boolean; messageId: string }> {
  const fn = httpsCallable<SendNotificationRequest, { success: boolean; messageId: string }>(functions, 'sendNotification');
  const res = await fn(payload);
  return res.data;
}
