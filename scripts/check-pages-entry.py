#!/usr/bin/env python3
"""Check the same Pages entry-point contract before and after deployment.

Usage:
  python3 scripts/check-pages-entry.py --local-dir .public-pages
  python3 scripts/check-pages-entry.py --site-url https://example.github.io/repo/
"""
import argparse
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


def check_live(base, attempts=8, pause=10):
    base = base.rstrip('/') + '/'
    for url_path, _, markers in CHECKS:
        last_error = None
        for attempt in range(attempts):
            try:
                req = Request(base + url_path, headers={'Cache-Control': 'no-cache'})
                with urlopen(req, timeout=20) as response:
                    body = response.read().decode('utf-8')
                    if response.status != 200:
                        raise RuntimeError(f'HTTP {response.status}')
                missing = missing_markers(body, markers)
                if missing:
                    raise RuntimeError(f'missing {missing!r}')
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
    args = parser.parse_args()
    if args.local_dir is not None:
        check_local(args.local_dir)
    else:
        check_live(args.site_url)


if __name__ == '__main__':
    main()
