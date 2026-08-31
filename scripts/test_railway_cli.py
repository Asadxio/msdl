import subprocess, sys, os

npx_cmd = r"C:\Program Files\nodejs\npx.cmd"

def run_railway(args):
    cmd = [npx_cmd, "-y", "railway"] + args
    print(f"\n$ {' '.join(cmd)}")
    try:
        r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=30)
        print("STDOUT:", r.stdout.strip() or "<empty>")
        print("STDERR:", r.stderr.strip() or "<empty>")
        print("EXIT CODE:", r.returncode)
        return r.stdout.strip()
    except Exception as e:
        print("ERROR:", e)
        return ""

print("=== TESTING RAILWAY CLI ACCESS ===")
run_railway(["whoami"])
run_railway(["status"])
run_railway(["list"])
