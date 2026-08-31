import os, json
from pathlib import Path

BASE = Path("C:/Users/xioas/.gemini/antigravity/scratch/msdl")

print("=== 1. SEARCHING FOR QUIZ BACKEND & FIXTURES ===")
for p in (BASE / "backend").glob("**/*quiz*"):
    print("  Backend Quiz File:", p.relative_to(BASE))
for p in (BASE / "backend").glob("**/*course*"):
    print("  Backend Course File:", p.relative_to(BASE))

print("\n=== 2. SEARCHING FOR RAZORPAY BACKEND ROUTES & KEYS ===")
for p in (BASE / "backend").glob("**/*pay*"):
    print("  Backend Payment File:", p.relative_to(BASE))

print("\n=== 3. SEARCHING FOR FCM / NOTIFICATION BACKEND ROUTES ===")
for p in (BASE / "backend").glob("**/*notif*"):
    print("  Backend Notif File:", p.relative_to(BASE))
for p in (BASE / "backend").glob("**/*push*"):
    print("  Backend Push File:", p.relative_to(BASE))

print("\n=== 4. INSPECTING BACKEND PACKAGE.JSON & BACKEND ROUTE FILES ===")
pkg = BASE / "backend" / "package.json"
if pkg.exists():
    print(pkg.read_text(encoding="utf-8"))

app_js = BASE / "backend" / "src" / "index.js"
if not app_js.exists():
    app_js = BASE / "backend" / "server.js"
if not app_js.exists():
    app_js = BASE / "backend" / "src" / "app.js"

if app_js.exists():
    print(f"\n--- {app_js.relative_to(BASE)} ---")
    print(app_js.read_text(encoding="utf-8")[:1500])
