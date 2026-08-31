import os, sys, re
from pathlib import Path

BASE = Path("C:/Users/xioas/.gemini/antigravity/scratch/msdl")

print("=== SEARCHING FOR RAILWAY DOMAIN OCCURRENCES ===")
railway_domain = "msdl-production-9afb.up.railway.app"
occurrences = []

for p in BASE.glob("**/*"):
    if p.is_file() and not any(x in str(p) for x in [".git", "node_modules", "android/app/build", "artifacts", "brain", "__pycache__"]):
        try:
            txt = p.read_text(encoding="utf-8", errors="ignore")
            if railway_domain in txt:
                cnt = txt.count(railway_domain)
                occurrences.append((p.relative_to(BASE), cnt))
        except: pass

print(f"Found {len(occurrences)} files containing '{railway_domain}':")
for path, count in occurrences:
    print(f"  - {path} ({count} occurrence{'s' if count>1 else ''})")

print("\n=== UPDATING FRONTEND/.ENV TO RENDER PRODUCTION URL ===")
env_file = BASE / "frontend" / ".env"
if env_file.exists():
    orig_env = env_file.read_text(encoding="utf-8")
    new_env = orig_env.replace(
        "https://msdl-production-9afb.up.railway.app/api",
        "https://msdl-backend.onrender.com/api"
    ).replace(
        "https://msdl-production-9afb.up.railway.app",
        "https://msdl-backend.onrender.com"
    )
    env_file.write_text(new_env, encoding="utf-8")
    print("✓ Updated frontend/.env:")
    print(new_env)
