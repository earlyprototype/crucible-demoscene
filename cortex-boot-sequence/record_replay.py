"""Capture the three Cortex animations and write a portable HTML player."""

import argparse
from contextlib import redirect_stdout
import io
import json
import os
from pathlib import Path
import random
import re
from types import SimpleNamespace
from unittest.mock import patch

import cortex_intro_animation as intro
import cortex_outro_animation as outro
import cortex_startup_animation as startup


class TerminalCapture(io.StringIO):
    def __init__(self):
        super().__init__()
        self.frames = []

    def clear_screen(self, command):
        if command not in ("clear", "cls"):
            raise ValueError(f"Unexpected terminal command: {command}")
        self.seek(0)
        self.truncate()
        return 0

    def hold(self, seconds):
        # Each cursor-home in these animations repaints the entire framed scene.
        screen = self.getvalue().rsplit("\033[H", 1)[-1]
        # The outro sleeps after each byte, even inside an ANSI color change.
        screen = re.sub(r"\x1b(?:\[[0-9]*)?\Z", "", screen)
        runs = []
        color = 0
        for part in re.split(r"(\x1b\[[0-9]+m)", screen):
            if part.startswith("\033["):
                color = int(part[2:-1])
            elif part:
                runs.append([color, part])

        milliseconds = round(seconds * 1000)
        if self.frames and self.frames[-1]["runs"] == runs:
            self.frames[-1]["ms"] += milliseconds
        elif runs:
            self.frames.append({"ms": milliseconds, "runs": runs})


def capture(name, module, *scenes):
    terminal = TerminalCapture()
    terminal_os = SimpleNamespace(name=os.name, system=terminal.clear_screen,
                                  get_terminal_size=lambda: os.terminal_size((80, 24)))
    # Substitute only the animation module's environment while it runs.
    with (
        redirect_stdout(terminal),
        patch.object(module, "random", random.Random(7)),
        patch.object(module, "os", terminal_os),
        patch.object(module, "time", SimpleNamespace(sleep=terminal.hold)),
    ):
        for scene in scenes:
            scene()
    terminal.hold(0)  # Include text printed after the last sleep.
    if terminal.frames[-1]["ms"] == 0:
        terminal.frames[-1]["ms"] = 1000
    return {"name": name, "frames": terminal.frames}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, nargs="?", default=Path("cortex-replay.html"))
    args = parser.parse_args()
    chapters = [
        capture("Intro", intro, intro.display_intro),
        capture("Startup", startup, startup.display_startup_animation),
        capture("Outro", outro, outro.display_exit_animation, outro.display_exit_art),
    ]
    data = json.dumps(chapters, ensure_ascii=False, separators=(",", ":")).replace("<", r"\u003c")
    template = Path(__file__).with_name("replay.template.html").read_text(encoding="utf-8")
    args.output.write_bytes(template.replace("{{RECORDING}}", data).encode("utf-8"))
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
