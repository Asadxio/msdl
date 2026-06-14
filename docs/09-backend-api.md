# Backend API Documentation

Base service: FastAPI app in `backend/server.py`. API routes are mounted under `/api`; `/health` is mounted at the app root.

| Method | Path | Purpose | Auth/permissions | Primary data |
|---|---|---|---|---|
| GET | `/health` | Process health | public | runtime status |
| GET | `/api/` | API root | public | service message |
| POST/GET | `/api/status` | Create/list status checks | Firebase auth | MongoDB status_checks |
| POST | `/api/live-ops/event` | Ingest live telemetry | Firebase auth | live ops analytics |
| POST | `/api/live-class/token` | Issue Agora live class token | live class member/teacher/admin | live_classes token_issues |
| POST | `/api/call/token` | Issue Agora call token | call participant | calls |
| POST | `/api/call/cleanup` | Finalize call | participant/admin | calls |
| POST | `/api/live-class/recording/start` | Start Agora cloud recording | teacher/admin | live_classes recordings |
| POST | `/api/live-class/recording/stop` | Stop recording | teacher/admin | live_classes recordings |
| POST | `/api/push/send` | Immediate push send | admin/teacher allowed by target | users tokens, notification_provider_receipts |
| POST | `/api/push/enqueue` | Queue push job | authenticated/admin depending payload | notification_dispatch_queue |
| POST | `/api/jobs/*` | Maintenance workers | service/admin protected where implemented | queues, analytics, notifications, status, payments |
| POST | `/api/status/react` | Status reaction update/repair | authenticated | status_updates/reactions |
| POST | `/api/lms/quiz/submit` | Validate/record quiz result | authenticated | quiz_results, locks |
| POST | `/api/analytics/ingest` | Client analytics ingest | authenticated | analytics collections |
| GET | `/api/ops/health` | Operational health | admin/service | subsystem health |
| POST | `/api/ai/infer` | AI moderation/insight inference | admin/moderator/service | ai_metrics |
| POST | `/api/certificates/generate` | Generate completion certificate | owner/admin with eligibility | certificates |
| POST | `/api/payments/initiate` | Start payment | authenticated owner | payments |
| POST | `/api/payments/confirm` | Confirm/submit payment | owner/admin | payments, audit logs |
| POST | `/api/payments/admin/action` | Admin review transition | admin/super_admin | payments, audit logs |
| POST | `/api/payments/webhook` | Provider webhook | provider signature | gateway events, payments |
| GET | `/api/jobs/async/metrics` | Async job metrics | admin/service | worker_metrics |

## Common request requirements
- Firebase ID token in `Authorization: Bearer <token>` for authenticated routes.
- Some sensitive endpoints additionally enforce role checks, admin origin checks, rate limits, nonces, confirmation headers, and App Check header `x-firebase-appcheck` when enabled.
- Payment webhooks require provider signature verification and idempotent state handling.

## Response conventions
- Health endpoints return JSON status objects.
- Token endpoints return Agora token/channel/app metadata and expiry.
- Job endpoints return processed counts, error counts, or metrics.
- Payment endpoints return payment state and transition result.
