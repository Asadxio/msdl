# Notification System Documentation

## Components
- `notifications`: in-app notification records with broadcast, user-targeted, role-targeted, read, and hidden state.
- `user_notification_settings`: per-user preferences.
- User token fields: `users.fcm_tokens`, `users.expo_push_tokens`, and `fcm_token_updated_at`.
- Backend services: push send/enqueue endpoints, provider router, token health engine, receipt ingestion, queue processing, routing weights, and provider circuit breakers.
- Queue/ops collections: `notification_dispatch_queue`, `notification_provider_receipts`, `notification_token_registry`, `push_dedupe`, `provider_circuit_breakers`, `worker_metrics`.

## Flow
1. Client stores Expo/FCM token on its `users/{uid}` metadata.
2. App/admin/teacher creates an in-app notification or calls backend push enqueue/send.
3. Backend collects target tokens from users, deduplicates, routes to Expo/FCM/APNS adapters, and stores provider receipts.
4. Jobs poll receipts, mark token health, aggregate notification health, and adjust provider routing.
5. Client reads notifications if broadcast, directly targeted, or role-targeted to its role/user id.

## Permissions
- Admin can create/update/delete broad notifications.
- Teachers can create allowed class-related notifications.
- Users can mark readable notifications as read/hidden.
- Provider receipt/queue/token health collections are server-owned/admin-visible.
