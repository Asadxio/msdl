# MSLB Evidence-Based QA Report
**Date**: 2026-08-05 04:28:56
**Device**: vivo V2250 (vivo Y36) — Android 15 (SDK 35)
**APK**: `com.madrasatussalikat.lilbanat` v1.0.2 (build 31)
**Elapsed**: 60.1s

---

## Summary

| | Count |
|---|---|
| 🟢 PASS | 1 |
| 🔴 FAIL | 3 |
| Total | 4 |

---

## [R001] Splash Screen Cold Boot Timing
**Status**: 🔴 FAIL &nbsp; **Confidence**: 60%

### ⏱ Timings
- **cold_launch_initiated**: `04:27:58.132`
- **total_time_ms**: `1131 ms`
- **wait_time_ms**: `1135 ms`

### 📸 Evidence Screenshots
- `qa/artifacts/screenshots/R001_splash_after_launch.png`

### 📋 Execution Log
- Clearing app data for cold boot simulation...
- Launching app with -W (wait for launch)...
- am start output: Starting: Intent { cmp=com.madrasatussalikat.lilbanat/.MainActivity }
Status: ok
LaunchState: COLD
Activity: com.madrasatussalikat.lilbanat/.MainActivity
TotalTime: 1131
WaitTime: 1135
Complete
- ✓ Screenshot R001_splash_after_launch.png captured.
- Foreground: 

### 🔴 Failure Analysis
- **Reason**: App not in foreground after cold launch
- **Root Cause**: Possible crash or navigation loop on cold start
- **Source File**: `frontend/app/_layout.tsx`

---

## [R002] Keyboard Focus and Viewport
**Status**: 🔴 FAIL &nbsp; **Confidence**: 88%

### 📸 Evidence Screenshots
- `qa/artifacts/screenshots/R002_keyboard_open.png`

### 📋 Execution Log
- App should be on login screen. Tapping email field...
- ✓ Screenshot with keyboard open captured.
- Keyboard state (mInputShown): CLOSED
- Bottom inset (keyboard size indicator): 

### 🔴 Failure Analysis
- **Reason**: Keyboard NOT open after tapping email field
- **Root Cause**: softwareKeyboardLayoutMode may be missing or KeyboardAvoidingView not configured
- **Source File**: `frontend/app/auth/login.tsx`

---

## [R003] Root Layout Navigation Guard
**Status**: 🔴 FAIL &nbsp; **Confidence**: 70%

### 📸 Evidence Screenshots
- `qa/artifacts/screenshots/R003_nav_guard.png`

### 📋 Execution Log
- Testing navigation guard by force-navigating to courses screen unauthenticated...
- Screen texts visible: []

### 🔴 Failure Analysis
- **Reason**: Navigation guard may have failed — app not on login screen after cleared-data launch
- **Root Cause**: Auth guard in _layout.tsx or useAuth hook not triggering redirect
- **Source File**: `frontend/app/_layout.tsx`

---

## [R004] Authentication Login TextInput Verification
**Status**: 🟢 PASS &nbsp; **Confidence**: 93%

### 📸 Evidence Screenshots
- `qa/artifacts/screenshots/R004_01_before_email.png`
- `qa/artifacts/screenshots/R004_02_after_email.png`
- `qa/artifacts/screenshots/R004_03_before_pass.png`

### 📋 Execution Log
- Test credentials: email='test_wapxde@qa.mslb.test' pass='QA_ischsfxm_2026'
- Email field at: [277,1186][1072,1345]
- Password field at: [277,1485][988,1644]
- Screenshot BEFORE email typing → R004_01_before_email.png
- Tapping email field at (674,1265)...
- Typing email text via adb input text...
- Screenshot AFTER email typing → R004_02_after_email.png
- Read-back email value: 'test_wapxde@qa.mslb.test'
- Expected:             'test_wapxde@qa.mslb.test'
- ✓ Email field accepted typed text (partial match — @ encoding may have modified value).
- Screenshot BEFORE password typing → R004_03_before_pass.png
- Tapping password field at (632,1564)...
- Typing password: QA_ischsfxm_2026
- Screenshot AFTER password typing → R004_04_after_pass.png
- Final email field value: 'test_wapxde@qa.mslb.test'
- Final email focused: False
- Password field is password-type: True
- Password field focused: True
- Password field text (expected blank for security): '••••••••••••••••'
- Sign In button clickable: True
- Keyboard after password entry: CLOSED
- ⚠ Keyboard closed after password entry — UX concern (keyboard should stay open)
- ✓ No JS errors in logcat during login input sequence.
- ✓ Both fields accepted input. Login form functional.

---
