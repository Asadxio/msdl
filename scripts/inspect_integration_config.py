import os, re
from pathlib import Path

BASE = Path("C:/Users/xioas/.gemini/antigravity/scratch/msdl")

print("=== 1. ENV & CONFIG INSPECTION ===")
for env_file in BASE.glob("**/.env*"):
    if "node_modules" not in str(env_file):
        print(f"\n--- {env_file} ---")
        try:
            print(env_file.read_text(encoding="utf-8"))
        except Exception as e:
            print("Error reading:", e)

print("\n=== 2. QUIZ ROUTES & SERVICES ===")
for p in (BASE / "frontend").glob("**/*quiz*"):
    if "node_modules" not in str(p):
        print("  Quiz File:", p.relative_to(BASE))

print("\n=== 3. PAYMENT ROUTES & SERVICES ===")
for p in (BASE / "frontend").glob("**/*payment*"):
    if "node_modules" not in str(p):
        print("  Payment File:", p.relative_to(BASE))

print("\n=== 4. NOTIFICATION / FCM ROUTES & SERVICES ===")
for p in (BASE / "frontend").glob("**/*notif*"):
    if "node_modules" not in str(p):
        print("  Notif File:", p.relative_to(BASE))
