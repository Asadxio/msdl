"""Device state diagnostic for Android 15 API compatibility."""
import subprocess, time

ADB = "C:\\Users\\xioas\\AppData\\Local\\npm-cache\\_npx\\7ce4565c73d8cd04\\node_modules\\xdl\\binaries\\windows\\adb\\adb.exe"
SERIAL = "10BD9M0C6L0005H"
PACKAGE = "com.madrasatussalikat.lilbanat"

def run(args, timeout=20):
    cmd = [ADB, "-s", SERIAL] + args
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                       text=True, timeout=timeout, encoding="utf-8", errors="replace")
    return r.returncode, r.stdout, r.stderr

def adb_shell(cmd_str, timeout=20):
    return run(["shell", cmd_str], timeout=timeout)

print("=" * 50)
print("DEVICE STATE DIAGNOSTIC")
print("=" * 50)

print("\n--- Screen / Wake State ---")
_, po, _ = adb_shell("dumpsys power | grep -E 'mWakefulness|mScreenOn|Display'")
print(po.strip()[:500])

print("\n--- Current Foreground (window) ---")
_, f1, _ = adb_shell("dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp'")
print("windows grep:", f1.strip()[:300])

print("\n--- Current Foreground (activity) ---")
_, f2, _ = adb_shell("dumpsys activity activities | grep -E 'mResumedActivity|mFocusedActivity|Resumed'")
print("activity grep:", f2.strip()[:400])

print("\n--- Activity Top ---")
_, f3, _ = adb_shell("dumpsys activity top | head -5")
print("activity top:", f3.strip()[:300])

print("\n--- Keyboard State (Android 15 compatible) ---")
_, k1, _ = adb_shell("dumpsys input_method | grep -E 'mInputShown|mIsInputViewShown|mHasSurface|mWindowVisible|shown'")
print("IME grep:", k1.strip()[:600])

print("\n--- Window IME ---")
_, k2, _ = adb_shell("dumpsys window | grep -i 'InputMethod'")
print("window IME:", k2.strip()[:300])

print("\n--- uiautomator dump (compressed) ---")
adb_shell("rm -f /sdcard/qa_diag.xml")
time.sleep(0.3)
_, ua, ua_err = adb_shell("uiautomator dump --compressed /sdcard/qa_diag.xml", timeout=30)
print("dump output:", ua.strip(), ua_err.strip())

# Try screencap to confirm screen is on
print("\n--- Screenshot for visual confirmation ---")
adb_shell("screencap /sdcard/diag_screen.png", timeout=15)
run(["pull", "/sdcard/diag_screen.png", "qa/artifacts/screenshots/diag_screen.png"], timeout=30)
import os
if os.path.exists("qa/artifacts/screenshots/diag_screen.png"):
    sz = os.path.getsize("qa/artifacts/screenshots/diag_screen.png")
    print(f"Screenshot captured: {sz//1024} KB")
else:
    print("Screenshot not captured")

print("\n--- Lock Screen Check ---")
_, lock, _ = adb_shell("dumpsys window | grep -E 'mDreamingLockscreen|isKeyguardShowingAndNotOccluded|KeyguardStateMonitor'")
print("lock:", lock.strip()[:300])

print("\n--- Wake and unlock ---")
print("Sending KEYEVENT_WAKEUP...")
adb_shell("input keyevent KEYEVENT_WAKEUP")
time.sleep(0.5)
adb_shell("input keyevent 82")  # menu = unlock
time.sleep(0.5)
adb_shell("input swipe 540 1600 540 800")  # swipe up to unlock
time.sleep(1.5)

_, f4, _ = adb_shell("dumpsys activity activities | grep -E 'mResumedActivity|Resumed'")
print("After wake — activity:", f4.strip()[:300])
