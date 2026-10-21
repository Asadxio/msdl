# MSLB — Student Journey Bugs and Blockers Ledger
**Project:** Madrasatu-s-Salikat Lil Banat (`com.madrasatussalikat.lilbanat`)  
**Audit Target:** Student Experience End-to-End Release Gate Verification  
**Date:** 2026-10-20  
**Branch:** `release/play-store-submission-v50` (Commit `5f96c3e`)  

---

## Executive Summary of Defects & Architectural Blockers

During the final pre-release hardening and build preparation phase, all previous claims were forensically verified against the actual repository, merged Android manifests, newly compiled AAB binary metadata, Firebase Cloud Functions deployment queries, and Firestore Security Rules.

| Defect ID | Severity | Category | Title | Affected File / Component | Status | Verification Tier |
|---|---|---|---|---|---|---|
| **MSLB-STU-001** | **P1 (High)** | Quiz & Learning | Quiz Category Lockout on Zero / Uncounted Category Count | `frontend/app/(tabs)/quiz.tsx:734` | **RESOLVED** | Code Reviewed & TS Compiled (0 errors) |
| **MSLB-STU-002** | **P1 (High)** | Course Enrollment | Free Course Condition Security Vulnerability (Missing/Null/Empty Fee) | `frontend/lib/officialCourses.ts`, `functions/src/payments/enrollInFreeCourse.ts`, `frontend/app/course/[id].tsx` | **RESOLVED** | Automated Test Passed (26/26 Phase 80 Suite) |
| **MSLB-STU-003** | **P2 (Med)** | Navigation | Payment Completion Navigation Loop (`/courses` vs canonical `/(tabs)/courses`) | `frontend/app/payment.tsx:437` | **RESOLVED** | Code Reviewed & Route Guard Verified |
| **MSLB-STU-004** | **P2 (Med)** | Live Classroom | Audio Recording Captures Teacher Hardware Mic Only (No Remote WebRTC Mixing) | `frontend/lib/classRecording.ts:55` | **PRODUCT LIMITATION** | Code Reviewed & Documented |
| **MSLB-STU-005** | **P0 (Clarified)**| Target SDK | Outdated Report Claimed Target SDK 34 (Google Play Requires API 36) | `frontend/android/app/build.gradle` & `app-release.aab` | **RESOLVED / CLARIFIED** | Read-Only Artifact Verified (AAB has targetSdkVersion 36) |
| **MSLB-STU-006** | **P0 (Blocker)** | Cloud Functions | Account Deletion Cloud Functions Un-deployed & Free Course Hardening Not Synced | `functions/src/privacy/processAccountDeletion.ts`, `functions/src/payments/enrollInFreeCourse.ts` | **DEPLOYMENT BLOCKER** | Source Exists & Builds Locally, Cloud Redeployment Required |
| **MSLB-STU-007** | **P3 (Low)** | Onboarding | Minor Guardian Input Keyboard Obscuration on Compact Screens | `frontend/app/auth/signup.tsx:740` | **MITIGATED** | Code Reviewed |
| **MSLB-STU-008** | **P0 (Blocker)** | Release Artifact | AAB Artifact Predated Latest Source Fixes | `app-release.aab` | **RESOLVED** | Rebuilt 10/20/2026 16:27:50; LATEST CODE VERIFIED IN BUNDLE |
| **MSLB-STU-009** | **P2 (Med)** | Live E2E | No Physical Android Device or Running Emulator Attached | Local Workstation Environment | **NOT VERIFIED** | `adb devices` shows no connected hardware |
| **MSLB-STU-010** | **P0 (Blocker)** | Hosting & Compliance | Firebase Hosting Un-deployed (404 Site Not Found on Privacy & Deletion URLs) | `web/account-deletion.html`, `web/privacy-policy.html`, `firebase.json` | **HOSTING BLOCKER** | Live HTTPS requests return 404 Site Not Found |
| **MSLB-STU-011** | **P2 (Med)** | Cryptography | `randomInt` Exclusive Upper Bound Omits 999999 | `functions/src/privacy/publicVerification.ts:123` | **RESOLVED** | Fixed to `[100000, 1000000)` & Verified in Phase 82 Suite |
| **MSLB-STU-012** | **P1 (High)** | Abuse & Anti-Spam | Public Deletion Verification Rate-Limit Bypass via Fresh Request IDs | `functions/src/privacy/publicVerification.ts:109-120` | **RESOLVED** | Email-keyed HMAC rate limiting with 60s cooldown & daily cap (Phase 82 Suite) |
| **MSLB-STU-013** | **P1 (High)** | Audit & Integrity | `admin_logs` Permissive Client Create Rule (`allow create: if isAdmin()`) | `firestore.rules:1994` | **RESOLVED** | Local rule hardened to `allow create: if false;` (Phase 82 Suite) |

---

## Detailed Bug Analysis & Remediation Ledger

### Bug ID: MSLB-STU-001
- **Title:** Quiz Category Lockout on Zero or Uncomputed Question Count
- **Severity:** P1 (High — Feature Blocking)
- **Component:** `frontend/app/(tabs)/quiz.tsx`
- **User Impact:** When a student navigated to the Quiz tab, categories appeared disabled and unclickable whenever `getQuizCategoryCounts` returned 0 or took time to aggregate.
- **Root Cause:** Hardcoded `disabled={count === 0 && !isAdmin}` prevented non-admin students from accessing the category's question bank.
- **Remediation:** Removed the `disabled` prop and updated subtitle to "Practice Questions" when count is 0, allowing students to access questions dynamically.
- **Verification:** TypeScript compiled clean (`0 errors`), code reviewed.
- **Status:** **RESOLVED**

---

### Bug ID: MSLB-STU-002
- **Title:** Free Course Condition Security Vulnerability (Bypass on Missing/Null/Empty Fee)
- **Severity:** P1 (High — Security & Access Control)
- **Component:** `frontend/lib/officialCourses.ts`, `frontend/app/course/[id].tsx`, `functions/src/payments/enrollInFreeCourse.ts`
- **User Impact:** 
  The previously suggested loose condition `course.course_fee === 0 || course.fee === 0 || (!course.course_fee && !course.fee)` introduced a critical flaw: if a course document had missing (`undefined`), `null`, empty string (`""`), or invalid price fields, JS evaluated `!course.course_fee && !course.fee` as `true`, treating a paid course as free!
- **Root Cause:** Coercion of falsy non-numeric values (`null`, `undefined`, `""`) to zero, and trusting course title alone.
- **Remediation:**
  Implemented strict authoritative evaluation via `isAuthoritativelyFreeCourse()` on both client and server:
  1. Title alone is NEVER trusted to determine free status.
  2. A positive fee (`> 0`) strictly disqualifies free enrollment.
  3. Free enrollment is permitted **only** when fee is explicitly numeric `0`, string `"0"`, or confirmed in `AUTHORITATIVE_FREE_COURSE_IDS` (`course_short`).
  4. Missing, null, empty string, or malformed prices fail safely to paid/ineligible.
  5. Server enforces `userProfile.status === 'approved'` before granting free enrollment.
- **Verification:** Phase 80 automated test suite (`functions/tests/phase80_free_course_security.test.js`) executed and passed 26/26 cases, directly importing from `functions/lib/payments/enrollInFreeCourse.js`.
- **Status:** **RESOLVED**

---

### Bug ID: MSLB-STU-003
- **Title:** Payment Completion Navigation Glitch
- **Severity:** P2 (Medium — Navigation Inconsistency)
- **Component:** `frontend/app/payment.tsx`
- **User Impact:** After finishing payment, the route was redirected to `/courses` instead of canonical `/(tabs)/courses`.
- **Remediation:** Corrected redirect route to `/(tabs)/courses`.
- **Status:** **RESOLVED**

---

### Bug ID: MSLB-STU-004
- **Title:** Live Classroom Audio Recording Captures Teacher Hardware Mic Only
- **Severity:** P2 (Medium — Architectural Limitation)
- **Component:** `frontend/lib/classRecording.ts`
- **User Impact:** Students expecting recordings to include peer student questions via remote WebRTC only hear the teacher's hardware microphone.
- **Remediation:** Documented as an intended architectural boundary. Expo-av records local hardware input; WebRTC mixing requires server-side Agora recording.
- **Status:** **PRODUCT LIMITATION** (Documented in release notes)

---

### Bug ID: MSLB-STU-005
- **Title:** Discrepancy Between Audit Report (Claiming SDK 34) and Binary Artifact (API 36)
- **Severity:** P0 (Release Gate Blocker)
- **Component:** `frontend/android/app/build.gradle` & `app-release.aab`
- **Remediation:** Forensic inspection of binary protobuf in `app-release.aab` confirmed `compileSdkVersion="36"` and `targetSdkVersion="36"`. The earlier text claim of SDK 34 was an outdated report artifact.
- **Status:** **RESOLVED / CLARIFIED**

---

### Bug ID: MSLB-STU-006
- **Title:** Account Deletion Cloud Functions Un-deployed & Free Course Hardening Not Synced in Cloud
- **Severity:** P0 (Google Play Compliance Blocker)
- **Component:** `functions/src/privacy/processAccountDeletion.ts`, `functions/src/privacy/publicVerification.ts`, `functions/src/payments/enrollInFreeCourse.ts`
- **User Impact:** 
  1. In-app student account deletion (`/data-privacy`) and public web deletion (`web/account-deletion.html`) fail with `functions/not-found` because `processAccountDeletion` and `initiatePublicDeletionVerification` have not been deployed to `madrasa-app-50d6c`.
  2. The cloud-deployed version of `enrollInFreeCourse` is an older build (codebase hash `0ad96e034d304019ef44931760f1c8216b1b2a4f`), lacking today's Phase 80 security hardening.
- **Remediation Required:** Deploy `processAccountDeletion`, `initiatePublicDeletionVerification`, `verifyPublicDeletionRequest`, and updated `enrollInFreeCourse` to Firebase Cloud Functions.
- **Status:** **DEPLOYMENT BLOCKER** (Must be deployed before Google Play submission)

---

### Bug ID: MSLB-STU-007
- **Title:** Minor Guardian Input Keyboard Obscuration
- **Severity:** P3 (Low — UI Polish)
- **Component:** `frontend/app/auth/signup.tsx`
- **User Impact:** On compact Android screens, guardian consent input was partially obscured by keyboard.
- **Remediation:** Added `keyboardVerticalOffset={64}` and bottom spacer to `KeyboardAvoidingView`.
- **Status:** **MITIGATED**

---

### Bug ID: MSLB-STU-008
- **Title:** Release AAB Artifact Predated Latest Source Fixes
- **Severity:** P0 (Production Release Blocker)
- **Component:** `C:\Users\xioas\.gemini\antigravity\scratch\msdl\app-release.aab`
- **Remediation Executed:** Rebuilt a fresh release bundle via `scripts/build_play_store_bundle.ps1` on 10/20/2026 16:27:50 (`BUILD SUCCESSFUL in 10m 30s`).
- **Verification:** Inspection of `base/assets/index.android.bundle` inside the new AAB confirms that `isAuthoritativelyFreeCourse`, `AdminCourseEnrollmentModal`, and quiz fixes are present. New file size: 57,903,525 bytes, SHA256: `71D51D5AB9F030892C08753F96E2D8EA1E43C6A4B1A95EB74463A8390DEDB12A`. Original artifact preserved at `app-release-20261010-original.aab`.
- **Status:** **RESOLVED**

---

### Bug ID: MSLB-STU-009
- **Title:** Live Runtime & Physical Device Testing Not Verified
- **Severity:** P2 (Operational QA)
- **Component:** Local Test Environment / Connected Hardware
- **Observation:** `adb devices` reports no attached physical devices or running emulators.
- **Status:** **NOT VERIFIED** (In accordance with safety rules, no hardware tests may be claimed passed without actual device execution)

---

### Bug ID: MSLB-STU-010
- **Title:** Firebase Hosting Un-deployed (404 Site Not Found on Privacy Policy & Account Deletion URLs)
- **Severity:** P0 (Google Play Compliance Blocker)
- **Component:** `web/account-deletion.html`, `web/privacy-policy.html`, `firebase.json`
- **User / Reviewer Impact:** 
  Google Play Developer Policy mandates a live, publicly accessible Privacy Policy URL and Account Deletion Request URL. Live HTTP probe requests to `https://madrasa-app-50d6c.web.app/account-deletion` and `https://madrasa-app-50d6c.web.app/privacy-policy` return `404 Site Not Found`. Submitting the app while hosting is un-deployed will trigger an immediate Play Store rejection.
- **Root Cause:** Local HTML files and `firebase.json` rewrites exist, but `firebase deploy --only hosting` has never been executed on project `madrasa-app-50d6c`.
- **Remediation Required:** Project owner must execute `firebase deploy --only hosting --project madrasa-app-50d6c` prior to store submission.
- **Status:** **HOSTING BLOCKER** (Must be deployed alongside Cloud Functions)

---

### Bug ID: MSLB-STU-011
- **Title:** `crypto.randomInt` Exclusive Upper Bound Omits 999999
- **Severity:** P2 (Medium — Cryptographic / Logic Defect)
- **Component:** `functions/src/privacy/publicVerification.ts:123`
- **Impact:** 
  The 6-digit code generation used `crypto.randomInt(100000, 999999)`. In the Node.js `crypto` API, the `max` argument is strictly **exclusive** (`[min, max)`). Consequently, the generator only produced values from `100000` through `999998`, and the code `999999` was never generated.
- **Remediation Executed:** Corrected to `crypto.randomInt(100000, 1000000).toString()` via helper `generateSixDigitVerificationCode()`.
- **Verification:** Verified via Phase 82 test suite (`CODE-01`, `CODE-02`, `CODE-03`).
- **Status:** **RESOLVED**

---

### Bug ID: MSLB-STU-012
- **Title:** Public Verification Rate-Limit Bypass via Fresh Request IDs (Email Flooding Risk)
- **Severity:** P1 (High — Abuse Prevention & Resource Exhaustion)
- **Component:** `functions/src/privacy/publicVerification.ts:109-120`
- **Impact:** 
  The 30-second cooldown was enforced by reading `privacy_verification_tokens.doc(requestId)`. An attacker could submit multiple deletion requests for the same target email address, generating a new `requestId` each time. This bypassed the cooldown, allowing an attacker to trigger automated SMTP transactional emails repeatedly to spam a victim and deplete the organization's email quota.
- **Remediation Executed:**
  Implemented durable rate-limiting in `privacy_email_rate_limits/{emailRateLimitId}`, where `emailRateLimitId` is derived via server-keyed HMAC-SHA256 (`computeEmailRateLimitKey(cleanEmail, secret)`). The raw email is never stored in document IDs. Atomic transactions enforce a 60-second cooldown, a 5-request daily cap, and a 1-hour lockout after 10 cumulative failed verification attempts. Bypassing via fresh `requestId` is strictly blocked.
- **Verification:** Verified via Phase 82 test suite (10 test cases: `RATE-01` through `RATE-10`).
- **Status:** **RESOLVED**

---

### Bug ID: MSLB-STU-013
- **Title:** Permissive Client-Side Audit Log Creation in Firestore Rules
- **Severity:** P1 (High — Non-Repudiation & Audit Integrity)
- **Component:** `firestore.rules:1994`
- **Impact:**
  The rule `match /admin_logs/{logId} { allow read, create: if isAdmin(); allow update, delete: if false; }` allowed any client with an Admin token to forge audit log entries directly in Firestore. If an admin account or browser session were compromised, the attacker could write deceptive logs or obscure real admin activities.
- **Remediation Executed:**
  Hardened local `firestore.rules` to:
  ```
  match /admin_logs/{logId} {
    allow read: if isAdmin();
    allow create: if false;
    allow update, delete: if false;
  }
  ```
  Also added `match /privacy_email_rate_limits/{rateLimitId} { allow read, write: if false; }`. Client writes are strictly denied; all audit log writes must originate from privileged Cloud Functions Admin SDK.
- **Verification:** Verified via Phase 82 test suite (`RULE-01`, `RULE-02`).
- **Status:** **RESOLVED**
