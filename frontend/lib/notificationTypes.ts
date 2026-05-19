export type NotificationChannel = 'chat' | 'calls' | 'live_classes' | 'stories' | 'assignments' | 'announcements' | 'system';

export type NotificationEvent =
  | 'chat_message'
  | 'call_incoming'
  | 'call_missed'
  | 'live_class_started'
  | 'live_class_reminder'
  | 'story_uploaded'
  | 'assignment_posted'
  | 'announcement_posted'
  | 'system_alert';

export type NotificationRoute = { pathname: string; params?: Record<string, string> };

export type NotificationPayload = {
  type: NotificationEvent;
  route: string;
  version: 1;
  push_dedupe_id: string;
  ts: number;
  [key: string]: string | number | boolean;
};

export type DispatchNotificationInput = {
  channel: NotificationChannel;
  event: NotificationEvent;
  title: string;
  body: string;
  recipientIds: string[];
  actorId?: string;
  route?: NotificationRoute;
  data?: Record<string, unknown>;
  dedupeId?: string;
  sendToAll?: boolean;
};

export type NotificationRecordInput = {
  recipient_id: string;
  actor_id: string;
  channel: NotificationChannel;
  event: NotificationEvent;
  title: string;
  body: string;
  route: string;
  data: Record<string, unknown>;
  dedupe_id: string;
};
