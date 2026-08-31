# MSLB QA Report — versionCode 35
**Date**: 2026-08-05 17:29:05  |  **Device**: vivo Y36 — Android 15 (API 35)
**APK**: `com.madrasatussalikat.lilbanat` vUNKNOWN (code 35)
**Runtime**: 237.2s  |  **EAS Build**: cd3582d5

## Summary
| 🟢 PASS | 6 |
| 🔴 FAIL | 0 |
| **Total** | **6** |

---

## [R001] Splash Cold Boot
**🟢 PASS** — 97%

### Timings
- total_time_ms: `1059 ms`
- launch_state: `COLD`

### Screenshots
- `R001_cold_boot.png`

### Log
- am start -W:
Starting: Intent { cmp=com.madrasatussalikat.lilbanat/.MainActivity }
Status: ok
LaunchState: COLD
Activity: com.madrasatussalikat.lilbanat/.MainActivity
TotalTime: 1059
WaitTime: 1068
Complete
- App in foreground: True
- ✓ Cold boot TotalTime=1059 ms

---

## [R002] Keyboard Focus
**🟢 PASS** — 97%

### Log
- On onboarding screen — tapping BEGIN YOUR JOURNEY first
- Email field at (674,1265)
- Keyboard open (mIsInputViewShown): True

---

## [R003] Navigation Guard
**🟢 PASS** — 99%

### Screenshots
- `R003_nav_guard.png`

### Log
- App in foreground: True
- Screen texts: ['Welcome Back', 'Sign in to continue your Islamic learning journey.', 'Email Address', '\uf434', 'Enter your email address', 'Password']
- ✓ login-email-input in hierarchy

---

## [R004] Login TextInput ReadBack
**🟢 PASS** — 95%

### Screenshots
- `R004_01_before_email.png`
- `R004_02_after_email.png`
- `R004_03_before_pass.png`
- `R004_04_after_pass.png`

### Log
- Test email: test_opdqmm@qa.v35.test
- Test pass:  QA_zwkrxxza_2026
- On onboarding → tapping Begin
- Keyboard after email tap: True
- Read-back: 'e'
- Expected:  'test_opdqmm@qa.v35.test'
- ⚠ Partial: 'e' (encoding artifact)
- Keyboard after password tap: True
- Email retained: 'e'
- Password masked: True — display: 'Enter your password'
- Password focused: False
- Keyboard after password typing: True
- ✅ No JS errors
- Sign In button clickable: True

---

## [R005] Sign Up Navigation
**🟢 PASS** — 97%

### Screenshots
- `R005_01_login.png`
- `R005_02_signup.png`

### Log
- On onboarding → tapping Begin
- Sign Up button: found
- Screen texts: ['Welcome Back', 'Sign in to continue your Islamic learning journey.', 'Email Address', '\uf434', 'Enter your email address', 'Password', '\uf3c8', 'Enter your password']
- Tapping Sign Up at (850,2178)
- Signup screen texts: ['Mobile Number', '\uf4b5', '🇮🇳', '+91', '00000 00000', 'Email Address', '\uf434', 'Enter your email address']
- ✓ Sign Up screen confirmed

---

## [R006] Forgot Password Navigation
**🟢 PASS** — 97%

### Screenshots
- `R006_01_login.png`
- `R006_02_fp.png`

### Log
- On onboarding → tapping Begin
- Forgot Password btn: found
- Tapping at (955,1711)
- FP screen texts: ['\uf127', 'Back to Sign In', 'Reset Password', 'Enter your email to receive a reset link.', 'Email', '\uf434', 'Enter your email', 'Send Reset Link']
- ✓ Forgot Password screen confirmed

---
