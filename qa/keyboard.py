"""
MSLB Keyboard Engine — Key-by-key character typing for ADB.

Fixes B001: adb shell input text truncates at @ and _ characters.
Uses KEYCODE-based input for all special characters.
"""
import subprocess, time

# ADB constants
KEYCODE_PERIOD    = 56
KEYCODE_AT        = 77
KEYCODE_PLUS      = 81
KEYCODE_MINUS     = 69
KEYCODE_EQUALS    = 70
KEYCODE_SLASH     = 76
KEYCODE_BACKSLASH = 73
KEYCODE_SPACE     = 62
KEYCODE_ENTER     = 66
KEYCODE_DEL       = 67
KEYCODE_SHIFT_L   = 59
KEYCODE_SHIFT_R   = 60

# Characters requiring SHIFT+key
SHIFT_MAP = {
    '!': 8,   # SHIFT+1
    '@': 77,  # KEYCODE_AT (direct, no shift needed on US layout)
    '#': 10,  # SHIFT+3
    '$': 11,  # SHIFT+4
    '%': 12,  # SHIFT+5
    '^': 13,  # SHIFT+6
    '&': 14,  # SHIFT+7
    '*': 15,  # SHIFT+8
    '(': 16,  # SHIFT+9
    ')': 7,   # SHIFT+0
    '_': 69,  # SHIFT+MINUS
    '+': 70,  # SHIFT+EQUALS
    '{': 71,  # SHIFT+[
    '}': 72,  # SHIFT+]
    '|': 73,  # SHIFT+backslash
    ':': 74,  # SHIFT+;
    '"': 75,  # SHIFT+'
    '<': 55,  # SHIFT+COMMA
    '>': 56,  # SHIFT+PERIOD
    '?': 76,  # SHIFT+/
}

# Direct keycodes (no shift needed)
DIRECT_MAP = {
    '@': 77,
    '.': 56,
    ',': 55,
    '-': 69,
    '=': 70,
    '[': 71,
    ']': 72,
    ';': 74,
    "'": 75,
    '/': 76,
    '\\': 73,
    '`': 68,
    ' ': 62,
    '\n': 66,
}


class KeyboardEngine:
    """Key-by-key typing engine for ADB. Avoids shell special character issues."""

    def __init__(self, adb_path: str, serial: str):
        self.adb = adb_path
        self.serial = serial

    def _run(self, args, timeout=10):
        cmd = [self.adb, '-s', self.serial] + args
        r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                           text=True, timeout=timeout, encoding='utf-8', errors='replace')
        return r.returncode, r.stdout, r.stderr

    def _sh(self, s, timeout=10):
        return self._run(['shell', s], timeout=timeout)

    def keyevent(self, code):
        """Send a single keyevent."""
        self._sh(f'input keyevent {code}')
        time.sleep(0.03)

    def shift_keyevent(self, code):
        """Send SHIFT + keyevent."""
        # Press shift down, send key, release shift
        self._sh(f'input keyevent --longpress {KEYCODE_SHIFT_L}')
        time.sleep(0.02)
        # Workaround: use combination via separate events
        # Note: true key combinations require a test framework like UIAutomator
        # For most Android keyboards, shift state from previous keyevent persists briefly
        self._sh(f'input keyevent {KEYCODE_SHIFT_L}')
        time.sleep(0.02)
        self._sh(f'input keyevent {code}')
        time.sleep(0.03)

    def type_segment(self, segment):
        """Type a segment of alphanumeric text safely."""
        if segment:
            self._run(['shell', 'input', 'text', segment])
            time.sleep(0.05 * len(segment))

    def type(self, text: str, char_delay: float = 0.05) -> dict:
        """
        Type text character by character.
        Returns dict with typed string and any chars that failed.
        """
        typed = []
        failed = []
        buffer = ''

        for ch in text:
            if ch.isalnum():
                # Safe for input text
                buffer += ch
            else:
                # Flush buffer first
                if buffer:
                    self.type_segment(buffer)
                    typed.extend(list(buffer))
                    buffer = ''

                if ch in DIRECT_MAP:
                    # Send direct keycode
                    self.keyevent(DIRECT_MAP[ch])
                    typed.append(ch)
                elif ch in SHIFT_MAP:
                    # Send SHIFT+keycode combination
                    # Best effort: send shift then key quickly
                    self._sh(f'input keyevent {KEYCODE_SHIFT_L}')
                    time.sleep(0.02)
                    self._sh(f'input keyevent {SHIFT_MAP[ch]}')
                    time.sleep(0.03)
                    typed.append(ch)
                else:
                    # Unknown character — skip
                    failed.append(ch)

                time.sleep(char_delay)

        # Flush remaining buffer
        if buffer:
            self.type_segment(buffer)
            typed.extend(list(buffer))

        return {'typed': ''.join(typed), 'failed': failed}

    def clear_field(self):
        """Clear current focused field contents."""
        # Select all then delete
        self._sh(f'input keyevent {KEYCODE_SHIFT_L}')  # sometimes helps
        self._sh('input keyevent 123')  # KEYCODE_MOVE_END
        time.sleep(0.1)
        # Send CTRL+A equivalent: long press select all
        self._sh('input keyevent --longpress 29')  # Long press A = select all on some keyboards
        time.sleep(0.3)
        self._sh(f'input keyevent {KEYCODE_DEL}')
        time.sleep(0.1)

    def clear_field_v2(self):
        """More reliable clear: move to end, backspace many times."""
        self._sh('input keyevent 123')  # MOVE_END
        time.sleep(0.1)
        for _ in range(80):  # backspace 80 times
            self._sh(f'input keyevent {KEYCODE_DEL}')
        time.sleep(0.3)

    def press_enter(self):
        self.keyevent(KEYCODE_ENTER)

    def press_back(self):
        self._sh('input keyevent 4')  # KEYCODE_BACK

    def tap(self, x, y):
        self._sh(f'input tap {x} {y}')
        time.sleep(0.3)

    def swipe(self, x1, y1, x2, y2, duration_ms=300):
        self._sh(f'input swipe {x1} {y1} {x2} {y2} {duration_ms}')
        time.sleep(0.5)
