# MSLB — Release Audit Baseline & Environment Ledger

**Project:** Madrasatu-s-Salikat Lil Banat (`com.madrasatussalikat.lilbanat`)  
**Firebase Project:** `madrasa-app-50d6c`  
**Active Working Directory:** `C:\Users\xioas\.gemini\antigravity\scratch\msdl`  
**Git Branch:** `release/play-store-submission-v50`  
**Current HEAD Commit:** `5f96c3e7310d688e29378b1c60964434bfd6c531`  
**Date of Audit Baseline:** 2026-10-20  
**Verification Tier:** Autonomous P0 Pre-Release Verification  

---

## 1. Repository & Git Working-Tree Status

### Working Tree Summary
- **Current Branch:** `release/play-store-submission-v50`
- **HEAD Commit Hash:** `5f96c3e7310d688e29378b1c60964434bfd6c531`
- **Tracked Modified Files (12):**
  1. `firestore.rules` — Hardened `/admin_logs/{logId}` to `allow create: if false;` and added `/privacy_email_rate_limits/{rateLimitId}` rule.
  2. `frontend/app/(tabs)/quiz.tsx` — Quiz category lockout fix; enables dynamic practice questions.
  3. `frontend/app/admin/users.tsx` — Integrated `AdminCourseEnrollmentModal` for admin student multi-course enrollment.
  4. `frontend/app/auth/signup.tsx` — Signup validation & guardian consent handling with keyboard scroll spacer.
  5. `frontend/app/course/[id].tsx` — Integrated strict `isAuthoritativelyFreeCourse` check.
  6. `frontend/app/payment.tsx` — Corrected payment completion redirection route to `/(tabs)/courses`.
  7. `frontend/context/AuthContext.tsx` — Profile state management and subscription synchronization.
  8. `frontend/context/DataContext.tsx` — Course catalog caching & active organization scoping.
  9. `functions/src/config/secrets.ts` — Defined `PRIVACY_VERIFICATION_SECRET` for Secret Manager binding.
  10. `functions/src/payments/enrollInFreeCourse.ts` — Server-side authoritative free course verification & approved student check.
  11. `functions/src/privacy/processAccountDeletion.ts` — Admin recovery authorization, pre-existing `requestId` requirement, and target UID tampering defense.
  12. `functions/src/privacy/publicVerification.ts` — Fixed code generation range to `[100000, 1000000)`, email-keyed HMAC rate-limiting, and server-keyed HMAC-SHA256 token hashing.

- **Untracked Working Tree Files (10):**
  1. `docs/STUDENT_BUGS_AND_BLOCKERS.md` — Forensic defect ledger.
  2. `docs/STUDENT_BUTTON_ROUTE_INVENTORY.csv` — Comprehensive 74-button route inventory.
  3. `docs/STUDENT_JOURNEY_DEEP_AUDIT.md` — Complete master audit report.
  4. `docs/STUDENT_QA_TEST_MATRIX.md` — Multi-tier QA test execution matrix.
  5. `docs/STUDENT_REGRESSION_TEST_REPORT.md` — Regression test log and execution commands.
  6. `frontend/components/admin/AdminCourseEnrollmentModal.tsx` — Multi-course assignment modal component.
  7. `frontend/lib/officialCourses.ts` — Master catalog of 12 madrasa courses and free course evaluation helper.
  8. `functions/tests/phase80_free_course_security.test.js` — Automated free course security test suite (26/26 passed).
  9. `functions/tests/phase81_account_deletion_recovery.test.js` — Account deletion recovery and idempotency tests (5/5 passed).
  10. `functions/tests/phase82_privacy_security_hardening.test.js` — Privacy verification, HMAC token, and abuse tests (24/24 passed).

- **Preserved Binary Release Artifacts (Gitignored):**
  1. `app-release.aab` — Freshly built release bundle (57,903,525 bytes, built 10/20/2026 16:27:50, SHA-256: `71D51D5AB9F030892C08753F96E2D8EA1E43C6A4B1A95EB74463A8390DEDB12A`).
  2. `app-release-20261010-original.aab` — Preserved original 10-Oct release bundle (57,892,862 bytes, SHA-256: `497DAF29C155B25AC88DFFC1A1EC217591FE41C2565F1560C43FD479DD6DD768`).
  3. `mslb-release-v46.apk` — Preserved legacy release APK (86,006,516 bytes, SHA-256: `9F8FBA0AAC0315D0B33BD4FDB9897B6C0E31239AEF00FDB7C9A6FC74C87A4024`).
  4. `frontend/android/app/build/outputs/apk/release/app-release.apk` — Freshly compiled release APK (86,169,192 bytes, SHA-256: `F9EC532E1F1EEC0101F749A87BFB4A07CDCB4F5ACC5ACB7B4D9B2B6E7BD4E65E`).

---

## 2. Android Configuration & Binary Provenance

| Parameter | Configuration Value | Provenance Evidence |
|---|---|---|
| **Application ID / Package** | `com.madrasatussalikat.lilbanat` | `frontend/app.json`, `build.gradle`, and protobuf in `app-release.aab` |
| **Version Name** | `1.0.13` | `frontend/app.json`, `build.gradle`, and protobuf in `app-release.aab` |
| **Version Code** | `50` | `frontend/app.json`, `build.gradle`, and protobuf in `app-release.aab` |
| **Target SDK Version** | **API 36** (Android 16 preview / Play Store target) | Protobuf extract: `targetSdkVersion="36"` |
| **Compile SDK Version** | **API 36** | Protobuf extract: `compileSdkVersion="36"` |
| **Minimum SDK Version** | **API 24** (Android 7.0 Nougat) | Protobuf extract: `minSdkVersion="24"` |
| **Android Gradle Plugin** | `8.11.0` | `BUNDLE-METADATA/com.android.tools.build.gradle/app-metadata.properties` |
| **Signing Configuration** | Release Keystore `release.keystore` (Alias: `mslb-upload-key`) | `frontend/android/app/build.gradle` signingConfigs.release block |
| **AAB Source Changes Inclusion** | Confirmed: `isAuthoritativelyFreeCourse`, `AdminCourseEnrollmentModal`, dynamic quiz practice included | Decompiled inspection of `base/assets/index.android.bundle` inside `app-release.aab` |

---

## 3. Firebase Architecture & Configuration

### Firebase Project: `madrasa-app-50d6c`
- **Default Site URL:** `https://madrasa-app-50d6c.web.app` (alternative: `https://madrasa-app-50d6c.firebaseapp.com`)
- **Node.js Runtime:** `nodejs22` (Cloud Functions v2, region `us-central1`, `cpu: gcf_gen1`, `maxInstances: 10`)
- **Hosting Configuration (`firebase.json`):**
  - Public Root: `web/`
  - Active Rewrites:
    * `/account-deletion` -> `/account-deletion.html`
    * `/privacy-policy` -> `/privacy-policy.html`
    * `/auth/verify-redirect` -> `/verify-redirect.html`
    * `/auth/login` -> `/verify-redirect.html`
  - Live Status: **HTTP 404 Site Not Found** because Hosting has never been deployed to `madrasa-app-50d6c` since files were created in October 2026.

### Cloud Functions Inventory
- **27 Functions Active in Production:**
  `adminPaymentAction`, `adminRefundPayment`, `askAITutor`, `bulkImportStudents`, `claimTeacherAccessCode`, `createOrganization`, `createRazorpayOrder`, `createStatusCheck`, `deleteCourse`, `enrollInFreeCourse` (older hash: `0ad96e034d304019ef44931760f1c8216b1b2a4f`), `generateAIFlashcards`, `generateAIQuiz`, `generateCertificate`, `getQuizCategoryCounts`, `getQuizQuestions`, `getWhatsAppProviderHealthCallable`, `inviteUserToOrganization`, `razorpayWebhook`, `reactToStatus`, `recordManualPayment`, `retryStudentWelcomeMessage`, `sendNotification`, `submitPaymentReference`, `submitQuiz`, `updateOrganizationSettings`, `updateOrganizationStatus`, `verifyRazorpayPayment`.
- **4 Functions Pending Owner Deployment:**
  1. `enrollInFreeCourse` (Cloud update to sync hardened Phase 80 authoritative evaluation & student approval authorization).
  2. `processAccountDeletion` (Initial deployment: v2 callable, Storage purge, Auth deletion, Firestore anonymization, admin recovery).
  3. `initiatePublicDeletionVerification` (Initial deployment: v2 callable, bound secrets `[SMTP_*, PRIVACY_VERIFICATION_SECRET]`, email HMAC rate limiting).
  4. `verifyPublicDeletionRequest` (Initial deployment: v2 callable, bound secret `PRIVACY_VERIFICATION_SECRET`, HMAC-SHA256 constant-time comparison).

### Secret Manager Required Secrets (Names Only — Zero Values Logged)
1. `RAZORPAY_KEY_ID` (Public Razorpay Key)
2. `RAZORPAY_KEY_SECRET` (Private Razorpay Secret)
3. `GEMINI_API_KEY` (Google AI Studio Key for Sabaq Tutor, Flashcards & Quiz)
4. `SMTP_HOST` (Transactional Email Host)
5. `SMTP_PORT` (Transactional Email Port)
6. `SMTP_USER` (Transactional Email Username)
7. `SMTP_PASS` (Transactional Email Password)
8. `SMTP_FROM` (Transactional Email From Header)
9. `PRIVACY_VERIFICATION_SECRET` (Server Key for verification token HMAC and email rate-limit identifier derivation)

---

## 4. Test Scripts & Verification Suites

| Test Suite File | Command | Coverage Scope | Verified Pass Count |
|---|---|---|---|
| `phase80_free_course_security.test.js` | `node functions/tests/phase80_free_course_security.test.js` | Authoritative pricing, missing fee safe-fail, positive fee override, student authorization | **26/26 PASS** |
| `phase81_account_deletion_recovery.test.js` | `node functions/tests/phase81_account_deletion_recovery.test.js` | Failure recovery, zero false success, idempotency, concurrency lease, statutory record protection | **5/5 PASS** |
| `phase82_privacy_security_hardening.test.js` | `node functions/tests/phase82_privacy_security_hardening.test.js` | 6-digit CSPRNG range [100000, 1000000), email HMAC rate limiting across requestIds, daily cap, token HMAC, admin rules | **24/24 PASS** |
| `phase53_two_tenant_security.test.js` | `node functions/tests/phase53_two_tenant_security.test.js` | Multi-tenant SaaS isolation, role boundaries, membership scoping | **25/25 PASS** |
| `phase54a_navigation_suite.test.js` | `node functions/tests/phase54a_navigation_suite.test.js` | Navigation guards, deep linking, role authorization, status routing | **25/25 PASS** |
| `paymentFunctions.test.js` | `node functions/tests/paymentFunctions.test.js` | Razorpay HMAC signature verification, duplicate webhook idempotency | **6/6 PASS** |
| **Automated Total** | | **All 6 Suites Combined** | **111/111 PASS** |

---

## 5. Build Scripts & Environment Toolchain

- **Build Script:** `scripts/build_play_store_bundle.ps1`
  - Maps virtual drive `X:\` to `C:\Users\xioas\.gemini\antigravity\scratch\msdl` to bypass Windows 260-character path limit for CMake/Ninja.
  - Configures `JAVA_HOME` (`jdk-17.0.19.10-hotspot` or Microsoft OpenJDK 21).
  - Configures `ANDROID_HOME` (`C:\Android\Sdk`).
  - Executes `.\gradlew.bat bundleRelease --daemon --build-cache` in `X:\frontend\android`.
  - Copies output bundle to `app-release.aab` and computes SHA-256.

---

## 6. Production Readiness Scorecard & Release Verdict

| Readiness Dimension | Status | Verification Detail |
|---|---|---|
| **A. Target SDK 36 Compliance** | **PASS** | `targetSdkVersion="36"` verified via binary protobuf in `app-release.aab` |
| **B. Free Course Security** | **PASS** | Hardened `isAuthoritativelyFreeCourse` passes 26/26 automated unit tests |
| **C. Verification Code Range** | **PASS** | Upper bound exclusive 1000000; all 6-digit decimal codes reachable |
| **D. Rate-Limit Abuse Protection** | **PASS** | Email-keyed HMAC rate limits (60s cooldown, 5/day cap, 1-hr lockout on 10 failures) |
| **E. Verification Token Hardening** | **PASS** | Server-keyed HMAC-SHA256 with Secret Manager binding; zero plaintext code storage |
| **F. Admin Recovery Authorization**| **PASS** | Mandatory pre-existing `requestId`, strictly bound target UID, eligible state check |
| **G. Admin Audit Log Rules** | **PASS** | Client create denied (`allow create: if false;`); only server Cloud Functions write |
| **H. Release AAB Provenance** | **PASS** | Fresh `app-release.aab` (57.9 MB, SHA256: `71D51D5AB9F0...`) built 10/20/2026 |
| **I. Functions Cloud Deployment** | **NOT READY** | Requires owner deployment of 4 Cloud Functions to `madrasa-app-50d6c` |
| **J. Hosting Cloud Deployment** | **NOT READY** | Requires owner deployment of Firebase Hosting to resolve HTTP 404 |
| **K. Physical Hardware Smoke Test** | **NOT VERIFIED**| No physical Android device or running emulator connected |
| **OVERALL RELEASE VERDICT** | **NOT READY** | **Requires Cloud Functions deployment, Firebase Hosting deployment, and physical device test** |
