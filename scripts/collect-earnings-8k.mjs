/**
 * MONEY TRACKER — earnings-release dates from SEC EDGAR (official, keyless, NO AI).
 * An 8-K whose "items" list contains 2.02 ("Results of Operations and Financial Condition") is a company's earnings release.
 * Output: data/us/earnings.json  { updated, source, source_url, note, tickers: { NVDA: [{ date, url }] } }  (newest first)
 * Read by assets/mt-event-context.js ("같은 기간 있었던 일" card). If a ticker fails, its previous entry is kept.
 * Usage: node scripts/collect-earnings-8k.mjs [--tickers NVDA,INTC]   (SEC asks for a contact in the User-Agent: SEC_UA env)
 */
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const OUT = path.join(root, "data/us/earnings.json");
const KEEP_DAYS = 400;

// submissions JSON -> [{date,url}] for 8-Ks that carry Item 2.02
export function extractEarnings(sub, cik, today = new Date().toISOString().slice(0, 10)) {
  const r = sub && sub.filings && sub.filings.recent;
  if (!r || !Array.isArray(r.form)) return [];
  const min = new Date(Date.parse(today) - KEEP_DAYS * 864e5).toISOString().slice(0, 10), out = [];
  for (let i = 0; i < r.form.length; i++) {
    if (r.form[i] !== "8-K" || !String((r.items && r.items[i]) || "").split(",").map(x => x.trim()).includes("2.02")) continue;
    const date = r.filingDate[i], acc = String(r.accessionNumber[i] || "").replace(/-/g, ""), doc = r.primaryDocument && r.primaryDocument[i];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < min || !acc || !doc) continue;
    out.push({ date, url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${doc}` });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

async function main() {
  const sectors = JSON.parse(fs.readFileSync(path.join(root, "data/us/ticker-sectors.json"), "utf8")).tickers;
  const arg = process.argv.indexOf("--tickers");
  const list = arg > 0 ? process.argv[arg + 1].split(",") : Object.keys(sectors);
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { tickers: {} };
  const UA = { "User-Agent": process.env.SEC_UA || "MONEY-TRACKER-research/1.0 (+https://91cleaner.github.io/money-tracker/)" };
  const tickers = { ...(prev.tickers || {}) };
  let ok = 0, fail = 0;
  for (const t of list) {
    const cik = sectors[t] && sectors[t].cik; if (!cik) continue;
    try {
      const res = await fetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, "0")}.json`, { headers: UA });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const e = extractEarnings(await res.json(), cik);
      if (e.length) tickers[t] = e; else delete tickers[t];
      ok++;
    } catch (err) { fail++; console.log(`::warning::earnings ${t}: ${err.message}`); }
    await new Promise(r => setTimeout(r, 150)); // SEC fair-access limit is 10 requests/second
  }
  if (!ok) { console.log("::warning::no ticker succeeded; keeping the previous earnings.json"); return; }
  fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), source: "SEC EDGAR 8-K Item 2.02", source_url: "https://www.sec.gov/edgar/search/",
    note: "8-K 중 Item 2.02(경영성적 발표)가 있는 제출일. 제출일은 실제 발표일과 같거나 하루 차이일 수 있음. 원인 단정 없음, 투자 조언 아님.", tickers }, null, 1) + "\n");
  console.log(`::notice::earnings ok=${ok} fail=${fail} tickers=${Object.keys(tickers).length}`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
