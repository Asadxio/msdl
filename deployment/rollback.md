# Rollback Procedure

1. Identify failed release commit/version.
2. Toggle kill switch flags (`FLAG_*`) and rollout percentages (`ROLLOUT_*`) to disable risky features.
3. Redeploy last known-good backend artifact.
4. For Expo OTA, republish previous channel update.
5. Verify `/api/ops/health` and critical smoke checks.
6. Record incident timeline and remediation action.
