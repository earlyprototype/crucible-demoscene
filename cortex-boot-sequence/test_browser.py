"""Exercise a relocated replay in an offline Chromium tab via DevTools."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from urllib.request import urlopen

from test_replay import generate


@unittest.skipUnless(os.environ.get("CORTEX_BROWSER"), "set CORTEX_BROWSER to run the browser check")
class BrowserTest(unittest.TestCase):
    def command(self, method, **params):
        self.request_id += 1
        self.socket.send(json.dumps({"id": self.request_id, "method": method, "params": params}))
        while True:
            reply = json.loads(self.socket.recv(timeout=10))
            if reply.get("id") == self.request_id:
                self.assertNotIn("error", reply)
                return reply["result"]

    def evaluate(self, expression):
        result = self.command("Runtime.evaluate", expression=expression,
                              returnByValue=True, awaitPromise=True)
        self.assertNotIn("exceptionDetails", result)
        return result["result"].get("value")

    def test_portable_player(self):
        from websockets.sync.client import connect

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            portable = root / "moved replay"
            portable.mkdir()
            page = generate(root).rename(portable / "trilogy.html")
            profile = root / "profile"
            browser = subprocess.Popen([
                os.environ["CORTEX_BROWSER"], "--headless", "--disable-gpu",
                "--disable-background-networking", "--no-first-run", "--no-default-browser-check",
                "--remote-debugging-port=0", f"--user-data-dir={profile}", "about:blank",
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                port_file = profile / "DevToolsActivePort"
                deadline = time.monotonic() + 15
                while not port_file.exists():
                    if browser.poll() is not None or time.monotonic() >= deadline:
                        self.fail("Chromium did not start its local DevTools endpoint")
                    time.sleep(.05)
                port = port_file.read_text().splitlines()[0]
                with urlopen(f"http://127.0.0.1:{port}/json/list", timeout=5) as response:
                    tab = next(tab for tab in json.load(response) if tab["type"] == "page")
                with connect(tab["webSocketDebuggerUrl"]) as self.socket:
                    self.request_id = 0
                    self.command("Network.enable")
                    self.command("Network.emulateNetworkConditions", offline=True, latency=0,
                                 downloadThroughput=0, uploadThroughput=0)
                    navigation = self.command("Page.navigate", url=page.as_uri())
                    self.assertNotIn("errorText", navigation)
                    self.evaluate("""new Promise(resolve => document.readyState === 'complete'
                        ? resolve() : window.addEventListener('load', resolve, {once: true}))""")
                    self.assertFalse(self.evaluate("navigator.onLine"))
                    self.check_controls()
                    self.command("Browser.close")
            finally:
                try:
                    browser.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    browser.kill()
                    browser.wait()

    def check_controls(self):
        self.evaluate("""
            const element = id => document.getElementById(id);
            const choose = index => {
                element('chapter').selectedIndex = index;
                element('chapter').dispatchEvent(new Event('change'));
            };
            const seek = value => {
                element('frame').value = value;
                element('frame').dispatchEvent(new Event('input'));
            };
            const coloredText = () => Array.from(element('screen').children,
                span => [getComputedStyle(span).color, span.textContent]);
        """)
        for index, (rgb, sample, final) in enumerate([
            ("rgb(85, 255, 85)", "│ 1111║0  11█0║", "> [SYSTEM] Ready?"),
            ("rgb(85, 85, 255)", "│ ░▒▒██▓██ ╗░▒", "LLM NEURAL PATHWAYS ACTIVATING"),
            ("rgb(255, 85, 85)", "│  0 000 11█ █0", ">> TERMINATING CONNECTION <<"),
        ]):
            with self.subTest(chapter=index):
                runs = self.evaluate(f"choose({index}); seek(11); coloredText()")
                self.assertTrue(any(c == rgb and sample in text for c, text in runs))
                runs = self.evaluate("seek(element('frame').max); coloredText()")
                self.assertTrue(any(c == rgb and final in text for c, text in runs))

        # Play from the last frame restarts at Intro. Pause cancels its timer.
        self.assertEqual(self.evaluate("element('play').click(); element('chapter').value"), "0")
        self.evaluate("new Promise(resolve => setTimeout(resolve, 220))")
        paused = self.evaluate("element('play').click(); element('frame').valueAsNumber")
        self.assertGreater(paused, 1)
        self.evaluate("new Promise(resolve => setTimeout(resolve, 150))")
        self.assertEqual(self.evaluate("element('frame').valueAsNumber"), paused)

        self.evaluate("choose(1); seek(element('frame').max); element('play').click()")
        self.evaluate("new Promise(resolve => setTimeout(resolve, 750))")
        self.assertEqual(self.evaluate("element('chapter').value"), "2")
        self.evaluate("seek(element('frame').max - 1); element('play').click()")
        self.evaluate("new Promise(resolve => setTimeout(resolve, 100))")
        self.assertEqual(self.evaluate("element('play').textContent"), "Play")
        self.assertTrue(self.evaluate("element('frame').value === element('frame').max"))


if __name__ == "__main__":
    unittest.main()
