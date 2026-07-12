import os, re

suspicious_patterns = [
    (r'AIza[0-9A-Za-z-_]{35}', 'Google API Key'),
    (r'rzp_(test|live)_[0-9a-zA-Z]+', 'Razorpay Key'),
    (r'(?:secret|api_key|private_key)\s*=\s*[\"\'][A-Za-z0-9-_]{16,}[\"\']', 'Hardcoded Secret Assignment'),
    (r'password\s*=\s*[\"\'][A-Za-z0-9-_]{6,}[\"\']', 'Hardcoded Password'),
    (r'BYPASS|HACK', 'Bypass/Hack comment'),
]

root_dirs = ['.', '../frontend/lib', '../frontend/app', '../frontend/context']
findings = []

for rdir in root_dirs:
    if not os.path.exists(rdir): continue
    for root, dirs, files in os.walk(rdir):
        if 'venv' in root or 'node_modules' in root or '__pycache__' in root or '.git' in root: continue
        for fname in files:
            if fname.endswith(('.py', '.ts', '.tsx', '.js', '.json', '.env', '.rules')) and not fname.startswith('test_') and fname != 'scratch_security_scan.py':
                fpath = os.path.join(root, fname)
                try:
                    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                        for idx, line in enumerate(f, 1):
                            for pat, label in suspicious_patterns:
                                if re.search(pat, line, re.I):
                                    findings.append((fpath, idx, label, line.strip()))
                except Exception:
                    pass

print(f"Total findings: {len(findings)}")
for fp, idx, lbl, line in findings[:40]:
    print(f"{fp}:{idx} [{lbl}] -> {line[:90]}")
