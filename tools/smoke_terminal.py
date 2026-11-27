"""Exercise the interactive entry points with a fixed terminal and random seed."""

from contextlib import redirect_stdout
from io import StringIO
import os
from pathlib import Path
import random
import runpy
from unittest.mock import patch

scripts = Path(__file__).resolve().parents[1] / "cortex-boot-sequence"
for part, marker in [
    ("intro", "Cortex online."),
    ("startup", "LLM NEURAL PATHWAYS ACTIVATING"),
    ("outro", "TERMINATING CONNECTION"),
]:
    script = scripts / f"cortex_{part}_animation.py"
    random.seed(7)
    output = StringIO()
    with (
        redirect_stdout(output),
        patch("time.sleep"),
        patch("os.system", return_value=0),
        patch("os.get_terminal_size", return_value=os.terminal_size((80, 24))),
        patch("sys.stdin", StringIO("\n")),
    ):
        runpy.run_path(str(script), run_name="__main__")
    if marker not in output.getvalue():
        raise RuntimeError(f"{script.name} did not reach {marker!r}")
    print(f"PASS {script.name}")
