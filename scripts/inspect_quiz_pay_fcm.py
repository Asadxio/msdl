from pathlib import Path

BASE = Path("C:/Users/xioas/.gemini/antigravity/scratch/msdl/frontend")

def read_file(p, max_lines=100):
    try:
        lines = p.read_text(encoding="utf-8").splitlines()
        print(f"\n==========================================")
        print(f"File: {p.relative_to(BASE)}")
        print(f"Total Lines: {len(lines)}")
        print("==========================================")
        for i, l in enumerate(lines[:max_lines], 1):
            print(f"{i:3d}: {l}")
    except Exception as e:
        print(f"Error reading {p}: {e}")

read_file(BASE / "app" / "(tabs)" / "quiz.tsx", 120)
read_file(BASE / "app" / "payment.tsx", 120)
read_file(BASE / "lib" / "pushNotifications.ts", 120)
