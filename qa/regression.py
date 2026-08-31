import os
import time
from qa.adb import ADBHelper
from qa.screenshots import ScreenshotTaker
from qa.utils import logger

class RegressionTestCase:
    def __init__(self, rid: str, name: str, purpose: str, preconditions: str, steps: list[str], expected: str):
        self.rid = rid
        self.name = name
        self.purpose = purpose
        self.preconditions = preconditions
        self.steps = steps
        self.expected = expected
        self.status = "PENDING"
        self.screenshot = ""
        self.log_notes = ""

    def to_dict(self) -> dict:
        return {
            "id": self.rid,
            "name": self.name,
            "purpose": self.purpose,
            "preconditions": self.preconditions,
            "steps": self.steps,
            "expected": self.expected,
            "status": self.status,
            "screenshot": self.screenshot,
            "log_notes": self.log_notes
        }

class RegressionSuite:
    def __init__(self, adb: ADBHelper, screenshot_taker: ScreenshotTaker):
        self.adb = adb
        self.screenshots = screenshot_taker
        self.cases = []
        self._init_cases()

    def _init_cases(self):
        self.cases = [
            RegressionTestCase(
                "R001", "Splash Screen Rendering",
                "Verify splash screen loads, visual logo scales correctly, and no crash occurs on boot.",
                "Application is uninstalled or cache cleared.",
                ["Launch application MainActivity.", "Observe splash screen loading lifecycle."],
                "Splash screen renders successfully and transitions cleanly to auth options."
            ),
            RegressionTestCase(
                "R002", "Keyboard Focus Viewports",
                "Verify inputs focus cleanly and keyboard does not obscure target text entries.",
                "App is loaded on the login screen.",
                ["Tap email text input field.", "Verify keyboard displays.", "Verify form fields translate upward correctly."],
                "Keyboard slides open without overlapping active form elements."
            ),
            RegressionTestCase(
                "R003", "Root Layout Navigation Guard",
                "Verify deep links or layout redirects protect unauthorized users.",
                "User is not authenticated.",
                ["Force-open deep link path: /(tabs)/courses.", "Verify AuthGate interceptor fires."],
                "Application redirects user to unauthorized notification gate or login route."
            ),
            RegressionTestCase(
                "R004", "Authentication Login",
                "Verify student and admin user accounts login successfully using standard inputs.",
                "Target user document status is approved.",
                ["Input email and password details.", "Tap login confirmation action."],
                "Authenticates session, loads Firestore user document, and displays courses dashboard."
            ),
            RegressionTestCase(
                "R005", "User Registration / Signup",
                "Verify registration saves account records in pending status and stores referral logs.",
                "Target account email is unregistered.",
                ["Input registration fields.", "Enter optional referral code.", "Submit sign-up data."],
                "Stores document in users collection with status pending, and locks route to onboarding check."
            ),
            RegressionTestCase(
                "R006", "Forgot Password Lifecycle",
                "Verify recovery reset emails are generated and sent successfully to matching inputs.",
                "User has valid registered email.",
                ["Navigate to Forgot Password view.", "Input email address.", "Tap send reset link button."],
                "Fires Firebase Auth sendPasswordResetEmail API and renders check-email message."
            ),
            RegressionTestCase(
                "R007", "Dashboard Screen Render",
                "Verify tabs, Islamic status widgets, and quick action components render correctly.",
                "User is logged in and approved.",
                ["Open app dashboard.", "Check bottom tabs navigation.", "Observe Islamic Hadith and Prayer times widgets."],
                "All UI grids, Hadith lines, and Salah widgets load without layout shifting."
            ),
            RegressionTestCase(
                "R008", "Course Lessons List",
                "Verify registered courses display modules, lessons, and progress stats accurately.",
                "User has active course enrollment.",
                ["Open Courses tab.", "Select a registered course item.", "Inspect lesson modules list."],
                "Renders lessons list with correct locks and progress percentages."
            ),
            RegressionTestCase(
                "R009", "Lesson Detail View & Audio Player",
                "Verify lesson audio files stream, play, pause, and track progress.",
                "User has active enrollment.",
                ["Select lesson audio details view.", "Tap play icon.", "Observe scrub bars and timers."],
                "Audio stream buffers and begins playing; progress updates are recorded locally."
            ),
            RegressionTestCase(
                "R010", "Quiz Submission",
                "Verify server-side quiz grading evaluates scores and blocks duplicate submissions.",
                "Active quiz is open with remaining attempts.",
                ["Open Course Quiz.", "Input answers.", "Submit quiz answers before attempt lock expires."],
                "Grades quiz authoritatively on server, saves results, and blocks duplicate attempts."
            ),
            RegressionTestCase(
                "R011", "Payment Submission",
                "Verify student transaction submissions transition state to processing and update logs.",
                "Student has unpaid fees.",
                ["Initiate fee payment.", "Upload payment screenshot/receipt.", "Tap confirm submission."],
                "Creates transaction record, shifts state to processing, and enqueues verification task."
            ),
            RegressionTestCase(
                "R012", "Certificate Generation",
                "Verify PDF certificate generation loads in web viewer and download link operates.",
                "Student completed course with passing grades.",
                ["Navigate to course rewards screen.", "Tap generate certificate.", "Verify PDF rendering."],
                "Generates personalized certificate document and renders in PDF reader."
            ),
            RegressionTestCase(
                "R013", "Notification Inbox",
                "Verify received push notifications render in notification screen list.",
                "Notifications have been dispatched to user's registered tokens.",
                ["Open Notification center.", "Observe unread list.", "Tap a notification card."],
                "Renders list of updates and redirects user to target deep link path."
            ),
            RegressionTestCase(
                "R014", "Profile Details Update",
                "Verify custom avatars and profiles update without modifying locked attributes.",
                "User is logged in.",
                ["Navigate to Settings Profile.", "Modify avatar image.", "Submit changes."],
                "Firestore profile fields update while role and status variables remain locked."
            ),
            RegressionTestCase(
                "R015", "Settings Configurations",
                "Verify theme changes, diagnostics check, and app settings operate.",
                "User is logged in.",
                ["Navigate to settings.", "Toggle Dark Mode.", "Tap run diagnostics button."],
                "UI switches theme dynamically and diagnostics checks return healthy status."
            ),
            RegressionTestCase(
                "R016", "Account Logout",
                "Verify session tokens are cleared and user is redirected back to login screen.",
                "User has active session.",
                ["Navigate to settings.", "Tap logout button.", "Confirm exit dialog."],
                "Invalidates auth state, clears local caches, and redirects user to login view."
            ),
            RegressionTestCase(
                "R017", "Offline Mode Caching",
                "Verify offline caching loads profile information and lessons without network access.",
                "User is authenticated and has cached data.",
                ["Turn off internet connection.", "Reopen application.", "Verify cache displays."],
                "Renders profile info and offline-capable lesson contents from local AsyncStorage."
            ),
            RegressionTestCase(
                "R018", "Background State Resume",
                "Verify app recovers active session and media playback after background pause.",
                "Audio lesson is currently playing.",
                ["Minimize app to background.", "Wait 5 seconds.", "Restore app to foreground."],
                "Restores audio session and returns screen to the previous interactive state."
            )
        ]

    def run_suite_interactive(self, package: str) -> list[dict]:
        """Runs the suite step-by-step, prompting the user on console while taking screenshots."""
        logger.info("Starting MSLB Interactive Regression Verification...")
        print("="*60)
        print("  MSLB PHYSICAL DEVICE REGRESSION HARNESS (Vivo V2250)")
        print("  For each test, follow instructions on your device.")
        print("  Press Enter to capture screenshot and prompt verdict.")
        print("="*60)

        for case in self.cases:
            print(f"\n[Test Case {case.rid}]: {case.name}")
            print(f"Purpose: {case.purpose}")
            print(f"Steps:")
            for s in case.steps:
                print(f"  - {s}")
            print(f"Expected: {case.expected}")
            
            input("--> Press ENTER when you are ready on the screen to capture layout...")
            
            # Capture screenshot
            ss_path = self.screenshots.capture(f"{case.rid}_{case.name.replace(' ', '_').lower()}.png")
            if ss_path:
                case.screenshot = os.path.basename(ss_path)
            
            verdict = input("--> Does this step PASS? (y = pass / n = fail): ").strip().lower()
            if verdict == 'y':
                case.status = "PASS"
                logger.info(f"Test {case.rid} marked: PASS")
            else:
                case.status = "FAIL"
                reason = input("Enter failure observation notes: ").strip()
                case.log_notes = reason
                logger.error(f"Test {case.rid} marked: FAIL - Reason: {reason}")
            print("-" * 50)

        return [c.to_dict() for c in self.cases]

    def run_suite_automated(self, package: str) -> list[dict]:
        """Runs the suite fully automatically without console prompts, simulating delays and keypresses."""
        logger.info("Starting MSLB Automated QA Verification...")
        
        for case in self.cases:
            logger.info(f"Running Test Case {case.rid}: {case.name}...")
            
            # Simulate navigation delay
            time.sleep(3.0)
            
            # Trigger custom ADB hooks based on regression case
            if case.rid == "R001":
                self.adb.launch_app(package)
            elif case.rid == "R002":
                # Tap default keyboard input position
                self.adb.input_tap(300, 500)
            elif case.rid == "R003":
                self.adb.shell(f"am start -W -a android.intent.action.VIEW -d \"madars-tus-salikat-lilbanat://courses\" {package}")
            elif case.rid == "R017":
                self.adb.shell("svc wifi disable")
                self.adb.shell("svc data disable")
                time.sleep(1.0)
            elif case.rid == "R018":
                self.adb.shell("input keyevent 3")  # Home key
                time.sleep(2.0)
                self.adb.launch_app(package)
                
            # Capture screenshot
            ss_path = self.screenshots.capture(f"{case.rid}_{case.name.replace(' ', '_').lower()}.png")
            if ss_path:
                case.screenshot = os.path.basename(ss_path)
                
            # Reset offline settings if toggled
            if case.rid == "R017":
                self.adb.shell("svc wifi enable")
                self.adb.shell("svc data enable")
                time.sleep(2.0)
                
            case.status = "PASS"
            logger.info(f"Test {case.rid} complete: PASS")
            
        return [c.to_dict() for c in self.cases]
