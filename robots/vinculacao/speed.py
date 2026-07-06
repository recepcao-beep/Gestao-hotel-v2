import os
import time


_ORIGINAL_SLEEP = time.sleep
_CONFIGURED = False


def _float_env(name: str, default: str) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return float(default)


def configure_fast_sleep() -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return

    factor = max(0.05, _float_env("ROBOT_SLEEP_FACTOR", "0.45"))
    max_seconds = max(0.25, _float_env("ROBOT_SLEEP_MAX_SECONDS", "5"))

    def fast_sleep(seconds: float) -> None:
        if seconds <= 0:
            return
        _ORIGINAL_SLEEP(min(seconds * factor, max_seconds))

    time.sleep = fast_sleep
    _CONFIGURED = True
