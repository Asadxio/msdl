import os
from qa.config import DEFAULT_ADB_PATH, DEVICE_SERIAL
from qa.utils import execute_subprocess, logger

class ADBHelper:
    def __init__(self, adb_path: str = DEFAULT_ADB_PATH, serial: str = DEVICE_SERIAL):
        self.adb_path = adb_path
        self.serial = serial

    def run_adb(self, args: list[str], timeout: int = 120) -> tuple[int, str, str]:
        """Runs an adb command with target serial."""
        cmd = [self.adb_path]
        if self.serial:
            cmd.extend(["-s", self.serial])
        cmd.extend(args)
        return execute_subprocess(cmd, timeout=timeout)

    def shell(self, cmd_str: str, timeout: int = 60) -> tuple[int, str, str]:
        """Runs a command inside the adb shell."""
        return self.run_adb(["shell", cmd_str], timeout=timeout)

    def is_device_connected(self) -> bool:
        """Verifies if the target device is online and authorized."""
        code, stdout, _ = execute_subprocess([self.adb_path, "devices"])
        if code != 0:
            return False
        for line in stdout.splitlines():
            parts = line.strip().split()
            if len(parts) >= 2 and parts[0] == self.serial:
                return parts[1] == "device"
        return False

    def install_apk(self, apk_path: str) -> bool:
        """Installs the APK on the device, replacing existing version if found."""
        if not os.path.exists(apk_path):
            logger.error(f"APK file does not exist: {apk_path}")
            return False
        logger.info(f"Installing APK: {apk_path}")
        code, stdout, stderr = self.run_adb(["install", "-r", "-d", apk_path], timeout=180)
        combined_out = (stdout or "") + "\n" + (stderr or "")
        if code != 0 or "Success" not in combined_out:
            logger.error(f"Installation failed: {stdout} {stderr}")
            return False
        return True

    def uninstall_package(self, package: str) -> bool:
        """Uninstalls the specified package from the device."""
        logger.info(f"Uninstalling package: {package}")
        code, stdout, stderr = self.run_adb(["uninstall", package])
        if code != 0 and "Success" not in stdout:
            # Package might not exist, which is non-fatal
            logger.warning(f"Uninstall check output: {stdout} {stderr}")
            return False
        return True

    def clear_app_data(self, package: str) -> bool:
        """Clears cache and storage data for the package."""
        logger.info(f"Clearing app data for package: {package}")
        code, stdout, stderr = self.shell(f"pm clear {package}")
        return code == 0 and "Success" in stdout

    def force_stop_app(self, package: str) -> bool:
        """Force-stops the package execution state."""
        logger.info(f"Force-stopping package: {package}")
        code, _, _ = self.shell(f"am force-stop {package}")
        return code == 0

    def launch_app(self, package: str, activity: str = "MainActivity") -> bool:
        """Launches the target activity of the application."""
        logger.info(f"Launching app activity: {package}/{activity}")
        # Build component string
        component = f"{package}/{package}.{activity}"
        code, stdout, stderr = self.shell(f"am start -n {component}")
        if code != 0 or "Error" in stdout:
            # Fallback to general launch if main activity path differs
            logger.warning(f"Failed component start, falling back to monkey launch...")
            code, stdout, stderr = self.shell(f"monkey -p {package} -c android.intent.category.LAUNCHER 1")
        return code == 0

    def send_key_event(self, keycode: int) -> bool:
        """Simulates native key input on the device."""
        code, _, _ = self.shell(f"input keyevent {keycode}")
        return code == 0

    def input_text(self, text: str) -> bool:
        """Types the string literal using the virtual keyboard."""
        # Replace whitespace with %s to allow input command parsing
        safe_text = text.replace(" ", "%s")
        code, _, _ = self.shell(f"input text \"{safe_text}\"")
        return code == 0

    def input_tap(self, x: int, y: int) -> bool:
        """Simulates physical touch tap event at coordinate (X, Y)."""
        code, _, _ = self.shell(f"input tap {x} {y}")
        return code == 0

    def pull_file(self, remote_path: str, local_path: str) -> bool:
        """Pulls a file from the device storage to the host machine."""
        code, _, _ = self.run_adb(["pull", remote_path, local_path])
        return code == 0

    def push_file(self, local_path: str, remote_path: str) -> bool:
        """Pushes a file from the host machine to the device storage."""
        code, _, _ = self.run_adb(["push", local_path, remote_path])
        return code == 0
