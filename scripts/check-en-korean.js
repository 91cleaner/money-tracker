#!/usr/bin/env node
/* EN 모드 한글 잔여 검사: 크롬(headless)으로 ?lang=en 페이지를 열고, 화면에 남은 한글 글자 수를 센다.
   쓰기: node scripts/check-en-korean.js [base-url] [path ...]
   기본: http://localhost:8123 (python3 -m http.server 8123) 과 us.html, company.html?t=NVDA.
   본문 글자 + title/placeholder/aria-label/alt 속성(툴팁)까지 센다. 한글이 남으면 종료코드 1.
   외부 호출·AI·키 없음. */
'use strict';
const { spawnSync } = require('node:child_process');

const base = (process.argv[2] || 'http://localhost:8123').replace(/\/$/, '');
const paths = process.argv.length > 3 ? process.argv.slice(3) : ['us.html', 'company.html?t=NVDA', 'company.html?t=AAPL'];
const CHROME = process.env.CHROME || ['chromium', 'chromium-browser', 'google-chrome'].find(c => spawnSync('which', [c]).status === 0);
if (!CHROME) { console.error('chromium / google-chrome not found'); process.exit(2); }

const HANGUL = /[가-힣ㄱ-ㆎ]/g;

function dump(url) {
  const r = spawnSync(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=15000', '--dump-dom', url],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 90000 });
  return r.stdout || '';
}

function visible(html) {
  html = html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const found = [];
  for (const m of html.matchAll(/\s(title|placeholder|aria-label|alt|data-tip|data-title)="([^"]*)"/gi)) found.push(['@' + m[1], m[2]]);
  const text = html.replace(/<[^>]+>/g, '\n');
  for (const line of text.split('\n')) if (line.trim()) found.push(['text', line.trim()]);
  return found;
}

let total = 0;
for (const p of paths) {
  const url = base + '/' + p + (p.includes('?') ? '&' : '?') + 'lang=en';
  const html = dump(url);
  if (!html) { console.log(p + ': page did not render'); total += 1; continue; }
  const bad = visible(html).filter(([, s]) => (s.match(HANGUL) || []).length);
  const n = bad.reduce((a, [, s]) => a + (s.match(HANGUL) || []).length, 0);
  total += n;
  console.log(p + ': ' + n + ' Korean characters in ' + bad.length + ' places');
  bad.slice(0, 40).forEach(([k, s]) => console.log('   ' + k + '  ' + s.slice(0, +(process.env.W || 400))));
}
process.exit(total ? 1 : 0);
