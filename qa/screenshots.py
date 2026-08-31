import os
import time
from qa.adb import ADBHelper
from qa.config import SCREENSHOTS_DIR
from qa.utils import logger

class ScreenshotTaker:
    def __init__(self, adb: ADBHelper):
        self.adb = adb

    def capture(self, filename: str) -> str:
        """Captures a screenshot on the device, pulls it to host, and returns the local path."""
        safe_name = "".join(c for c in filename if c.isalnum() or c in ("-", "_", ".")).strip()
        if not safe_name.endswith(".png"):
            safe_name += ".png"

        remote_path = f"/sdcard/qa_{int(time.time())}.png"
        local_path = os.path.join(SCREENSHOTS_DIR, safe_name)

        logger.info(f"Triggering screencap to {remote_path}...")
        code, _, _ = self.adb.shell(f"screencap -p {remote_path}")
        if code != 0:
            logger.error("Failed to capture screenshot on device.")
            return ""

        logger.info(f"Pulling screenshot to host: {local_path}...")
        pull_success = self.adb.pull_file(remote_path, local_path)
        
        # Clean remote file
        self.adb.shell(f"rm {remote_path}")

        if not pull_success:
            logger.error("Failed to pull screenshot file from device.")
            return ""

        return local_path
