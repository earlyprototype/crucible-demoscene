"""Offline checks for the capture command and its embedded terminal frames."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


HERE = Path(__file__).resolve().parent


def generate(directory):
    output = directory / "cortex-replay.html"
    subprocess.run([sys.executable, "-B", HERE / "record_replay.py"], cwd=directory,
                   check=True, stdin=subprocess.DEVNULL)
    return output


class ReplayTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.temp.cleanup)
        cls.directory = Path(cls.temp.name)
        cls.html = generate(cls.directory).read_bytes()
        data = cls.html.decode("utf-8").split('<script type="application/json" id="recording">')[1]
        cls.chapters = json.loads(data.split("</script>", 1)[0])

    def test_repeated_capture_is_byte_identical(self):
        self.assertEqual(generate(self.directory).read_bytes(), self.html)

    def test_seeded_terminal_samples(self):
        self.assertEqual([chapter["name"] for chapter in self.chapters], ["Intro", "Startup", "Outro"])
        # Row four of frame eleven, sampled from the original ANSI stdout at seed 7.
        samples = [(92, "│ 1111║0  11█0║"), (94, "│ ░▒▒██▓██ ╗░▒"), (91, "│  0 000 11█ █0")]
        for chapter, (color, prefix) in zip(self.chapters, samples):
            with self.subTest(chapter=chapter["name"]):
                runs = chapter["frames"][10]["runs"]
                row = "".join(text for _, text in runs).splitlines()[3]
                self.assertTrue(row.startswith(prefix), repr(row))
                self.assertIn([color, row], runs)

    def test_final_screens_and_original_holds(self):
        intro, startup, outro = (chapter["frames"] for chapter in self.chapters)
        for frames, color, messages in [
            (intro, 92, ["AI Knowledge Injection Protocol", "> [SYSTEM] Cortex online.", "> [SYSTEM] Ready?"]),
            (startup, 94, ["INITIALIZING CORTEX FRAMEWORK", "LLM NEURAL PATHWAYS ACTIVATING"]),
            (outro, 91, ["CONNECTION TERMINATED", ">> TERMINATING CONNECTION <<"]),
        ]:
            colored = "".join(text for code, text in frames[-1]["runs"] if code == color)
            for message in messages:
                self.assertIn(message, colored)
        self.assertEqual([frames[0]["ms"] for frames in (intro, startup, outro)], [50, 80, 50])
        self.assertEqual(startup[-1]["ms"], 580)
        self.assertTrue(any([91, ">> TERMIN"] in frame["runs"] and frame["ms"] == 7 for frame in outro))
        for chapter in self.chapters:
            for frame in chapter["frames"]:
                self.assertFalse(any("\x1b" in text for _, text in frame["runs"]))


if __name__ == "__main__":
    unittest.main()
