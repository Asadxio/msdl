import subprocess, sys

ADB = r"C:\Android\Sdk\platform-tools\adb.exe"
SERIAL = "10BD9M0C6L0005H"

def sh(cmd):
    try:
        res = subprocess.check_output([ADB, "-s", SERIAL] + cmd, text=True, errors="replace").strip()
        return res
    except Exception as e:
        return f"Error: {e}"

def main():
    print("=== DEVICE SPECIFICATIONS ===")
    print("Manufacturer:", sh(["shell", "getprop", "ro.product.manufacturer"]))
    print("Model:       ", sh(["shell", "getprop", "ro.product.model"]))
    print("Android:     ", sh(["shell", "getprop", "ro.build.version.release"]))
    print("SDK:         ", sh(["shell", "getprop", "ro.build.version.sdk"]))
    print("ABI:         ", sh(["shell", "getprop", "ro.product.cpu.abi"]))
    print("Display Size:", sh(["shell", "wm", "size"]))
    print("Density:     ", sh(["shell", "wm", "density"]))
    print("Storage:     ", sh(["shell", "df", "-h", "/data"]).splitlines()[-1] if "Error" not in sh(["shell", "df", "-h", "/data"]) else "N/A")
    mem_raw = sh(["shell", "cat", "/proc/meminfo"])
    if "Error" not in mem_raw:
        mem = [l for l in mem_raw.splitlines() if "MemTotal" in l or "MemFree" in l or "MemAvailable" in l]
        print("Memory:      ", ", ".join(mem))
    else:
        print("Memory:       N/A")

if __name__ == "__main__":
    main()
