#!/usr/bin/env python3
"""Check the same Pages entry-point contract before and after deployment.

Usage:
  python3 scripts/check-pages-entry.py --local-dir .public-pages
  python3 scripts/check-pages-entry.py --site-url https://example.github.io/repo/
"""
import argparse
import hashlib
from pathlib import Path
import time
from urllib.request import Request, urlopen

# (public URL path, local artifact path, required content markers)
CHECKS = (
    ('', 'index.html', ('href="korea.html"', 'href="world-intelligence/"')),
    ('korea.html', 'korea.html', ('대한민국', 'href="national.html"')),
    ('world-intelligence/', 'world-intelligence/index.html',
     ('id="map"', 'id="ask"', 'AI 분석 미연결 · 실시간 거래 데이터 미연결')),
    ('usa-command-legacy.html', 'usa-command-legacy.html',
     ('id="usCmd"', '실시간 시세 OFF', 'mt-map-only-controller')),
    ('assets/mt-command-ui.js', 'assets/mt-command-ui.js', ()),
)


def missing_markers(body, markers):
    return [marker for marker in markers if marker not in body]


def check_local(directory):
    for url_path, file_path, markers in CHECKS:
        path = directory / file_path
        if not path.is_file():
            raise RuntimeError(f'Missing Pages artifact: {file_path}')
        missing = missing_markers(path.read_text(encoding='utf-8'), markers)
        if missing:
            raise RuntimeError(f'Pages artifact mismatch {file_path}: missing {missing!r}')
        print('PASS artifact', file_path)


def check_live(base, attempts=8, pause=10, expected_dir=None):
    """Verify the published files, optionally against the exact uploaded artifact.

    Marker-only checks can accept an older Pages deployment with identical
    navigation. Comparing bytes and using a digest query avoids false success.
    """
    base = base.rstrip('/') + '/'
    for url_path, file_path, markers in CHECKS:
        expected = None
        url = base + url_path
        if expected_dir is not None:
            artifact = Path(expected_dir) / file_path
            if not artifact.is_file():
                raise RuntimeError(f'Missing expected Pages artifact: {file_path}')
            expected = artifact.read_bytes()
            digest = hashlib.sha256(expected).hexdigest()
            url += ('&' if '?' in url else '?') + 'mt_verify=' + digest[:16]
        last_error = None
        for attempt in range(attempts):
            try:
                req = Request(url, headers={'Cache-Control': 'no-cache'})
                with urlopen(req, timeout=20) as response:
                    published = response.read()
                    if response.status != 200:
                        raise RuntimeError(f'HTTP {response.status}')
                body = published.decode('utf-8')
                missing = missing_markers(body, markers)
                if missing:
                    raise RuntimeError(f'missing {missing!r}')
                if expected is not None and published != expected:
                    actual_digest = hashlib.sha256(published).hexdigest()[:16]
                    raise RuntimeError(
                        f'published content does not match Pages artifact: '
                        f'{file_path} (published sha256={actual_digest}, '
                        f'expected sha256={digest[:16]})')
                print('PASS published', base + url_path)
                break
            except Exception as exc:
                last_error = exc
                if attempt < attempts - 1:
                    time.sleep(pause)
        else:
            raise RuntimeError(f'Published page failed: {base + url_path}: {last_error}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--local-dir', type=Path)
    source.add_argument('--site-url')
    parser.add_argument('--expected-dir', type=Path,
                        help='Compare published bytes with uploaded Pages artifact')
    args = parser.parse_args()
    if args.local_dir is not None:
        if args.expected_dir is not None:
            parser.error('--expected-dir requires --site-url')
        check_local(args.local_dir)
    else:
        check_live(args.site_url, expected_dir=args.expected_dir)


if __name__ == '__main__':
    main()
