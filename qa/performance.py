import re
import json
import os
from qa.adb import ADBHelper
from qa.config import ARTIFACTS_DIR
from qa.utils import logger

class PerformanceCollector:
    def __init__(self, adb: ADBHelper):
        self.adb = adb
        self.memory_history = []
        self.cpu_history = []

    def collect_memory(self, package: str) -> dict:
        """Collects memory usage stats (PSS Total, Private Dirty, Heap Alloc) for the target package."""
        stats = {
            "pss_total_kb": 0,
            "private_dirty_kb": 0,
            "heap_alloc_kb": 0
        }
        code, stdout, _ = self.adb.shell(f"dumpsys meminfo {package}")
        if code != 0 or not stdout.strip() or "No process found" in stdout:
            return stats

        # Extract PSS Total
        pss_match = re.search(r"TOTAL\s+(\d+)", stdout)
        if pss_match:
            stats["pss_total_kb"] = int(pss_match.group(1))

        # Extract Native/Dalvik Private Dirty
        dirty_match = re.search(r"TOTAL\s+PSS\s+Total.*Private\s+Dirty\s+(\d+)", stdout, re.IGNORECASE)
        # Fallback regex pattern mapping structure
        if not dirty_match:
            dirty_match = re.search(r"TOTAL\s*:\s*\d+\s*(\d+)", stdout)
        
        # Simple fallback parsing lines directly
        for line in stdout.splitlines():
            if "TOTAL" in line and not line.strip().startswith("TOTAL PSS"):
                parts = line.split()
                if len(parts) >= 3:
                    try:
                        stats["pss_total_kb"] = int(parts[1])
                        stats["private_dirty_kb"] = int(parts[2])
                    except ValueError:
                        pass
            if "Native Heap" in line:
                parts = line.split()
                if len(parts) >= 8:
                    try:
                        stats["heap_alloc_kb"] = int(parts[7])
                    except (ValueError, IndexError):
                        pass

        self.memory_history.append(stats)
        return stats

    def collect_cpu(self, package: str) -> float:
        """Queries CPU usage percentage for the target package using top command."""
        code, stdout, _ = self.adb.shell("top -n 1 -b")
        if code != 0 or not stdout.strip():
            return 0.0

        for line in stdout.splitlines():
            if package in line:
                parts = line.split()
                # Top command headers differ, commonly column 8 or 9 on modern Android is CPU%
                # E.g. PID USER PR NI CPU% S #THR VSS RSS PCY Name
                # Let's search for the first percentage or decimal float pattern
                for part in parts:
                    if "." in part and part.replace(".", "").isdigit():
                        val = float(part)
                        if val < 100.0:  # Sanity boundary check
                            self.cpu_history.append(val)
                            return val
        return 0.0

    def collect_battery(self) -> dict:
        """Queries the device battery status and level metrics."""
        metrics = {
            "level": "Unknown",
            "temperature_c": "Unknown",
            "status": "Unknown"
        }
        code, stdout, _ = self.adb.shell("dumpsys battery")
        if code != 0:
            return metrics

        for line in stdout.splitlines():
            if "level:" in line:
                metrics["level"] = line.split(":")[-1].strip()
            elif "temperature:" in line:
                try:
                    raw_temp = int(line.split(":")[-1].strip())
                    metrics["temperature_c"] = raw_temp / 10.0  # Decicelsius to Celsius conversion
                except ValueError:
                    pass
            elif "status:" in line:
                status_val = line.split(":")[-1].strip()
                status_map = {"1": "Unknown", "2": "Charging", "3": "Discharging", "4": "Not Charging", "5": "Full"}
                metrics["status"] = status_map.get(status_val, status_val)
        return metrics

    def export_performance_logs(self):
        """Saves current session memory and CPU metrics to local JSON artifacts."""
        with open(os.path.join(ARTIFACTS_DIR, "memory.json"), "w") as f:
            json.dump(self.memory_history, f, indent=2)
        with open(os.path.join(ARTIFACTS_DIR, "performance.json"), "w") as f:
            json.dump(self.cpu_history, f, indent=2)
        logger.info("Performance stats JSON files generated successfully.")
