from pathlib import Path

BASE = Path("C:/Users/xioas/.gemini/antigravity/scratch/msdl/backend")

print("=== BACKEND DIRECTORY TREE ===")
for p in sorted(BASE.glob("**/*")):
    if p.is_file() and "__pycache__" not in str(p) and ".git" not in str(p):
        print(p.relative_to(BASE))
