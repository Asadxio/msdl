import subprocess, time, re, sys

ADB     = r"C:\Android\Sdk\platform-tools\adb.exe"
SERIAL  = "10BD9M0C6L0005H"
PACKAGE = "com.madrasatussalikat.lilbanat"

def sh(cmd):
    return subprocess.check_output([ADB, "-s", SERIAL] + cmd, text=True, errors="replace").strip()

def wake():
    sh(["shell", "input", "keyevent", "KEYEVENT_WAKEUP"]); time.sleep(0.2)
    sh(["shell", "input", "keyevent", "82"]);             time.sleep(0.2)
    sh(["shell", "input", "swipe", "540", "1600", "540", "800"]); time.sleep(0.4)

def parse_am_start(out):
    this_t  = re.search(r"ThisTime:\s*(\d+)", out)
    total_t = re.search(r"TotalTime:\s*(\d+)", out)
    wait_t  = re.search(r"WaitTime:\s*(\d+)", out)
    return {
        "this_time": int(this_t.group(1)) if this_t else 0,
        "total_time": int(total_t.group(1)) if total_t else 0,
        "wait_time": int(wait_t.group(1)) if wait_t else 0
    }

def main():
    print("="*65)
    print("GATE 4 — ADB LAUNCH PERFORMANCE BENCHMARK (5x COLD, 5x WARM)")
    print("Device: Vivo Y36 (Android 15) | Serial: " + SERIAL)
    print("="*65)

    cold_results = []
    print("\n--- 5 COLD LAUNCHES ---")
    for i in range(1, 6):
        sh(["shell", "am", "force-stop", PACKAGE])
        time.sleep(2)
        wake()
        out = sh(["shell", "am", "start", "-W", f"{PACKAGE}/.MainActivity"])
        parsed = parse_am_start(out)
        cold_results.append(parsed)
        print(f"Cold Run #{i}: TotalTime={parsed['total_time']}ms | ThisTime={parsed['this_time']}ms | WaitTime={parsed['wait_time']}ms")

    warm_results = []
    print("\n--- 5 WARM LAUNCHES ---")
    for i in range(1, 6):
        sh(["shell", "input", "keyevent", "3"]) # Press Home
        time.sleep(2)
        wake()
        out = sh(["shell", "am", "start", "-W", f"{PACKAGE}/.MainActivity"])
        parsed = parse_am_start(out)
        warm_results.append(parsed)
        print(f"Warm Run #{i}: TotalTime={parsed['total_time']}ms | ThisTime={parsed['this_time']}ms | WaitTime={parsed['wait_time']}ms")

    cold_totals = [r["total_time"] for r in cold_results if r["total_time"] > 0]
    warm_totals = [r["total_time"] for r in warm_results if r["total_time"] > 0]

    avg_cold = sum(cold_totals) / len(cold_totals) if cold_totals else 0
    min_cold = min(cold_totals) if cold_totals else 0
    max_cold = max(cold_totals) if cold_totals else 0

    avg_warm = sum(warm_totals) / len(warm_totals) if warm_totals else 0
    min_warm = min(warm_totals) if warm_totals else 0
    max_warm = max(warm_totals) if warm_totals else 0

    print("\n" + "="*65)
    print(f"COLD BOOT TIMINGS (5 Runs): Min={min_cold}ms | Max={max_cold}ms | Avg={avg_cold:.1f}ms")
    print(f"WARM BOOT TIMINGS (5 Runs): Min={min_warm}ms | Max={max_warm}ms | Avg={avg_warm:.1f}ms")
    print("="*65)

if __name__ == "__main__":
    main()
