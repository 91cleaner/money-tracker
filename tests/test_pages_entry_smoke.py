"""Regression checks for the shared Pages preflight/post-deploy contract."""
import runpy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlsplit

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

    def test_live_accepts_exact_artifact_and_bypasses_cache(self):
        class Response:
            status = 200

            def __init__(self, data):
                self.data = data

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self):
                return self.data

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for _, file_path, markers in CONTRACT['CHECKS']:
                path = root / file_path
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('\\n'.join(markers), encoding='utf-8')
            requested = []

            def fake_urlopen(request, timeout):
                self.assertEqual(timeout, 20)
                requested.append(request.full_url)
                path = urlsplit(request.full_url).path.removeprefix('/repo/')
                file_path = next(p for url, p, _ in CONTRACT['CHECKS']
                                 if url.rstrip('/') == path.rstrip('/'))
                return Response((root / file_path).read_bytes())

            with patch.dict(CONTRACT['check_live'].__globals__, {'urlopen': fake_urlopen}):
                CONTRACT['check_live']('https://example.test/repo/', attempts=1,
                                       pause=0, expected_dir=root)
            self.assertEqual(len(requested), len(CONTRACT['CHECKS']))
            self.assertTrue(all('mt_verify=' in url for url in requested))

    def test_live_rejects_stale_page_even_with_all_markers(self):
        class Response:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self):
                return b'href="korea.html" href="world-intelligence/"\\n'

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'index.html').write_text(
                'href="korea.html" href="world-intelligence/"', encoding='utf-8')
            with patch.dict(CONTRACT['check_live'].__globals__,
                            {'urlopen': lambda request, timeout: Response()}):
                with self.assertRaisesRegex(RuntimeError,
                                            'does not match Pages artifact'):
                    CONTRACT['check_live']('https://example.test/repo/',
                                           attempts=1, pause=0, expected_dir=root)

    def test_live_missing_expected_artifact_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, 'Missing expected Pages artifact'):
                CONTRACT['check_live']('https://example.test/repo/',
                                       attempts=1, pause=0, expected_dir=Path(directory))


if __name__ == '__main__':
    unittest.main()
