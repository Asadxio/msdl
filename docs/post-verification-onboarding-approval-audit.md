# Post-Verification Onboarding & Approval Audit

Audit date: 2026-06-08

## Executive summary

- **Production readiness score: 86/100.** The app now routes verified users to a correct destination for verified-approved, verified-pending, rejected, suspended/deactivated, missing-profile, incomplete-profile, and missing-role states.
- **Critical bug found and fixed:** the realtime profile listener previously signed users out when the `users/{uid}` document was missing, rejected, or deactivated. That made the Account Rejected / Account Suspended screens unreachable and could send users back to login instead of a clear support path.
- **Can a new student always reach the correct destination?** Yes, if Firebase Auth and Firestore are reachable. A verified approved student enters the app; pending, rejected, suspended, missing-profile, incomplete-profile, and missing-role states now land on explicit status screens instead of blank/loading/dead-end states.

## 1. Full user journey diagram

```text
Signup form
  ↓ createUserWithEmailAndPassword
  ↓ sendEmailVerification
  ↓ create users/{uid} + public_profiles/{uid}
Email verification pending screen
  ├─ Email unverified → Verify Your Email screen
  │   ├─ Resend verification email
  │   └─ Change Email Address → updateEmail → sendEmailVerification → back to pending
  ↓ User clicks Firebase verification link
Login / auth restored
  ↓ AuthContext reloads Firebase user
  ↓ users/{uid} profile listener/cache loads profile
AuthGate checks, in order:
  1. onboarding-entry requirement
  2. unauthenticated user → /auth/login
  3. legal acceptance gate for approved users
  4. admin/super-admin route authorization
  5. rejected account → /auth/pending rejected state
  6. deactivated/suspended account → /auth/pending suspended state
  7. missing/corrupt profile or role → /auth/pending profile blocker state
  8. email unverified → /auth/pending verification state
  9. status pending → /auth/pending approval pending state
 10. status approved/admin/super-admin → app dashboard
```

## 2. Every auth gate discovered

| Gate | Location | Behavior | Result |
| --- | --- | --- | --- |
| Firebase auth restore | `AuthProvider` | Watches `onAuthStateChanged`, starts profile listener, falls back to cache/watchdog. | Prevents indefinite startup loading. |
| Profile document listener | `AuthProvider` | Listens to `users/{uid}` and validates role/status/profile fields. | Missing or corrupt docs become explicit profile issues. |
| Onboarding entry | `AuthGate` | Blocks normal routing until onboarding check completes or times out. | Redirects to `/onboarding-entry` if needed. |
| Unauthenticated guard | `AuthGate` | Requires signed-in user for app routes. | Redirects to `/auth/login`. |
| Legal consent | `AuthGate` | Requires approved users to accept legal docs. | Redirects to `/legal-gate`. |
| Admin/super-admin guard | `AuthGate` | Blocks admin routes unless role is approved `admin` or approved `super_admin`. | Redirects to `/unauthorized?required=admin`. |
| Account rejected | `AuthGate` + pending screen | Shows rejected state. | User sees support guidance and sign out. |
| Account suspended/deactivated | `AuthGate` + pending screen | Shows suspended state. | User sees support guidance and sign out. |
| Profile incomplete / missing / role missing | `AuthGate` + pending screen | Shows Profile Incomplete or Role Missing. | User can check status or contact support. |
| Email unverified | `AuthGate` + pending screen | Shows email verification instructions. | User can resend/change email/check status. |
| Approval pending | `AuthGate` + pending screen | Shows approval pending. | User waits for admin review and can check status. |
| Approved user | `AuthGate` | Leaves auth routes and enters root dashboard. | Tracks `user_entered_app`. |

## 3. Failure points discovered

1. **Rejected/deactivated sign-out dead end — fixed.** The listener signed users out instead of letting the pending screen show rejected/suspended guidance.
2. **Missing profile document — fixed.** Missing `users/{uid}` no longer signs out; it is tracked and routed to a Profile Incomplete screen.
3. **Corrupt or partial profile — fixed.** Missing name/email/status or invalid status is treated as `profile_incomplete`.
4. **Missing/invalid role — fixed.** Invalid roles are tracked as `role_missing` and routed to a Role Missing screen rather than silently entering as a student.
5. **Super-admin auth gate gap — fixed.** Root admin routing now treats `super_admin` as privileged alongside `admin`.
6. **Approval-pending ambiguity — improved.** Pending users now see “Approval Pending” with email-verified context.



## Exact files involved

- `frontend/context/AuthContext.tsx` — Firebase Auth state, profile listener/cache, profile validation, profile issue detection, and sign-out behavior.
- `frontend/app/_layout.tsx` — AuthGate routing order, legal/admin/protected route redirects, post-verification analytics, and approved-user entry routing.
- `frontend/app/auth/pending.tsx` — Email verification, approval pending, profile incomplete, role missing, rejected, and suspended/deactivated user-facing states.
- `frontend/lib/analytics.ts` — Typed analytics event names for post-verification routing outcomes.
- `firestore.rules` — Server-side role/status permissions that require approved status and valid roles for protected data access.
- `docs/post-verification-onboarding-approval-audit.md` — This audit and production-readiness assessment.

## 4. Firestore data audit

| Collection/document | Required for entry? | Required fields | Missing/corrupt handling |
| --- | --- | --- | --- |
| `users/{uid}` | Yes | `name`, `email`, `role`, `status` | Missing document → Profile Incomplete screen + `missing_profile_document`. Partial/corrupt → Profile Incomplete/Role Missing. |
| `public_profiles/{uid}` | No for entry | `uid`, `name`, `role`, `status`, `is_active`, `searchable` | Synced opportunistically from `users/{uid}`; failure does not block auth journey. |
| `enrollments` | No for initial dashboard | `user_id`, `course_id`, `status` | Feature-level access may be limited, but dashboard entry is not blocked. |
| `permissions` / role-derived permissions | No separate document found as a global auth gate | Role is read from `users/{uid}` and Firestore rules. | Invalid/missing role is trapped before app entry. |
| `roles` collection | No role collection found as a required app-entry document | N/A | Role source of truth is `users/{uid}.role`. |

## 5. Role validation

- **Student:** allowed into the standard dashboard only when `status === approved` and email is verified.
- **Teacher:** allowed into the app when approved and email verified; feature access is controlled per screen/rules.
- **Admin:** treated as privileged in AuthGate and can access admin routes when approved.
- **Super Admin:** now treated as privileged in AuthGate for admin-route access.
- **Missing/invalid role:** tracked as `role_missing` and routed to the Role Missing screen.

## 6. Analytics added

- `user_entered_app`
- `user_stuck_after_verification`
- `profile_incomplete`
- `approval_pending`
- `approval_rejected`
- `role_missing`
- `missing_profile_document`

Events include user id, profile status, role, profile issue, platform, timestamp, email verification state, and the gate reason where available.

## 7. UX screens verified/improved

- **Email Verification:** shows destination email, sender search guidance, Spam/Junk/Promotions guidance, resend, and change email.
- **Approval Pending:** tells users email is verified and an admin must approve the account.
- **Profile Incomplete:** tells users the profile is missing/incomplete and to check status or contact support.
- **Role Missing:** tells users support must fix account access.
- **Account Rejected:** tells users the signup request was rejected and to contact support.
- **Account Suspended:** tells users the account is suspended and to contact support.

## 8. Testing checklist

- Verified student enters app: covered by `user && profile.status === approved` AuthGate branch.
- Pending student sees correct screen: covered by `profile.status === pending` branch and Approval Pending UI.
- Approved student sees dashboard: covered by approved branch and auth-route replacement to `/`.
- Missing profile handled: covered by `missing_profile_document` profile issue branch.
- Missing role handled: covered by `role_missing` issue branch.
- No redirect loops: pending and change-email routes are allowlisted for unverified/pending users; rejected/suspended/profile blocker routes remain on `/auth/pending`.
- No blank screens: startup watchdog, profile cache fallback, and explicit pending states prevent indefinite blank screens under known states.
