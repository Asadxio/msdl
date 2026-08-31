import os
from pathlib import Path

BASE = Path("C:/Users/xioas/.gemini/antigravity/scratch/msdl/backend")

print("=== 1. SEARCHING FOR BACKEND ENTRYPOINTS ===")
for p in BASE.glob("*.py"):
    print("  File:", p.name)

server_py = BASE / "server.py"
if server_py.exists():
    print(f"\n--- {server_py.relative_to(BASE)} ---")
    lines = server_py.read_text(encoding="utf-8").splitlines()
    for i, l in enumerate(lines[:80], 1):
        print(f"{i:3d}: {l}")

req_txt = BASE / "requirements.txt"
if req_txt.exists():
    print(f"\n--- requirements.txt ---")
    print(req_txt.read_text(encoding="utf-8"))
