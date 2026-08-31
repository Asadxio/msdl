import os, subprocess, shutil

print("=== CHECKING FOR NODE/NPM/GIT/RAILWAY IN SYSTEM PATHS ===")

tools = ["git", "node", "npm", "npx", "railway", "python", "curl"]
for t in tools:
    path = shutil.which(t)
    print(f"Tool '{t}': {path if path else 'NOT FOUND'}")

print("\n=== CHECKING COMMON NODE INSTALLATION PATHS ===")
common_paths = [
    r"C:\Program Files\nodejs",
    r"C:\Program Files (x86)\nodejs",
    os.path.expanduser(r"~\AppData\Roaming\npm"),
    os.path.expanduser(r"~\AppData\Local\Programs"),
]
for p in common_paths:
    if os.path.exists(p):
        print(f"  Found dir: {p}")
        for item in os.listdir(p)[:10]:
            print(f"    - {item}")
