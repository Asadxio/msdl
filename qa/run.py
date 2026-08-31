import os
import sys
import time

# Add parent workspace root to python search path
workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if workspace_root not in sys.path:
    sys.path.insert(0, workspace_root)

from qa.config import PACKAGE_NAME
from qa.utils import logger
from qa.adb import ADBHelper
from qa.device import DeviceProfile
from qa.apk import APKAnalyzer
from qa.logcat import LogcatMonitor
from qa.screenshots import ScreenshotTaker
from qa.performance import PerformanceCollector
from qa.regression import RegressionSuite
from qa.reports import ReportGenerator

def print_help():
    print("MSLB QA Automation Framework Runner")
    print("Usage:")
    print("  python qa/run.py <path-to-apk>")
    print("\nMake sure your reference Vivo V2250 device is connected and authorized via ADB.")

def main():
    if len(sys.argv) < 2:
        print_help()
        sys.exit(1)

    apk_path = sys.argv[1]
    if not os.path.exists(apk_path):
        logger.error(f"Provided APK path does not exist: {apk_path}")
        sys.exit(1)

    # Initialize modules
    adb = ADBHelper()
    
    logger.info("Starting Phase 0: Verification Check...")
    if not adb.is_device_connected():
        logger.error(f"Reference device (serial {adb.serial}) is offline or unauthorized. Execution aborted.")
        sys.exit(1)

    logger.info("Device connected and authorized. Reading hardware profile...")
    device_prof = DeviceProfile(adb)
    device_info = device_prof.get_profile()
    logger.info(f"Target Hardware Profile: {device_info.get('manufacturer')} {device_info.get('model')} (Android {device_info.get('release_version')})")

    # APK Analysis
    logger.info("Starting Phase 1: Local APK File Analysis...")
    apk_analyzer = APKAnalyzer(adb, apk_path)
    apk_meta = apk_analyzer.analyze_metadata()
    logger.info(f"Local APK loaded: {apk_meta.get('file_name')} ({apk_meta.get('file_size_mb')} MB)")

    # Install APK
    logger.info("Starting Phase 2: Installing APK on physical target...")
    # Clean previous
    adb.uninstall_package(PACKAGE_NAME)
    # Fresh Install
    if not adb.install_apk(apk_path):
        logger.error("APK installation failed. Execution aborted.")
        sys.exit(1)

    logger.info("Installation complete. Querying package registry metadata from device...")
    installed_info = apk_analyzer.query_installed_package_info(PACKAGE_NAME)
    apk_meta.update(installed_info)
    logger.info(f"Target Registry: version={apk_meta.get('version_name')}, code={apk_meta.get('version_code')}")

    # Prepare logs and performance collectors
    log_monitor = LogcatMonitor(adb)
    perf = PerformanceCollector(adb)
    screenshots = ScreenshotTaker(adb)

    # Clean app data for a fresh start
    adb.clear_app_data(PACKAGE_NAME)

    # Start telemetry monitoring
    logger.info("Starting Phase 3: Commencing background Logcat and performance recording...")
    log_monitor.start()
    
    # Collect baseline metrics
    battery_baseline = perf.collect_battery()
    mem_baseline = perf.collect_memory(PACKAGE_NAME)
    logger.info(f"Baseline Stats: Battery Level={battery_baseline.get('level')}%, Memory Total PSS={mem_baseline.get('pss_total_kb')} KB")

    # Launch application
    logger.info("Starting Phase 4: Launching MainActivity...")
    start_time = time.time()
    adb.launch_app(PACKAGE_NAME)
    # Collect warm startup latency estimate
    launch_latency_ms = int((time.time() - start_time) * 1000)
    logger.info(f"Activity launch command dispatched. Delay: {launch_latency_ms} ms")

    # Wait for React Native bundle compile and initial splash
    time.sleep(3.0)

    # Run tests
    logger.info("Starting Phase 5: Executing Verification Regression Suite...")
    suite = RegressionSuite(adb, screenshots)
    
    # Run test matrix step-by-step
    results = suite.run_suite_automated(PACKAGE_NAME)

    # Post-execution profiling
    logger.info("Starting Phase 6: Collecting post-execution performance metrics...")
    mem_post = perf.collect_memory(PACKAGE_NAME)
    perf.collect_cpu(PACKAGE_NAME)
    battery_post = perf.collect_battery()
    
    logger.info(f"Post-run Stats: Memory Total PSS={mem_post.get('pss_total_kb')} KB, Battery Drop={int(battery_baseline.get('level', 0)) - int(battery_post.get('level', 0))}%")

    # Stop logs
    log_monitor.stop()
    adb.force_stop_app(PACKAGE_NAME)

    # Export performance files
    perf.export_performance_logs()

    # Analyze logs
    logger.info("Phase 6.5: Analyzing Logcat file for exceptions...")
    log_findings = log_monitor.analyze_logs(PACKAGE_NAME)
    logger.info(f"Exceptions found: crashes={len(log_findings.get('crashes'))}, ANRs={len(log_findings.get('anrs'))}, RedBoxes={len(log_findings.get('redboxes'))}")

    # Generate Reports
    logger.info("Starting Phase 7: Generating Verification Artifacts...")
    generator = ReportGenerator(device_info, apk_meta)
    
    json_path = generator.generate_json_report(results, log_findings, {
        "launch_latency_ms": launch_latency_ms,
        "memory_history": perf.memory_history,
        "cpu_history": perf.cpu_history,
        "battery_baseline": battery_baseline,
        "battery_post": battery_post
    })
    md_path = generator.generate_markdown_summary(results, log_findings)
    html_path = generator.generate_html_report(results, log_findings, {})

    print("\n" + "="*60)
    print("  VERIFICATION CYCLE COMPLETE")
    print(f"  HTML Dashboard:  {html_path}")
    print(f"  Markdown Summary: {md_path}")
    print(f"  JSON Logs:        {json_path}")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
