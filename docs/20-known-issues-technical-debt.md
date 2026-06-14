# Known Issues & Technical Debt

## Current known issues
- Local dependency installation can fail in restricted proxy environments, which blocks local `npm ci`, `tsc`, and `expo-doctor` verification despite lockfile dry-run validation.
- Some collections are referenced by code/services but are server-owned and not explicitly client-readable in Firestore rules; this is intentional but should be documented in operational runbooks.
- `messages` and `chat_messages` both exist for backward compatibility, increasing maintenance overhead.
- `roleOf` is sourced from Firestore user documents; stale/missing user documents can produce fallback `student` behavior.
- Moderator is included in `isTeacherOrAdmin()` for some rule helpers; UI/requirements should confirm whether moderator should have teacher-like access.
- Some feature docs are inferred from broad repository modules; detailed field schemas should be tightened with TypeScript/Pydantic models over time.

## Technical debt
- Consolidate legacy MongoDB status-check endpoints or document why MongoDB remains required.
- Add generated schema/types for Firestore documents.
- Add emulator tests covering every Firestore match block.
- Split backend server route file into bounded routers by domain.
- Introduce OpenAPI examples and request/response schemas for every endpoint.
- Add automated docs generation from route/schema metadata.
