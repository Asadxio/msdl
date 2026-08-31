import re
from qa.adb import ADBHelper
from qa.utils import logger

class DeviceProfile:
    def __init__(self, adb: ADBHelper):
        self.adb = adb

    def get_profile(self) -> dict:
        """Retrieves and parses the complete hardware capability profile of the device."""
        profile = {
            "manufacturer": "Unknown",
            "model": "Unknown",
            "release_version": "Unknown",
            "sdk_version": "Unknown",
            "abi": "Unknown",
            "width": 0,
            "height": 0,
            "density": 0,
            "storage_total": "Unknown",
            "storage_used": "Unknown",
            "storage_avail": "Unknown",
            "storage_use_percent": "Unknown"
        }

        if not self.adb.is_device_connected():
            logger.error("Device is not connected or unauthorized.")
            return profile

        # Product Properties
        _, stdout, _ = self.adb.shell("getprop ro.product.manufacturer")
        profile["manufacturer"] = stdout.strip()

        _, stdout, _ = self.adb.shell("getprop ro.product.model")
        profile["model"] = stdout.strip()

        _, stdout, _ = self.adb.shell("getprop ro.build.version.release")
        profile["release_version"] = stdout.strip()

        _, stdout, _ = self.adb.shell("getprop ro.build.version.sdk")
        profile["sdk_version"] = stdout.strip()

        _, stdout, _ = self.adb.shell("getprop ro.product.cpu.abi")
        profile["abi"] = stdout.strip()

        # Display Metrics
        _, stdout, _ = self.adb.shell("wm size")
        size_match = re.search(r"Physical size:\s*(\d+)x(\d+)", stdout)
        if size_match:
            profile["width"] = int(size_match.group(1))
            profile["height"] = int(size_match.group(2))

        _, stdout, _ = self.adb.shell("wm density")
        density_match = re.search(r"Physical density:\s*(\d+)", stdout)
        if density_match:
            profile["density"] = int(density_match.group(1))

        # Storage Metrics
        _, stdout, _ = self.adb.shell("df -h /data")
        lines = stdout.splitlines()
        if len(lines) >= 2:
            parts = lines[1].split()
            # If filesystem name is long, the line might split, adjust indexing
            if len(parts) >= 5:
                profile["storage_total"] = parts[1]
                profile["storage_used"] = parts[2]
                profile["storage_avail"] = parts[3]
                profile["storage_use_percent"] = parts[4]
            elif len(parts) >= 4:
                profile["storage_total"] = parts[0]
                profile["storage_used"] = parts[1]
                profile["storage_avail"] = parts[2]
                profile["storage_use_percent"] = parts[3]

        return profile
