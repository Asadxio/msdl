# Live Class Architecture

## Components
- Expo/React Native live class route: `frontend/app/live-class/[id].tsx`.
- Agora RTC SDK: client media transport.
- Backend token endpoint: `/api/live-class/token`.
- Recording endpoints: `/api/live-class/recording/start` and `/api/live-class/recording/stop`.
- Firestore: `live_classes`, `participants`, `attendance_events`, `moderation_events`, `recordings`, and top-level `recordings`.

## Join flow
1. Client loads `live_classes/{id}` and validates eligibility through Firestore rules/UI.
2. Client requests backend token with Firebase Auth.
3. Backend verifies class, membership/enrollment/role, status, and emits token issue record.
4. Client joins Agora channel and writes participant presence/attendance events.
5. Teacher/admin may moderate participants and manage recording.

## Recording flow
1. Teacher/admin requests start recording.
2. Backend calls Agora cloud recording APIs with configured storage.
3. Backend updates `live_classes/{id}.recording` and nested/top-level recording metadata.
4. Stop endpoint finalizes state and records errors if provider operations fail.

## Reliability
- Token TTL is controlled by `AGORA_RTC_TOKEN_TTL_SECONDS`.
- Attendance events are append-only from clients.
- Participant count-only updates are permitted through a special rule path.
