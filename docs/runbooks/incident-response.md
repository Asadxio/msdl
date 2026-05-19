# Incident Response Runbook

## Scenarios
- Failed deployment
- Notification outage
- Reconnect storm
- Firebase quota pressure

## Immediate actions
1. Freeze rollout (`ROLLOUT_* = 0` in production).
2. Verify `GET /api/ops/health` for env/channel/runtime status.
3. Execute rollback steps in `deployment/rollback.md`.
4. Confirm core flows: auth, chat, notifications, LMS quiz submit.
5. Open incident log with timeline and owners.
