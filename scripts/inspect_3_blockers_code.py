from pathlib import Path

BASE = Path("C:/Users/xioas/.gemini/antigravity/scratch/msdl")

def print_file(p, max_lines=120):
    if not p.exists():
        print(f"File not found: {p}")
        return
    print(f"\n==========================================")
    print(f"FILE: {p.relative_to(BASE)}")
    print(f"==========================================")
    lines = p.read_text(encoding="utf-8").splitlines()
    for i, l in enumerate(lines[:max_lines], 1):
        print(f"{i:3d}: {l}")

print_file(BASE / "backend" / "security" / "quizSecurity.py")
print_file(BASE / "backend" / "scripts" / "seed_quizzes.py")
print_file(BASE / "backend" / "payments" / "webhook_verifier.py")
print_file(BASE / "backend" / "payments" / "payment_finalizer.py")
print_file(BASE / "backend" / "services" / "provider_adapters" / "fcm_adapter.py")
