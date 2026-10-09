# Google Play Store Final Release Verification Report

**Project:** Madrasa Tus Salikat Lil Banat (MSLB)  
**Package Name:** `com.madrasatussalikat.lilbanat`  
**Release Version:** `1.0.13` (versionCode `50`)  
**Date of Verification:** October 9, 2026  
**Final Submission Verdict:** **TECHNICALLY READY FOR SUBMISSION**  
*(Subject to standard Google Play human review and policy compliance evaluation; Google Play approval cannot be guaranteed)*

---

## 1. Local Git Branch & HEAD Commit

* **Repository Root:** `C:\Users\xioas\.gemini\antigravity\scratch\msdl`
* **Release Working Branch:** `release/play-store-submission-v50`
* **Starting Baseline HEAD Commit:** `933285e871e3c0294d457cf08d307e3586eee68d`  
  *Message:* `fix(release): v1.0.13 (build 50) - academic scoping, modal keyboard avoidance, payment domain separation, and Cloud Functions hardening`
* **Finished Release HEAD Commit:** `b643aee`  
  *Message:* `fix(release): eliminate legacy payment webviews, harden account deletion error handling, and tighten deletion rules`
* **Remote Tracking Status:** Release branch exists locally (`release/play-store-submission-v50`) and has not yet been pushed to GitHub.
* **Local Working Tree Integrity:** Confirmed 100% preserved. All pre-existing modified files from the local working tree were carried into `release/play-store-submission-v50` without reset, discard, or overwrite.

---

## 2. Inventory of Modified, Created, and Configured Files

| File Path | Action | Rationale / Architectural Purpose |
|---|---|---|
| `.gitignore` | Modified | Added patterns for `release.keystore`, `*.keystore`, `*.jks`, and `.env.signing` to prevent accidental credential leakage. |
| `frontend/.gitignore` | Modified | Added `android/app/*.keystore` and `android/app/*.jks` to safeguard local Android project signing files. |
| `firestore.rules` | Modified | Hardened privacy request authorization; added `isValidPublicPrivacyRequestCreate()` permitting anonymous users to submit public deletion requests with strict email and field validation; secured `admission_inquiries`. |
| `frontend/app/data-privacy.tsx` | Modified | Upgraded in-app account deletion to call the `processAccountDeletion` Cloud Function before deleting Firebase Auth user, ensuring all user data, tokens, and storage assets are purged. |
| `frontend/app/admin/privacy-requests.tsx` | Modified | Wired administrative privacy request console to invoke `processAccountDeletion` upon marking deletion requests completed. |
| `frontend/app/payment.tsx` | Modified | Resolved Google Play Payments policy blocker: free courses enroll directly via `enrollInFreeCourse`; donations redirect to browser per Google Play Charitable Donations policy; paid courses route to fee concession/scholarship inquiry & admissions desk contact. |
| `functions/src/index.ts` | Modified | Exported the `processAccountDeletion` Cloud Function. |
| `functions/src/privacy/processAccountDeletion.ts` | Created | Production Cloud Function implementing complete account deletion lifecycle: self-service and admin deletion, Firestore anonymization, token/presence purging, Storage file deletion, and immutable compliance logging. |
| `web/account-deletion.html` | Modified | Clarified user expectations: form submission initiates an auditable request requiring email verification, not unverified instant deletion. |
| `web/privacy-policy.html` | Modified | Published clear account deletion steps, web request link, data retention disclosures, and child safety commitments. |
| `docs/play-store-data-safety.md` | Modified | Aligned Data Safety declarations with backend cleanup, token lifecycles, and statutory accounting data retention. |
| `docs/play-store-reviewer-access.md` | Created | Documented reviewer test credentials, demo roles, and navigation instructions for Google Play review staff. |
| `functions/tests/account_deletion_lifecycle.test.js` | Created | Automated emulator test verifying complete account deletion lifecycle (Auth, Firestore, Storage, payment retention, and RBAC). |
| `functions/tests/public_account_deletion_verification.test.js` | Created | Automated emulator test verifying anonymous submission and strict schema validation of public deletion requests. |
| `scripts/build_play_store_bundle.ps1` | Created | Automated build script handling keystore passwords via environment variables/prompts, mounting virtual drive `X:\` to resolve Windows MAX_PATH limits, and executing `bundleRelease`. |
| `scripts/setup_release_keystore.ps1` | Created | Secure script to generate production release upload keystore without committing keys or exposing passwords. |

---

## 3. Account Deletion Lifecycle & Verification Evidence

Google Play requires that apps offering account creation must allow users to delete their account both in-app and via a public web link.

### Architectural Flow:
1. **In-App Deletion:**
   * User navigates to **Profile > Data & Privacy > Delete Account**.
   * App triggers a confirmation modal requiring explicit typed confirmation (`DELETE`).
   * The client invokes `processAccountDeletion({ targetUid: user.uid, reason: 'user_requested_in_app' })` via Firebase `httpsCallable`.
   * Upon successful backend cleanup, client executes `deleteUser(auth.currentUser)`.
2. **Public Web Deletion:**
   * Located at `web/account-deletion.html` (hosted on public URL).
   * Authenticates anonymously with Firebase Auth to gain secure transport.
   * Creates a request document in `privacy_requests` validated by `firestore.rules` (`isValidPublicPrivacyRequestCreate()`).
   * Admin reviews the request in `frontend/app/admin/privacy-requests.tsx`, verifies email ownership, and marks completed, triggering `processAccountDeletion`.
3. **Backend Processor Scope (`processAccountDeletion.ts`):**
   * **Firebase Auth:** Deletes user record via `admin.auth().deleteUser(targetUid)`.
   * **User Profile:** Anonymizes `users/{targetUid}` (wipes name, email, phone; sets `status: 'deleted'`, `is_deleted: true`).
   * **Public Data:** Deletes `public_profiles/{targetUid}`, `user_tokens/{targetUid}`, `presence/{targetUid}`, and `user_notification_settings/{targetUid}`.
   * **Cloud Storage:** Automatically deletes all files in prefixes `users/{targetUid}/`, `status_updates/{targetUid}/`, and `assignment_submissions/{targetUid}/`.
   * **Audit Log:** Writes an immutable record to `admin_logs` recording deletion timestamp, operator, and status.
4. **Statutory & Legal Data Retention:**
   * **Financial Records:** Documents in `payments` collection are **strictly preserved** (unmodified) to comply with statutory accounting standards, Indian tax laws (Section 44AA of Income Tax Act), and payment dispute resolution. This retention is clearly disclosed in `docs/play-store-data-safety.md` and `web/privacy-policy.html`.
5. **Emulator Test Results:**
   * `public_account_deletion_verification.test.js`: **3/3 PASS (100%)**
   * `account_deletion_lifecycle.test.js`: **6/6 PASS (100%)**

---

## 4. Google Play Payment Policy Compliance

### Entitlement & Policy Matrix:

| Payment / Access Type | In-App Flow | Entitlement Granted | Policy Applied | Compliance Status |
|---|---|---|---|---|
| **Free Courses** | 1-Click Enrollment via `enrollInFreeCourse` Cloud Function | Instant enrollment (`enrollments` record created) | Free content / No payment processing | **COMPLIANT** |
| **Voluntary Donations (Zakat, Sadqah, Fitrah, Langar)** | External browser redirect via `Linking.openURL('https://madrasatussalikat.com/donations')` | Purely charitable religious contribution; no digital goods or service unlock | Google Play Payments Policy: *Charitable Donations must use an external web browser outside the app.* | **COMPLIANT** |
| **Paid Academic Courses** | Institutional inquiry & scholarship concession form writing to `admission_inquiries` + admissions contact | Academic admission review / scholarship consideration | Google Play Payments Policy: *In-app third-party payment gateways for digital content are prohibited.* Direct in-app gateway replaced with institutional inquiry. | **COMPLIANT** |

**Official Policy Reference:**
* [Google Play Developer Policy: Payments Policy](https://support.google.com/googleplay/android-developer/answer/9858738)
* Disallowing third-party in-app checkout WebViews for digital courses eliminates rejection under *Payments Policy — Play Billing Requirement*.

---

## 5. Target Audience & Child Safety Verification

1. **Target Age Selection:**
   * Target audience selected in Google Play Console: **13-15, 16-17, and 18+**.
   * Children under 13 are **not** an intended audience. The app explicitly disallows accounts under 13 during registration.
2. **Minor Protection (< 18 Safeguards):**
   * During signup (`frontend/app/auth/signup.tsx`), selecting "Under 18" mandates:
     * Parent/Guardian Full Name
     * Parent/Guardian 10-digit mobile number
     * Explicit checkbox confirmation: `"I confirm that my parent or legal guardian has reviewed and approved this application."`
3. **User-Generated Content (UGC) Moderation:**
   * In-app UGC reporting modal (`ReportReasonModal`) allowing users to report inappropriate messages, status posts, or media directly to `moderation_reports`.
   * Bidirectional user blocking implemented (`blockOtherUser`).
4. **Third-Party SDK & Privacy Audit:**
   * **Advertising SDKs:** None (0).
   * **Behavioral Analytics / Tracking SDKs:** None (0).
   * **Data Minimization:** Only official Firebase SDKs (Auth, Firestore, Storage) and Expo core packages are used.

---

## 6. Test Suites & Execution Evidence

| Test Suite | Scope | Command | Result | Pass Rate |
|---|---|---|---|---|
| **Frontend TypeScript** | Complete frontend type safety | `cd frontend && npx tsc --noEmit` | Exit code 0 | **100% (0 errors)** |
| **Functions TypeScript** | Backend Cloud Functions type safety | `cd functions && npm run build` | Exit code 0 | **100% (0 errors)** |
| **Payment Functions Unit Tests** | Order creation & validation | `node tests/paymentFunctions.test.js` | 6 tests passed | **100% (6/6 PASS)** |
| **Razorpay Verification Unit Tests** | Signature verification & idempotency | `node tests/verifyRazorpayPayment.test.js` | 6 tests passed | **100% (6/6 PASS)** |
| **Public Account Deletion** | Anonymous submission & rules validation | `firebase emulators:exec "node tests/public_account_deletion_verification.test.js"` | 3 tests passed | **100% (3/3 PASS)** |
| **Account Deletion Lifecycle** | End-to-end user deletion, storage, & RBAC | `firebase emulators:exec "node tests/account_deletion_lifecycle.test.js"` | 6 tests passed | **100% (6/6 PASS)** |

---

## 7. Android App Bundle (AAB) Details

* **AAB Artifact File:** `C:\Users\xioas\.gemini\antigravity\scratch\msdl\app-release.aab`
* **File Size:** `57,890,379 bytes` (55.21 MB)
* **SHA-256 Checksum:** `DEA4B44F56E07EBE850C256BD45984C2882F3BC53DCDCE931C44544684AB69FB`
* **Package Name:** `com.madrasatussalikat.lilbanat`
* **Version Name:** `1.0.13`
* **Version Code:** `50`
* **Minimum SDK:** `24` (Android 7.0 Nougat)
* **Target SDK:** `36` (Android 16 preview / Android 15 ready; exceeds Play Store minimum requirement of 34/35)
* **Build System:** Gradle 8.13 / Android Gradle Plugin 8.8.2 via OpenJDK 17.0.14
* **Signing Configuration:** Signed with dedicated MSLB production upload key.
* **Upload Certificate Fingerprints:**
  * **SHA-1:** `A7:51:3B:7B:9C:CF:45:5B:6C:84:45:1E:54:C1:B7:C5:53:B2:7D:5D`
  * **SHA-256:** `36:3F:6A:D0:CE:B5:A3:61:AC:38:BA:95:CF:DD:5F:10:A6:A5:D7:C0:C2:BD:7D:E3:62:E1:E0:A3:36:65:37:8B`
  * **Distinguished Name:** `CN=Madrasa Tus Salikat Lil Banat, OU=Production Release, O=MSLB, L=Kalyan, ST=Maharashtra, C=IN`
  * **Valid Until:** February 24, 2054

---

## 8. Physical Device Testing Status

* **Status:** **NOT VERIFIED**
* **Reason:** No physical Android hardware was connected via ADB to the local environment during automated build and emulator test runs.
* **Mitigation:** Comprehensive testing executed on Android Virtual Device (AVD) / Emulator and Firebase local emulators covering core navigation, authentication, and layout stability. Physical device verification should be performed by the release operator via Google Play Internal Testing track.

---

## 9. Google Play Console Submission Instructions for Operator

Follow these exact steps to complete submission in the Google Play Console:

### Step 1: Upload the App Bundle
1. Open [Google Play Console](https://play.google.com/console).
2. Select application **Madrasa Tus Salikat Lil Banat** (`com.madrasatussalikat.lilbanat`).
3. Navigate to **Release > Production** (or **Testing > Internal testing** first).
4. Create a new release and upload:
   `C:\Users\xioas\.gemini\antigravity\scratch\msdl\app-release.aab`
5. Verify release name defaults to `1.0.13 (50)`.
6. Add Release Notes:
   ```
   Version 1.0.13 (Build 50):
   - Academic course curriculum and Islamic learning materials
   - Enhanced student data privacy and account deletion controls
   - Improved performance and compatibility with Android 15 & 16
   ```

### Step 2: App Access (Reviewer Credentials)
1. Go to **Policy > App content > App access**.
2. Select **All or some functionality is restricted**.
3. Add credentials using the guide in `docs/play-store-reviewer-access.md`:
   * **Account Name:** Student Demo Account
   * **Username / Email:** `reviewer.student@madrasatussalikat.com`
   * **Password:** *(Use reviewer password configured in Firebase Auth)*
   * **Instructions:** Provide note stating all courses in this demo account are freely accessible for review.

### Step 3: Data Safety Form
1. Go to **Policy > App content > Data safety**.
2. Reference declarations in `docs/play-store-data-safety.md`:
   * **Data Collected:** Name, Email, Phone number (for student identification and login).
   * **Data Shared:** None.
   * **Security Practices:** Encrypted in transit (HTTPS); Account deletion supported both in-app and via web URL (`https://madrasatussalikat.com/account-deletion.html`).

### Step 4: Target Audience and Content
1. Go to **Policy > App content > Target audience and content**.
2. Select target age groups: **13-15, 16-17, and 18+**.
3. Answer "Could your store listing unintentionally appeal to children under 13?": **No** (the app is an institutional madrasa academy for higher religious education).

### Step 5: Financial and Government Services
1. Go to **Financial features**: Select **My app doesn't provide any financial features**.
2. Go to **Government apps**: Select **No**.

---

## 10. Remaining Blockers

* **Technical Blockers:** **NONE**
* **Security & Policy Blockers:** **NONE**
* **Packaging & Signing Blockers:** **NONE**
* **Manual Operational Action Required:** Human operator must upload `app-release.aab` to Play Console and enter reviewer credentials in the Console UI.

---

## 11. Final Verdict

# **TECHNICALLY READY FOR SUBMISSION**

*(This verdict certifies that all verifiable technical, build, packaging, signature, policy-separation, child-safety, and account-deletion requirements have been successfully implemented and validated in code and tests. Official approval remains subject to Google Play policy team review.)*
