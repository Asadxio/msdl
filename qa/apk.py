import os
import re
from qa.adb import ADBHelper
from qa.utils import logger

class APKAnalyzer:
    def __init__(self, adb: ADBHelper, apk_path: str):
        self.adb = adb
        self.apk_path = apk_path

    def analyze_metadata(self) -> dict:
        """Analyzes APK file size and name characteristics from the local filesystem."""
        meta = {
            "file_name": os.path.basename(self.apk_path),
            "file_size_mb": round(os.path.getsize(self.apk_path) / (1024 * 1024), 2) if os.path.exists(self.apk_path) else 0,
            "min_sdk": "Unknown",
            "target_sdk": "Unknown",
            "version_name": "Unknown",
            "version_code": "Unknown",
            "package_name": "com.mslb.app",  # Default baseline package
            "permissions": [],
            "activities": [],
            "services": []
        }
        return meta

    def query_installed_package_info(self, package: str) -> dict:
        """Queries the device's package manager via adb shell dumpsys for verified package information."""
        info = {
            "version_name": "Unknown",
            "version_code": "Unknown",
            "min_sdk": "Unknown",
            "target_sdk": "Unknown",
            "permissions": [],
            "activities": [],
            "services": []
        }

        code, stdout, _ = self.adb.shell(f"dumpsys package {package}")
        if code != 0 or not stdout.strip():
            logger.warning(f"Could not retrieve dumpsys info for package: {package}")
            return info

        # Parse Version Code and Name
        version_code_match = re.search(r"versionCode=(\d+)", stdout)
        if version_code_match:
            info["version_code"] = version_code_match.group(1)

        version_name_match = re.search(r"versionName=([^\s]+)", stdout)
        if version_name_match:
            info["version_name"] = version_name_match.group(1)

        # Parse SDK Targets
        min_sdk_match = re.search(r"minSdk=(\d+)", stdout)
        if min_sdk_match:
            info["min_sdk"] = min_sdk_match.group(1)

        target_sdk_match = re.search(r"targetSdk=(\d+)", stdout)
        if target_sdk_match:
            info["target_sdk"] = target_sdk_match.group(1)

        # Parse requested permissions
        permissions = re.findall(r"android\.permission\.[A-Z_]+", stdout)
        if permissions:
            info["permissions"] = sorted(list(set(permissions)))

        # Parse activities
        # Dumpsys reports declared activities under the Activity Resolver Table
        activities = re.findall(r"([a-zA-Z0-9._]+/[a-zA-Z0-9._$]+)", stdout)
        for act in activities:
            if package in act and ".MainActivity" in act or "Activity" in act:
                info["activities"].append(act)
        info["activities"] = sorted(list(set(info["activities"])))

        return info
