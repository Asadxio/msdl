# Analytics Architecture

## Sources
- Client analytics through `frontend/lib/analytics.ts`, LMS analytics, notification telemetry, live analytics, and error reporter modules.
- Backend `/api/analytics/ingest`, `/api/jobs/aggregate-analytics`, `/api/ops/health`, AI metrics, worker metrics, payment/security/moderation logs.

## Storage
- `analytics_daily_summary`: aggregate daily metrics.
- `analytics_dashboards`: dashboard-ready summaries.
- `analytics_alerts`: anomaly/threshold outputs.
- `worker_metrics`: queue and worker health.
- Domain audit collections: payment, security, moderation, notification receipts.

## Processing
1. Events are ingested or written by domain code.
2. Aggregation jobs roll metrics into daily summaries.
3. Anomaly detection and health endpoints expose operational signals.
4. Admin analytics screen reads aggregate collections and health APIs.

## Governance
- Analytics dashboards are admin-only.
- Raw sensitive payloads should be minimized or redacted.
- Security/payment/moderation logs must preserve audit integrity.
