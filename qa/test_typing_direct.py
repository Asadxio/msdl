import subprocess, time

ADB = r"C:\Android\Sdk\platform-tools\adb.exe"
SERIAL = "10BD9M0C6L0005H"
PACKAGE = "com.madrasatussalikat.lilbanat"

def sh(cmd):
    return subprocess.check_output([ADB, "-s", SERIAL] + cmd, text=True, errors="replace").strip()

def main():
    print("Launching app...")
    sh(["shell", "am", "force-stop", PACKAGE])
    time.sleep(0.5)
    sh(["shell", "am", "start", "-n", f"{PACKAGE}/.MainActivity"])
    time.sleep(12)

    print("Tapping email field at center (674, 1265)...")
    sh(["shell", "input", "tap", "674", "1265"])
    time.sleep(1.5)

    print("Sending text via single keyevents / shell input...")
    # Send key events character by character or wrapped shell input
    for ch in "testuser":
        sh(["shell", "input", "text", ch])
        time.sleep(0.05)

    time.sleep(1)

    print("Dumping UI to inspect value...")
    sh(["shell", "uiautomator", "dump", "--compressed", "/sdcard/test.xml"])
    subprocess.run([ADB, "-s", SERIAL, "pull", "/sdcard/test.xml", "qa/test.xml"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    import xml.etree.ElementTree as ET
    root = ET.parse("qa/test.xml").getroot()
    for n in root.iter("node"):
        if n.attrib.get("resource-id") == "login-email-input":
            print("login-email-input text:", repr(n.attrib.get("text")))
            print("login-email-input focused:", n.attrib.get("focused"))

if __name__ == "__main__":
    main()
