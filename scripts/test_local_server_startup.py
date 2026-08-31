import sys, os
from pathlib import Path

BASE = Path("C:/Users/xioas/.gemini/antigravity/scratch/msdl/backend")
sys.path.insert(0, str(BASE))

print("=== TESTING LOCAL SERVER.PY IMPORT ===")
os.environ["APP_ENV"] = "development" # Set development mode for local check
os.environ["REQUIRE_APP_CHECK"] = "false"

try:
    import server
    print("SUCCESS: server.py imported cleanly!")
    print("App title:", server.app.title)
    print("Routes registered:", len(server.app.routes))
    for r in server.app.routes[:10]:
        print(" ", getattr(r, "path", str(r)))
except Exception as e:
    print("CRASH during import:", e)
    import traceback
    traceback.print_exc()
