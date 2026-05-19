export type NotificationDeliveryStatus =
  | 'created'
  | 'queued'
  | 'sent'
  | 'provider_accepted'
  | 'provider_delivered'
  | 'provider_failed'
  | 'provider_unknown'
  | 'delivered'
  | 'opened'
  | 'failed'
  | 'retrying';

export type NotificationFailureCategory = 'network' | 'transport' | 'invalid_token' | 'permissions' | 'payload' | 'unknown';

export type NotificationTelemetryRecord = {
  notification_id: string;
  dedupe_id: string;
  recipient_id: string;
  event: string;
  channel: string;
  status: NotificationDeliveryStatus;
  created_at?: unknown;
  updated_at?: unknown;
  sent_at?: unknown;
  delivered_at?: unknown;
  opened_at?: unknown;
  failed_at?: unknown;
  retry_count: number;
  last_error: string;
  failure_category?: NotificationFailureCategory;
  transport: 'expo_push' | 'fcm' | 'unknown';
  device_id: string;
  app_state: 'active' | 'background' | 'inactive' | 'unknown';
  latency_ms?: number;
  provider_ticket_id?: string;
  provider_receipt_id?: string;
  provider_status?: string;
  provider_error?: string;
  provider_response?: Record<string, unknown>;
  receipt_checked_at?: unknown;
  receipt_latency_ms?: number;
  route?: string;
  app_version?: string;
  platform?: string;
};
