import re
import os
import time
import random
import string
import xml.etree.ElementTree as ET
from qa.adb import ADBHelper
from qa.utils import logger

class UIAutomationHelper:
    def __init__(self, adb: ADBHelper):
        self.adb = adb

    def dump_ui_hierarchy(self, output_filename: str = "window_dump.xml") -> str:
        """Dumps UI hierarchy using uiautomator and pulls it locally."""
        from qa.config import ARTIFACTS_DIR
        local_path = os.path.join(ARTIFACTS_DIR, output_filename)
        
        # Remove old on device
        self.adb.shell("rm -f /sdcard/window_dump.xml")
        
        code, stdout, stderr = self.adb.shell("uiautomator dump /sdcard/window_dump.xml")
        if code != 0 or "dumped" not in stdout:
            logger.warning(f"UI dump failed: {stdout} {stderr}")
            return ""
            
        if self.adb.pull_file("/sdcard/window_dump.xml", local_path):
            return local_path
        return ""

    @staticmethod
    def parse_bounds(bounds_str: str) -> tuple[int, int, int, int]:
        """Parses bounds string '[x1,y1][x2,y2]' to coordinates."""
        match = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds_str)
        if match:
            return tuple(map(int, match.groups()))
        return 0, 0, 0, 0

    def get_center_coord(self, bounds_str: str) -> tuple[int, int]:
        """Calculates center point coordinate of a bounds string."""
        x1, y1, x2, y2 = self.parse_bounds(bounds_str)
        return (x1 + x2) // 2, (y1 + y2) // 2

    def parse_ui_nodes(self, xml_path: str) -> list[dict]:
        """Parses all XML nodes in window_dump returning attribute dict list."""
        if not xml_path or not os.path.exists(xml_path):
            return []
        
        try:
            tree = ET.parse(xml_path)
            root = tree.getroot()
            nodes = []
            
            def recurse(node):
                attribs = node.attrib
                if attribs:
                    nodes.append({
                        "class": attribs.get("class", ""),
                        "text": attribs.get("text", ""),
                        "resource-id": attribs.get("resource-id", ""),
                        "content-desc": attribs.get("content-desc", ""),
                        "bounds": attribs.get("bounds", ""),
                        "focused": attribs.get("focused", "false") == "true",
                        "enabled": attribs.get("enabled", "true") == "true",
                        "clickable": attribs.get("clickable", "false") == "true",
                        "password": attribs.get("password", "false") == "true"
                    })
                for child in node:
                    recurse(child)
            
            recurse(root)
            return nodes
        except Exception as e:
            logger.error(f"Error parsing UI dump XML: {e}")
            return []

    def find_node(self, nodes: list[dict], match_fn) -> dict:
        """Finds the first node matching custom match function."""
        for n in nodes:
            if match_fn(n):
                return n
        return None

    def type_and_verify(self, target_class: str, input_text: str, screenshots_helper, case_id: str) -> tuple[bool, str]:
        """Taps edit field, captures screenshot, types test string, redumps and verifies value."""
        # 1. Dump UI to find coordinate
        xml_path = self.dump_ui_hierarchy("pre_type_dump.xml")
        nodes = self.parse_ui_nodes(xml_path)
        
        # Find matching edit text node
        node = self.find_node(nodes, lambda n: target_class in n["class"] or "EditText" in n["class"])
        if not node:
            return False, "Target TextInput field not found in hierarchy."
            
        cx, cy = self.get_center_coord(node["bounds"])
        
        # 2. Capture screenshot before typing
        pre_ss = screenshots_helper.capture(f"{case_id}_before_typing.png")
        
        # 3. Tap field and type text
        self.adb.input_tap(cx, cy)
        time.sleep(1.0)
        self.adb.input_text(input_text)
        time.sleep(1.0)
        
        # 4. Capture screenshot after typing
        post_ss = screenshots_helper.capture(f"{case_id}_after_typing.png")
        
        # 5. Redump and verify
        xml_path_post = self.dump_ui_hierarchy("post_type_dump.xml")
        nodes_post = self.parse_ui_nodes(xml_path_post)
        
        # Check text in the newly focused or typed input field
        typed_node = self.find_node(nodes_post, lambda n: target_class in n["class"] or "EditText" in n["class"])
        if not typed_node:
            return False, "Target TextInput field disappeared after typing."
            
        current_val = typed_node["text"]
        if current_val != input_text:
            return False, f"Value mismatch: typed '{input_text}', but read back '{current_val}'."
            
        return True, ""

    @staticmethod
    def get_splash_timings(logcat_path: str) -> dict:
        """Extracts Splash screen timing transition log milestones."""
        timings = {
            "process_start": "Unknown",
            "first_frame": "Unknown",
            "splash_hidden": "Unknown",
            "first_interactive": "Unknown"
        }
        if not os.path.exists(logcat_path):
            return timings

        try:
            with open(logcat_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            # Find Process Start
            start_match = re.search(r"(\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}).*Start proc.*com\.madrasatussalikat\.lilbanat", content)
            if start_match:
                timings["process_start"] = start_match.group(1)

            # Find Displayed First Frame
            displayed_match = re.search(r"(\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}).*Displayed com\.madrasatussalikat\.lilbanat", content)
            if displayed_match:
                timings["first_frame"] = displayed_match.group(1)

            # Find Splash Hidden logs (RN splash screen plugin hide event)
            splash_hidden_match = re.search(r"(\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}).*SplashScreen.*hide", content, re.IGNORECASE)
            if splash_hidden_match:
                timings["splash_hidden"] = splash_hidden_match.group(1)

            # First interactive frame (first layout drawn log)
            interactive_match = re.search(r"(\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}).*Choreographer.*Skipped", content)
            if interactive_match:
                timings["first_interactive"] = interactive_match.group(1)

        except Exception as e:
            logger.error(f"Error parsing logcat splash timings: {e}")
            
        return timings
