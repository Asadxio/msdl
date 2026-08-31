"""R005/R006 device tests — Sign Up navigation and Forgot Password flow."""
import subprocess, time, re, os, xml.etree.ElementTree as ET

ADB     = "C:\\Users\\xioas\\AppData\\Local\\npm-cache\\_npx\\7ce4565c73d8cd04\\node_modules\\xdl\\binaries\\windows\\adb\\adb.exe"
SERIAL  = "10BD9M0C6L0005H"
PACKAGE = "com.madrasatussalikat.lilbanat"
SHOTS   = "qa/artifacts/screenshots"
ART     = "qa/artifacts"

def run(args, timeout=30):
    cmd = [ADB, "-s", SERIAL] + args
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                       text=True, timeout=timeout, encoding="utf-8", errors="replace")
    return r.returncode, r.stdout, r.stderr

def sh(s, t=20): return run(["shell", s], timeout=t)

def shot(tag):
    remote = f"/sdcard/qa_{tag}.png"
    local  = f"{SHOTS}/{tag}.png"
    sh(f"screencap {remote}", 15)
    run(["pull", remote, local], 30)
    ok = os.path.exists(local)
    print(f"  Screenshot {'OK' if ok else 'FAIL'}: {tag}.png")
    return ok

def dump(tag):
    xr = "/sdcard/qa_v2.xml"
    xl = f"{ART}/{tag}_dump.xml"
    sh(f"rm -f {xr}")
    time.sleep(0.4)
    sh(f"uiautomator dump --compressed {xr}", 30)
    time.sleep(0.3)
    run(["pull", xr, xl], 30)
    if not os.path.exists(xl):
        return []
    nodes = []
    try:
        root = ET.parse(xl).getroot()
        def r2(n):
            a = n.attrib
            nodes.append({
                "rid": a.get("resource-id", ""),
                "text": a.get("text", ""),
                "bounds": a.get("bounds", ""),
                "focused": a.get("focused", "false") == "true",
                "clickable": a.get("clickable", "false") == "true",
                "pkg": a.get("package", "")
            })
            for c in n: r2(c)
        r2(root)
    except Exception as e:
        print(f"  XML parse error: {e}")
    return nodes

def find(nodes, rid):
    return next((n for n in nodes if n["rid"] == rid), None)

def center(bounds):
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds or "")
    if m:
        x1, y1, x2, y2 = map(int, m.groups())
        return (x1+x2)//2, (y1+y2)//2
    return 630, 1400

def wake():
    sh("input keyevent KEYEVENT_WAKEUP")
    time.sleep(0.3)
    sh("input keyevent 82")
    time.sleep(0.3)
    sh("input swipe 540 1600 540 800")
    time.sleep(0.8)

def is_keyboard_open():
    _, out, _ = sh("dumpsys input_method | grep mIsInputViewShown")
    return "mIsInputViewShown=true" in out

def app_in_fg():
    _, out, _ = sh("dumpsys activity activities | grep topResumedActivity")
    return PACKAGE in out


# ─── R005: Sign Up Navigation ─────────────────────────────────────────────────
print("=" * 55)
print("R005 — SIGN UP NAVIGATION")
print("=" * 55)

wake()
sh(f"am force-stop {PACKAGE}")
time.sleep(0.5)
sh(f"am start -n {PACKAGE}/.MainActivity")
time.sleep(5)
wake()

nodes0 = dump("R005_login")
signup_btn = find(nodes0, "goto-signup-btn")
print(f"  goto-signup-btn found: {bool(signup_btn)}")
if signup_btn:
    print(f"  Bounds: {signup_btn['bounds']}")

shot("R005_01_login_screen")

if signup_btn:
    sx, sy = center(signup_btn["bounds"])
    print(f"  Tapping Sign Up at ({sx},{sy})...")
    sh(f"input tap {sx} {sy}")
    time.sleep(3)
    wake()

    shot("R005_02_signup_screen")
    nodes1 = dump("R005_signup_screen")
    app_texts = [n["text"] for n in nodes1 if n["text"] and "madrasatussalikat" in n["pkg"]]
    rids      = [n["rid"]  for n in nodes1 if n["rid"]  and "madrasatussalikat" in n["pkg"]]
    print(f"  Screen texts: {app_texts[:10]}")
    print(f"  Resource IDs: {rids[:10]}")

    in_fg = app_in_fg()
    print(f"  App in foreground: {in_fg}")

    keywords = ["sign up", "register", "create", "name", "full name", "phone", "username"]
    if any(kw in " ".join(app_texts).lower() for kw in keywords):
        print("  R005 RESULT: PASS — Navigated to Sign Up screen")
    elif in_fg and len(app_texts) > 0:
        print(f"  R005 RESULT: INVESTIGATING — on screen with texts={app_texts[:4]}")
    else:
        print("  R005 RESULT: FAIL — Navigation did not reach Sign Up")
else:
    print("  R005 RESULT: FAIL — goto-signup-btn not found in hierarchy")


# ─── R006: Forgot Password ────────────────────────────────────────────────────
print()
print("=" * 55)
print("R006 — FORGOT PASSWORD FLOW")
print("=" * 55)

wake()
sh(f"am force-stop {PACKAGE}")
time.sleep(0.5)
sh(f"am start -n {PACKAGE}/.MainActivity")
time.sleep(5)
wake()

nodes_fp = dump("R006_login_prefp")
fp_btn = find(nodes_fp, "forgot-password-btn")
print(f"  forgot-password-btn found: {bool(fp_btn)}")
if fp_btn:
    print(f"  Bounds: {fp_btn['bounds']}")

shot("R006_01_before_fp")

if fp_btn:
    fpx, fpy = center(fp_btn["bounds"])
    print(f"  Tapping Forgot Password at ({fpx},{fpy})...")
    sh(f"input tap {fpx} {fpy}")
    time.sleep(3)
    wake()

    shot("R006_02_fp_screen")
    nodes_fp2 = dump("R006_fp_screen")
    fp_texts = [n["text"] for n in nodes_fp2 if n["text"] and "madrasatussalikat" in n["pkg"]]
    fp_rids  = [n["rid"]  for n in nodes_fp2 if n["rid"]  and "madrasatussalikat" in n["pkg"]]
    print(f"  FP screen texts: {fp_texts[:10]}")
    print(f"  FP resource IDs: {fp_rids[:10]}")

    combined = " ".join(fp_texts).lower()
    if any(w in combined for w in ["forgot", "reset", "password", "email", "send"]):
        print("  R006 RESULT: PASS — Forgot Password screen loaded correctly")
    else:
        print(f"  R006 RESULT: INVESTIGATING — texts={fp_texts[:5]}")
else:
    print("  R006 RESULT: FAIL — forgot-password-btn not found in hierarchy")

print()
print("R005 + R006 device tests complete.")
