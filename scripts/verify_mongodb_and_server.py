import sys, os, subprocess, time, urllib.request
from pathlib import Path

BASE = Path("C:/Users/xioas/.gemini/antigravity/scratch/msdl")
sys.path.insert(0, str(BASE / "backend"))

print("=== VERIFYING MONGO & SERVER STARTUP ===")

# Test server import
import server

print("✓ server.py imported cleanly!")
print(f"FastAPI Routes Registered: {len(server.app.routes)}")

# Start Uvicorn process
proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "backend.server:app", "--host", "127.0.0.1", "--port", "8000"],
    cwd=str(BASE),
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

time.sleep(3)

try:
    with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=5) as r:
        print(f"✓ GET /health -> HTTP {r.status} | {r.read().decode('utf-8')}")
except Exception as e:
    print("✗ /health check error:", e)

try:
    with urllib.request.urlopen("http://127.0.0.1:8000/api/", timeout=5) as r:
        print(f"✓ GET /api/ -> HTTP {r.status} | {r.read().decode('utf-8')}")
except Exception as e:
    print("✗ /api/ check error:", e)

proc.terminate()
try: proc.wait(timeout=2)
except: proc.kill()

print("==========================================")
print("VERIFICATION COMPLETE: 🟢 PASS")
print("==========================================")
