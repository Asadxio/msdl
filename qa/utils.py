import subprocess
import sys
import logging

# Configure Logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("MSLB_QA")

def execute_subprocess(cmd: list[str], timeout: int = 60) -> tuple[int, str, str]:
    """Runs a subprocess command safely and returns exit code, stdout, and stderr."""
    try:
        res = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace"
        )
        return res.returncode, res.stdout, res.stderr
    except subprocess.TimeoutExpired as exc:
        logger.error(f"Command timed out: {' '.join(cmd)}")
        return -1, "", f"TimeoutExpired: {str(exc)}"
    except Exception as exc:
        logger.error(f"Failed to execute command: {' '.join(cmd)} - {str(exc)}")
        return -2, "", str(exc)
