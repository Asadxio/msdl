# Payment System Documentation

## Collections
- `payments`: user-visible payment lifecycle.
- `payment_gateway_events`: immutable provider webhook event log.
- `payment_processor_audit_logs` / `payment_audit_logs`: review and transition audit.
- `payment_verification_queue`: async verification/reconciliation queue.
- `operation_dedupe`: idempotency for backend payment operations.

## States
Supported payment states/statuses include `pending`, `submitted`, `verified`, `approved`, `rejected`, `processing`, `succeeded`, `failed`, `cancelled`, `refunded`, `disputed`, and `expired`. Rules require `state == status` for admin transitions that modify both.

## User flow
1. Approved user creates a `pending` Razorpay/manual payment with amount, type, currency INR, and metadata.
2. User submits transaction/payment reference, moving to `submitted`.
3. Backend or admin reviews, verifies, approves/rejects, and writes audit data.
4. Reconciliation jobs recover stale processing payments and expire pending payments.

## Security
- Owners can only create and submit their own payments.
- Admins perform review transitions with validated fields.
- Gateway/audit/verification queue collections are not client-writable.
- Backend validates signatures and idempotency for webhooks/actions.
