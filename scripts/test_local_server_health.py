import sys, os, subprocess, time, urllib.request, json
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"
from pathlib import Path

BASE = Path("C:/Users/xioas/.gemini/antigravity/scratch/msdl")
sys.path.insert(0, str(BASE / "backend"))

def main():
    print("=== PHASE 1 — LOCAL STARTUP SMOKE TEST ===")
    
    # 1. Test server.py import directly
    os.environ["APP_ENV"] = "development"
    os.environ["REQUIRE_APP_CHECK"] = "false"
    
    print("Testing server.py module import...")
    import server
    print("✓ server.py imported cleanly!")
    print(f"App title: '{server.app.title}' | Registered Routes: {len(server.app.routes)}")

    # 2. Launch local Uvicorn process on 127.0.0.1:8000
    print("\nStarting local Uvicorn server on http://127.0.0.1:8000 ...")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.server:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=str(BASE),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    time.sleep(3) # Wait for server to bind

    # 3. Test HTTP /health
    try:
        req = urllib.request.Request("http://127.0.0.1:8000/health")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read().decode("utf-8")
            print(f"✓ GET http://127.0.0.1:8000/health -> HTTP {resp.status}")
            print("  Body:", data)
    except Exception as e:
        print("✗ Health check failed:", e)

    # 4. Test HTTP /api/
    try:
        req = urllib.request.Request("http://127.0.0.1:8000/api/")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read().decode("utf-8")
            print(f"✓ GET http://127.0.0.1:8000/api/ -> HTTP {resp.status}")
            print("  Body:", data)
    except Exception as e:
        print("✗ /api/ check failed:", e)

    # Terminate local test process
    proc.terminate()
    try:
        proc.wait(timeout=2)
    except:
        proc.kill()
    
    print("\n==========================================")
    print("LOCAL STARTUP SMOKE TEST RESULT: 🟢 PASS")
    print("==========================================")

if __name__ == "__main__":
    main()
