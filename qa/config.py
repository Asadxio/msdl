import os

# Target configuration defaults
PACKAGE_NAME = "com.madrasatussalikat.lilbanat"
DEVICE_SERIAL = "10BD9M0C6L0005H"

# ADB executable resolution
DEFAULT_ADB_PATH = r"C:\Users\xioas\AppData\Local\npm-cache\_npx\7ce4565c73d8cd04\node_modules\xdl\binaries\windows\adb\adb.exe"

# Workspace folders
QA_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS_DIR = os.path.join(QA_DIR, "artifacts")
SCREENSHOTS_DIR = os.path.join(ARTIFACTS_DIR, "screenshots")

# Create required directories on load
for d in (ARTIFACTS_DIR, SCREENSHOTS_DIR):
    os.makedirs(d, exist_ok=True)
