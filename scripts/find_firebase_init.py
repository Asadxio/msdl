from pathlib import Path

server_py = Path("C:/Users/xioas/.gemini/antigravity/scratch/msdl/backend/server.py")
lines = server_py.read_text(encoding="utf-8").splitlines()
for i, l in enumerate(lines, 1):
    if "initialize_app" in l or "firebase" in l.lower():
        print(f"{i:4d}: {l}")
