import type { DispatchNotificationInput, NotificationPayload } from '@/lib/notificationTypes';

export function buildNotificationRoute(input: Pick<DispatchNotificationInput, 'route' | 'data'>): string {
  if (input.route?.pathname) {
    if (!input.route.params) return input.route.pathname;
    const q = new URLSearchParams(input.route.params).toString();
    return q ? `${input.route.pathname}?${q}` : input.route.pathname;
  }
  const d = input.data || {};
  const callId = String(d.call_id || '').trim();
  if (callId) return `/call/${callId}`;
  const chatId = String(d.chat_id || '').trim();
  if (chatId) return `/chat/${chatId}`;
  const classId = String(d.live_class_id || '').trim();
  if (classId) return `/live-class/${classId}`;
  return '/notifications';
}

export function buildNotificationPayload(input: DispatchNotificationInput, dedupeId: string): NotificationPayload {
  const route = buildNotificationRoute(input);
  return {
    type: input.event,
    route,
    version: 1,
    push_dedupe_id: dedupeId,
    ts: Date.now(),
    ...(input.data || {} as Record<string, string | number | boolean>),
  } as NotificationPayload;
}
