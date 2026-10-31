"""Regression checks for the shared Pages preflight/post-deploy contract."""
import runpy
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'check-pages-entry.py'
CONTRACT = runpy.run_path(str(SCRIPT))


class PagesEntrySmokeTests(unittest.TestCase):
    def test_all_declared_markers_pass(self):
        for _, path, markers in CONTRACT['CHECKS']:
            with self.subTest(path=path):
                self.assertEqual(CONTRACT['missing_markers']('\n'.join(markers), markers), [])

    def test_missing_marker_is_detected(self):
        self.assertEqual(CONTRACT['missing_markers']('href="korea.html"',
                         ('href="korea.html"', 'href="world-intelligence/"')),
                         ['href="world-intelligence/"'])

    def test_missing_artifact_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, 'Missing Pages artifact'):
                CONTRACT['check_local'](Path(directory))

    def test_local_artifact_contract(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for _, file_path, markers in CONTRACT['CHECKS']:
                path = root / file_path
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('\n'.join(markers), encoding='utf-8')
            CONTRACT['check_local'](root)
            (root / 'index.html').write_text('href="korea.html"', encoding='utf-8')
            with self.assertRaisesRegex(RuntimeError, 'Pages artifact mismatch index.html'):
                CONTRACT['check_local'](root)


if __name__ == '__main__':
    unittest.main()
