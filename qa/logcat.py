import os
import subprocess
import time
from qa.adb import ADBHelper
from qa.config import ARTIFACTS_DIR
from qa.utils import logger

class LogcatMonitor:
    def __init__(self, adb: ADBHelper):
        self.adb = adb
        self.log_filepath = os.path.join(ARTIFACTS_DIR, "logcat.txt")
        self.process = None

    def start(self):
        """Clears the buffer and starts streaming logcat to a local text file in the background."""
        logger.info("Initializing Logcat recording...")
        self.adb.run_adb(["logcat", "-c"])  # Clear buffer
        time.sleep(0.5)

        # Run logcat in background subprocess redirection
        cmd = [self.adb.adb_path]
        if self.adb.serial:
            cmd.extend(["-s", self.adb.serial])
        cmd.extend(["logcat", "*:V"])

        self.log_file = open(self.log_filepath, "w", encoding="utf-8", errors="replace")
        self.process = subprocess.Popen(
            cmd,
            stdout=self.log_file,
            stderr=subprocess.PIPE
        )
        logger.info(f"Logcat background thread active. Log path: {self.log_filepath}")

    def stop(self):
        """Stops the background logcat stream process."""
        if self.process:
            logger.info("Terminating Logcat background listener...")
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            self.log_file.close()
            self.process = None

    def analyze_logs(self, package: str) -> dict:
        """Parses the logcat file and extracts error events (crashes, ANRs, RedBoxes)."""
        findings = {
            "crashes": [],
            "anrs": [],
            "redboxes": [],
            "unhandled_promises": [],
            "native_exceptions": [],
            "firebase_failures": []
        }

        if not os.path.exists(self.log_filepath):
            return findings

        with open(self.log_filepath, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        lines = content.splitlines()
        for idx, line in enumerate(lines):
            # Parse ANRs
            if "ANR in" in line or "ActivityManager: ANR" in line:
                findings["anrs"].append(f"Line {idx+1}: {line.strip()}")

            # Parse Fatal Exceptions
            if "FATAL EXCEPTION" in line or "AndroidRuntime: FATAL" in line:
                # Capture the matching line and the next 5 stacktrace lines for detail
                context = "\n".join(lines[idx:idx+8])
                findings["crashes"].append(f"Line {idx+1}:\n{context}")

            # Parse React Native RedBox Errors
            if "RCTFatal" in line or "ReactAndroid: RCTFatal" in line or "RedBox" in line:
                findings["redboxes"].append(f"Line {idx+1}: {line.strip()}")

            # Parse Unhandled Promise Rejections
            if "Unhandled Promise Rejection" in line or "unhandled promise rejection" in line.lower():
                findings["unhandled_promises"].append(f"Line {idx+1}: {line.strip()}")

            # Parse Native Exceptions
            if "backtrace:" in line or "native crash" in line.lower():
                findings["native_exceptions"].append(f"Line {idx+1}: {line.strip()}")

            # Parse Firebase Failures
            if "FirebaseInstanceId" in line or "GoogleServiceFailed" in line or "FirebaseAuth" in line:
                if "error" in line.lower() or "fail" in line.lower():
                    findings["firebase_failures"].append(f"Line {idx+1}: {line.strip()}")

        # Deduplicate
        for k in findings.keys():
            findings[k] = list(dict.fromkeys(findings[k]))

        return findings
