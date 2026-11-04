"""Regression checks for the US signals lab inline JavaScript and HTML tail."""
from pathlib import Path
import re
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "world-intelligence" / "us-signals.html"


class USSignalsInlineScriptTest(unittest.TestCase):
    def test_balanced_script_tags_and_single_html_close(self):
        html = HTML.read_text(encoding="utf-8")
        self.assertEqual(len(re.findall(r"<script\b", html, re.I)),
                         len(re.findall(r"</script\s*>", html, re.I)))
        self.assertEqual(len(re.findall(r"</html\s*>", html, re.I)), 1)
        self.assertTrue(html.rstrip().lower().endswith("</html>"))

    def test_all_inline_scripts_parse(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("Node.js is required for inline JavaScript syntax checking")
        html = HTML.read_text(encoding="utf-8")
        scripts = re.findall(r"<script\b([^>]*)>(.*?)</script\s*>",
                             html, re.I | re.S)
        checked = 0
        for attrs, code in scripts:
            if re.search(r"\bsrc\s*=", attrs, re.I) or not code.strip():
                continue
            result = subprocess.run([node, "--check"], input=code,
                                    text=True, capture_output=True, check=False)
            self.assertEqual(result.returncode, 0,
                             f"Inline script {checked} has invalid JS: {result.stderr}")
            checked += 1
        self.assertGreaterEqual(checked, 5)


if __name__ == "__main__":
    unittest.main()
