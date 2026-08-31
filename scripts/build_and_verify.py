import subprocess, sys, os, hashlib
from pathlib import Path

BASE = Path("C:/Users/xioas/.gemini/antigravity/scratch/msdl")
FRONTEND = BASE / "frontend"
ANDROID = FRONTEND / "android"

print("=== PHASE 10: TYPESCRIPT VALIDATION & LOCAL APK BUILD ===")

# 1. TypeScript Check
print("\nRunning npx tsc --noEmit...")
try:
    r = subprocess.run([r"C:\Program Files\nodejs\npx.cmd", "tsc", "--noEmit"], cwd=str(FRONTEND), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=60)
    print("TypeScript Output:", r.stdout.strip() or "<clean>")
    print("TypeScript Exit Code:", r.returncode)
except Exception as e:
    print("TypeScript Error:", e)

# 2. Build local release APK via Gradle
print("\nRunning local Gradle incremental assembleRelease bundleRelease...")
env = os.environ.copy()
env["JAVA_HOME"] = r"C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
env["ANDROID_HOME"] = r"C:\Android\Sdk"
env["PATH"] = f"{env['JAVA_HOME']}\\bin;{env['ANDROID_HOME']}\\platform-tools;{env['PATH']}"

gradlew = ANDROID / "gradlew.bat"
if gradlew.exists():
    try:
        r = subprocess.run([str(gradlew), "assembleRelease", "bundleRelease"], cwd=str(ANDROID), env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=300)
        print("Gradle Exit Code:", r.returncode)
        if r.returncode != 0:
            print("Gradle Stdout:", r.stdout[-1000:])
            print("Gradle Stderr:", r.stderr[-1000:])
    except Exception as e:
        print("Gradle Execution Error:", e)

# 3. Verify Generated APK artifact
apk_file = ANDROID / "app" / "build" / "outputs" / "apk" / "release" / "app-release.apk"
if apk_file.exists():
    sha256 = hashlib.sha256(apk_file.read_bytes()).hexdigest()
    size_mb = apk_file.stat().st_size / (1024 * 1024)
    print(f"\n✓ Generated app-release.apk:")
    print(f"  Path: {apk_file}")
    print(f"  Size: {size_mb:.2f} MB ({apk_file.stat().st_size} bytes)")
    print(f"  SHA256: {sha256}")
else:
    print("\n⚠ app-release.apk not found after build")
