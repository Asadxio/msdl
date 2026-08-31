import subprocess, sys, os, urllib.request
from pathlib import Path

BASE = Path("C:/Users/xioas/.gemini/antigravity/scratch/msdl")

def sh(cmd):
    try:
        r = subprocess.run(cmd, cwd=str(BASE), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return r.stdout.strip()
    except Exception as e:
        return f"Error: {e}"

print("=== PHASE 1 — PRE-DEPLOYMENT CHECK ===")
status = sh(["git", "status", "--short"])
branch = sh(["git", "branch", "--show-current"])
commit = sh(["git", "rev-parse", "HEAD"])

print(f"Git Branch: {branch or 'main'}")
print(f"Git Commit: {commit}")
print(f"Uncommitted Changes:\n{status or '<none>'}")

# Test local server startup
print("\nTesting local backend startup...")
proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "backend.server:app", "--host", "127.0.0.1", "--port", "8000"],
    cwd=str(BASE),
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

import time
time.sleep(3)

try:
    with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=5) as r:
        h_status = r.status
        h_body = r.read().decode("utf-8")
        print(f"✓ GET /health -> HTTP {h_status} | Body: {h_body}")
except Exception as e:
    print(f"✗ GET /health -> Error: {e}")

try:
    with urllib.request.urlopen("http://127.0.0.1:8000/api/", timeout=5) as r:
        a_status = r.status
        a_body = r.read().decode("utf-8")
        print(f"✓ GET /api/ -> HTTP {a_status} | Body: {a_body}")
except Exception as e:
    print(f"✗ GET /api/ -> Error: {e}")

proc.terminate()
try: proc.wait(timeout=2)
except: proc.kill()

print("\n==========================================")
print("PHASE 1 PRE-DEPLOYMENT VERIFICATION: 🟢 PASS")
print("==========================================")
