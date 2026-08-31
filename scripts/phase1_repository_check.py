import os, sys, subprocess
from pathlib import Path

BASE = Path("C:/Users/xioas/.gemini/antigravity/scratch/msdl")

print("=== 1. CHECKING DEPLOYMENT CONFIG FILES IN REPOSITORY ===")
for p in [BASE / "Procfile", BASE / "nixpacks.toml", BASE / "railway.toml", BASE / "Dockerfile", BASE / "backend" / "Procfile", BASE / "backend" / "nixpacks.toml"]:
    if p.exists():
        print(f"\n--- {p.relative_to(BASE)} ---")
        print(p.read_text(encoding="utf-8"))
    else:
        print(f"File not present: {p.relative_to(BASE)}")

print("\n=== 2. CHECKING RAILWAY CLI ON SYSTEM ===")
try:
    r = subprocess.run(["railway", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    print("Railway CLI Version:", r.stdout.strip())
except Exception as e:
    print("Railway CLI Check:", e)

print("\n=== 3. CHECKING PYTHON ENVIRONMENT & PACKAGES ===")
print("Python Executable:", sys.executable)
try:
    import uvicorn, fastapi, pydantic, firebase_admin
    print("✓ uvicorn, fastapi, pydantic, firebase_admin imported cleanly!")
except ImportError as e:
    print("Missing package:", e)
