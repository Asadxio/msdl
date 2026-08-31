import json
import os
import datetime
from qa.config import ARTIFACTS_DIR, SCREENSHOTS_DIR
from qa.utils import logger

class ReportGenerator:
    def __init__(self, device_info: dict, apk_info: dict):
        self.device_info = device_info
        self.apk_info = apk_info
        self.timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def generate_json_report(self, cases: list[dict], findings: dict, perf_data: dict) -> str:
        """Saves execution findings as a structured JSON artifact."""
        report = {
            "timestamp": self.timestamp,
            "device": self.device_info,
            "apk": self.apk_info,
            "test_cases": cases,
            "logcat_findings": findings,
            "performance": perf_data
        }
        filepath = os.path.join(ARTIFACTS_DIR, "report.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        logger.info(f"JSON report saved: {filepath}")
        return filepath

    def generate_markdown_summary(self, cases: list[dict], findings: dict) -> str:
        """Generates a summary markdown report suitable for release verification logs."""
        passed_count = sum(1 for c in cases if c["status"] == "PASS")
        total_count = len(cases)
        verdict = "🟢 RELEASE APPROVED" if passed_count == total_count and not findings.get("crashes") and not findings.get("anrs") else "🔴 RELEASE REJECTED"

        md = f"""# MSLB QA Verification Summary
**Timestamp**: {self.timestamp}
**Device**: {self.device_info.get('manufacturer')} {self.device_info.get('model')} (Android {self.device_info.get('release_version')}, SDK {self.device_info.get('sdk_version')})
**APK File**: {self.apk_info.get('file_name')} ({self.apk_info.get('file_size_mb')} MB)
**Package/Version**: {self.apk_info.get('package_name')} v{self.apk_info.get('version_name')} (code {self.apk_info.get('version_code')})

---

## Final Verdict: {verdict}

### Test Execution Summary
- **Total Test Cases**: {total_count}
- **Passed**: {passed_count}
- **Failed**: {total_count - passed_count}
- **Telemetry Crashes Detected**: {len(findings.get('crashes', []))}
- **Telemetry ANRs Detected**: {len(findings.get('anrs', []))}
- **React Native RedBoxes**: {len(findings.get('redboxes', []))}

---

## Logcat Telemetry Issues
- **Crashes**: {len(findings.get('crashes', []))}
- **ANRs**: {len(findings.get('anrs', []))}
- **RedBoxes**: {len(findings.get('redboxes', []))}
- **Unhandled Promises**: {len(findings.get('unhandled_promises', []))}
- **Native Exceptions**: {len(findings.get('native_exceptions', []))}

---

## Detailed Test Matrix
"""
        for c in cases:
            badge = "🟢 PASS" if c["status"] == "PASS" else "🔴 FAIL"
            md += f"- **[{c['id']}] {c['name']}**: {badge}\n"
            if c["log_notes"]:
                md += f"  - *Notes*: {c['log_notes']}\n"
            if c["screenshot"]:
                md += f"  - *Screenshot*: `screenshots/{c['screenshot']}`\n"

        filepath = os.path.join(ARTIFACTS_DIR, "summary.md")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(md)
        logger.info(f"Markdown summary saved: {filepath}")
        return filepath

    def generate_html_report(self, cases: list[dict], findings: dict, perf_data: dict) -> str:
        """Generates a responsive HTML dashboard displaying execution status and screenshots."""
        passed_count = sum(1 for c in cases if c["status"] == "PASS")
        total_count = len(cases)
        verdict_text = "RELEASE APPROVED" if passed_count == total_count and not findings.get("crashes") and not findings.get("anrs") else "RELEASE REJECTED"
        verdict_class = "verdict-pass" if "APPROVED" in verdict_text else "verdict-fail"

        test_rows = ""
        for c in cases:
            status_class = "status-pass" if c["status"] == "PASS" else "status-fail"
            screenshot_elem = ""
            if c["screenshot"]:
                # Relative link mapping for standalone directory distribution
                screenshot_elem = f'<a href="screenshots/{c["screenshot"]}" target="_blank"><img src="screenshots/{c["screenshot"]}" class="table-img" /></a>'
            notes = c["log_notes"] if c["log_notes"] else "No observations recorded."
            test_rows += f"""
            <tr>
                <td><strong>{c["id"]}</strong></td>
                <td>{c["name"]}</td>
                <td>{c["purpose"]}</td>
                <td><span class="badge {status_class}">{c["status"]}</span></td>
                <td>{screenshot_elem}</td>
                <td>{notes}</td>
            </tr>
            """

        crash_rows = ""
        for issue_type, issues in findings.items():
            for issue in issues:
                crash_rows += f"""
                <tr>
                    <td><span class="badge status-fail">{issue_type.upper()}</span></td>
                    <td><pre>{issue}</pre></td>
                </tr>
                """
        if not crash_rows:
            crash_rows = "<tr><td colspan='2' class='text-center'>🟢 No telemetry exceptions detected in Logcat.</td></tr>"

        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>MSLB QA Automation Report</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <style>
        body {{
            font-family: 'Inter', sans-serif;
            background-color: #F3F4F6;
            margin: 0;
            padding: 24px;
            color: #1F2937;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        .header {{
            background: linear-gradient(135deg, #0F7660 0%, #10B981 100%);
            color: #ffffff;
            padding: 32px;
            border-radius: 16px;
            margin-bottom: 24px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }}
        .header h1 {{ margin: 0; font-size: 28px; font-weight: 800; }}
        .header p {{ margin: 8px 0 0 0; opacity: 0.9; }}
        
        .verdict-banner {{
            padding: 20px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 20px;
            text-align: center;
            margin-bottom: 24px;
        }}
        .verdict-pass {{ background-color: #D1FAE5; color: #065F46; border: 2px solid #34D399; }}
        .verdict-fail {{ background-color: #FEE2E2; color: #991B1B; border: 2px solid #F87171; }}

        .grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 24px;
        }}
        .card {{
            background: #ffffff;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        .card h2 {{ margin-top: 0; font-size: 18px; font-weight: 700; border-bottom: 2px solid #E5E7EB; padding-bottom: 12px; }}
        .meta-list {{ list-style: none; padding: 0; margin: 0; }}
        .meta-list li {{ padding: 8px 0; border-bottom: 1px solid #F3F4F6; display: flex; justify-content: space-between; }}
        .meta-list li:last-child {{ border-bottom: none; }}
        .meta-list span {{ font-weight: 600; color: #111827; }}

        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
        }}
        th, td {{
            text-align: left;
            padding: 12px 16px;
            border-bottom: 1px solid #E5E7EB;
        }}
        th {{ background-color: #F9FAFB; font-weight: 600; color: #374151; }}
        
        .badge {{
            display: inline-block;
            padding: 4px 8px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 600;
        }}
        .status-pass {{ background-color: #D1FAE5; color: #065F46; }}
        .status-fail {{ background-color: #FEE2E2; color: #991B1B; }}
        
        .table-img {{
            max-width: 80px;
            height: auto;
            border-radius: 6px;
            border: 1px solid #D1D5DB;
            transition: transform 0.2s;
            cursor: pointer;
        }}
        .table-img:hover {{ transform: scale(1.5); }}
        
        pre {{
            background: #F9FAFB;
            padding: 12px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            overflow-x: auto;
            white-space: pre-wrap;
            color: #B91C1C;
        }}
        .text-center {{ text-align: center; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>MSLB Physical Device QA Report</h1>
            <p>Execution Timestamp: {self.timestamp}</p>
        </div>

        <div class="verdict-banner {verdict_class}">
            VERDICT: {verdict_text}
        </div>

        <div class="grid">
            <div class="card">
                <h2>Target Device Profile</h2>
                <ul class="meta-list">
                    <li>Manufacturer: <span>{self.device_info.get("manufacturer")}</span></li>
                    <li>Model: <span>{self.device_info.get("model")}</span></li>
                    <li>Android Release: <span>{self.device_info.get("release_version")} (SDK {self.device_info.get("sdk_version")})</span></li>
                    <li>CPU ABI: <span>{self.device_info.get("abi")}</span></li>
                    <li>Resolution: <span>{self.device_info.get("width")}x{self.device_info.get("height")}</span></li>
                    <li>Density: <span>{self.device_info.get("density")} dpi</span></li>
                </ul>
            </div>

            <div class="card">
                <h2>Staging APK Profile</h2>
                <ul class="meta-list">
                    <li>Package Name: <span>{self.apk_info.get("package_name")}</span></li>
                    <li>Version Name: <span>{self.apk_info.get("version_name")}</span></li>
                    <li>Version Code: <span>{self.apk_info.get("version_code")}</span></li>
                    <li>Min SDK Target: <span>{self.apk_info.get("min_sdk")}</span></li>
                    <li>Target SDK Level: <span>{self.apk_info.get("target_sdk")}</span></li>
                    <li>APK File Size: <span>{self.apk_info.get("file_size_mb")} MB</span></li>
                </ul>
            </div>
        </div>

        <div class="card" style="margin-bottom: 24px;">
            <h2>Execution Results ({passed_count} / {total_count} Passed)</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Regression Case</th>
                        <th>Verification Target</th>
                        <th>Verdict</th>
                        <th>Screenshot</th>
                        <th>Observation Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {test_rows}
                </tbody>
            </table>
        </div>

        <div class="card">
            <h2>Logcat Telemetry Exceptions</h2>
            <table>
                <thead>
                    <tr>
                        <th style="width: 150px;">Classification</th>
                        <th>Log Snippet</th>
                    </tr>
                </thead>
                <tbody>
                    {crash_rows}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>
        """
        filepath = os.path.join(ARTIFACTS_DIR, "report.html")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html_content)
        logger.info(f"HTML report saved: {filepath}")
        return filepath
