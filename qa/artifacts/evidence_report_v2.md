# MSLB Evidence-Based QA Report — v2
**Date**: 2026-08-05 04:35:49  |  **Device**: vivo Y36 — Android 15 (API 35)
**APK**: `com.madrasatussalikat.lilbanat` v1.0.2 (build 31)  |  **Elapsed**: 81.8s

> [!NOTE]
> Android 15 API fixes applied: `topResumedActivity` for foreground, `mIsInputViewShown` for keyboard, `--compressed` for uiautomator.

---
## Summary
| Status | Count |
|---|---|
| 🟢 PASS | 4 |
| 🔴 FAIL | 0 |
| **Total** | **4** |

---

## [R001] Splash Screen Cold Boot Timing
**🟢 PASS** &nbsp; Confidence: 97%

### ⏱ Timings
- **cold_launch_initiated**: `04:34:39.771`
- **total_time_ms**: `921 ms`
- **wait_time_ms**: `933 ms`
- **launch_state**: `COLD`

### 📸 Evidence Screenshots
- `qa/artifacts/screenshots/R001_cold_boot.png`

### 📋 Execution Log
- Clearing app data for clean cold boot...
- am start -W (measures real cold boot time)...
- am start: Starting: Intent { cmp=com.madrasatussalikat.lilbanat/.MainActivity }
Status: ok
LaunchState: COLD
Activity: com.madrasatussalikat.lilbanat/.MainActivity
TotalTime: 921
WaitTime: 933
Complete
- ✓ Screenshot: R001_cold_boot.png
- App in foreground (topResumedActivity): True
- Logcat Displayed marker not in recent tail (buffer may have rotated)
- ✓ Cold boot confirmed. TotalTime=921 ms

---

## [R002] Keyboard Focus — Email Field
**🟢 PASS** &nbsp; Confidence: 97%

### 📸 Evidence Screenshots
- `qa/artifacts/screenshots/R002_keyboard_open.png`

### 📋 Execution Log
- App on login screen. Tapping email field...
- Tapping email field at (675,1266)...
- Keyboard open (mIsInputViewShown): True
- IME raw state: mInputShown=false
  mIsInputViewShown=true mStatusIcon=0
- ✓ Screenshot: R002_keyboard_open.png
- Bottom inset: 
- ✓ Keyboard confirmed OPEN via mIsInputViewShown=true

---

## [R003] Root Layout Navigation Guard — Unauthenticated Redirect
**🟢 PASS** &nbsp; Confidence: 99%

### 📸 Evidence Screenshots
- `qa/artifacts/screenshots/R003_nav_guard.png`

### 📋 Execution Log
- Stopping app, clearing data, relaunching without auth...
- ✓ Screenshot: R003_nav_guard.png
- App in foreground: True
- Nodes found: 24
- Screen texts: ['Welcome Back', 'Sign in to continue your Islamic learning journey.', 'Email Address', '\uf434', 'Enter your email address', 'Password', '\uf3c8', 'Enter your password']
- ✓ login-email-input at bounds=[277,1186][1072,1345]
- ✓ Navigation guard CONFIRMED: unauthenticated user redirected to login screen

---

## [R004] Login TextInput — Typed Value Verification
**🟢 PASS** &nbsp; Confidence: 95%

### 📸 Evidence Screenshots
- `qa/artifacts/screenshots/R004_01_before_email.png`
- `qa/artifacts/screenshots/R004_02_after_email.png`
- `qa/artifacts/screenshots/R004_03_before_pass.png`

### 📋 Execution Log
- Test email:    test_ntdobi@qa.mslb.test
- Test password: QA_hcftqmgx_2026
- Email field: [277,1186][1072,1345]
- Password field: [277,1485][988,1644]
- 📸 BEFORE email: R004_01_before_email.png
- Tapping email at (674,1265)...
- Keyboard after email tap (mIsInputViewShown): True
- Typing: test_ntdobi@qa.mslb.test
- 📸 AFTER email: R004_02_after_email.png
- Read-back email: 'test_ntdobi@qa.mslb.test'
- Expected email:  'test_ntdobi@qa.mslb.test'
- ✅ EXACT MATCH — Email TextInput verified
- 📸 BEFORE password: R004_03_before_pass.png
- Tapping password at (632,1564)...
- Keyboard after password tap (mIsInputViewShown): True
- Typing: QA_hcftqmgx_2026
- Email field retained value: 'test_ntdobi@qa.mslb.test'
- ✅ Email value retained after password focus switch
- Password field type=password: True (expected: True)
- Password field focused: True
- Password display text: '••••••••••••••••' (expected: masked dots)
- Sign In button clickable: True
- Keyboard after password typing (mIsInputViewShown): True
- ✅ No JS errors in logcat during login sequence

---
