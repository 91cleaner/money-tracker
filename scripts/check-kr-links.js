#!/usr/bin/env node
// 과기정통부 보도자료 / korea.kr 정책뉴스 링크 점검 (무료 공식 주소만, 키 불필요)
// 사용: node scripts/check-kr-links.js [--fix] [--limit=N]
//   기본: data/ 아래 JSON 의 msit.go.kr · korea.kr 링크를 모두 HTTP 로 확인하고 결과를 data/policy/kr-link-check.json 에 저장.
//   --fix: 깨진 보도자료 상세 링크를 보도자료 목록(https://www.msit.go.kr/bbs/list.do?sCode=user&mId=307&mPid=208&bbsSeqNo=94)으로 바꿈.
// 깨진 링크가 있으면 종료코드 1.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const HOSTS = /(^|\.)(msit\.go\.kr|korea\.kr)$/i;
const FALLBACK = "https://www.msit.go.kr/bbs/list.do?sCode=user&mId=307&mPid=208&bbsSeqNo=94";
const UA = "Mozilla/5.0 (compatible; money-tracker-linkcheck)";
const args = process.argv.slice(2);
const FIX = args.includes("--fix");
const LIMIT = Number((args.find((a) => a.startsWith("--limit=")) || "").split("=")[1]) || Infinity;
const CONC = 4;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".json") && e.name !== "kr-link-check.json") out.push(p);
  }
  return out;
}

function hostOk(u) {
  try { return HOSTS.test(new URL(u).hostname); } catch { return false; }
}

async function check(url, tries = 2) {
  const r = await check1(url);
  // 서버가 잠깐 바쁜 경우(5xx·시간초과)는 한 번 더 확인
  if (!r.ok && (r.status >= 500 || r.status === 0) && tries > 1) {
    await new Promise((res) => setTimeout(res, 3000));
    return check(url, tries - 1);
  }
  return r;
}

async function check1(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const r = await fetch(url, { method, redirect: "follow", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      if (r.ok) return { ok: true, status: r.status };
      // HEAD 를 막는 서버가 있어 GET 으로 한 번 더 확인
      if (method === "GET" || ![403, 405, 501].includes(r.status)) return { ok: false, status: r.status };
    } catch (e) {
      if (method === "GET") return { ok: false, status: 0, error: e.name };
    }
  }
  return { ok: false, status: 0 };
}

(async () => {
  const files = walk(DATA);
  const where = new Map(); // url -> Set(file)
  const re = /https?:\/\/[^"\s\\<>]+/g;
  for (const f of files) {
    const txt = fs.readFileSync(f, "utf8");
    for (let u of txt.match(re) || []) {
      u = u.replace(/[),.;]+$/, "").replace(/&amp;/g, "&");
      if (!hostOk(u)) continue;
      if (!where.has(u)) where.set(u, new Set());
      where.get(u).add(path.relative(ROOT, f));
    }
  }
  const urls = [...where.keys()].slice(0, LIMIT);
  console.log(`링크 ${urls.length}개 확인 시작`);
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (i < urls.length) {
      const u = urls[i++];
      const r = await check(u);
      results.push({ url: u, ...r, files: [...where.get(u)] });
      if (!r.ok) console.log(`깨짐 ${r.status || r.error || "?"} ${u}`);
    }
  }));
  const broken = results.filter((r) => !r.ok);
  console.log(`정상 ${results.length - broken.length} / 깨짐 ${broken.length}`);

  if (FIX && broken.length) {
    const files2 = new Set(broken.flatMap((b) => b.files));
    for (const rel of files2) {
      const p = path.join(ROOT, rel);
      let txt = fs.readFileSync(p, "utf8");
      for (const b of broken) {
        if (!b.files.includes(rel) || !/msit\.go\.kr\/bbs\/view\.do/.test(b.url)) continue;
        txt = txt.split(b.url).join(FALLBACK);
      }
      fs.writeFileSync(p, txt);
    }
    console.log("깨진 보도자료 링크를 목록 페이지로 바꿨어요");
  }

  const outDir = path.join(DATA, "policy");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "kr-link-check.json"), JSON.stringify({
    updated: new Date().toISOString().slice(0, 10),
    total: results.length,
    broken: broken.map(({ url, status, error, files }) => ({ url, status, error, files })),
  }, null, 1) + "\n");
  process.exit(broken.length ? 1 : 0);
})();
