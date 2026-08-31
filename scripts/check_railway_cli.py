import subprocess, sys, os

print("=== CHECKING RAILWAY CLI & SYSTEM PATHS ===")

def run_cmd(cmd):
    print(f"\n$ {' '.join(cmd)}")
    try:
        r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=15)
        print("STDOUT:", r.stdout.strip() or "<empty>")
        print("STDERR:", r.stderr.strip() or "<empty>")
        print("EXIT CODE:", r.returncode)
        return r.returncode == 0
    except Exception as e:
        print("ERROR:", e)
        return False

# 1. Try railway command directly
run_cmd(["railway", "whoami"])

# 2. Try npx railway whoami
run_cmd(["npx", "railway", "whoami"])

# 3. Check environment variables for Railway tokens
print("\n--- Checking Environment for Railway Tokens ---")
railway_token = os.environ.get("RAILWAY_TOKEN")
print("RAILWAY_TOKEN Present:", bool(railway_token))
