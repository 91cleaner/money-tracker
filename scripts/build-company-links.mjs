/**
 * Build data/market/company-links.json: for each tracked company (data/markets), connect it to
 *  - its sectors (data/market/sectors.json) and those sectors' factors with their latest collected values,
 *  - exact-code records (Taiwan monthly revenue by stock code),
 *  - name matches (FDA approval sponsors, US trade-control notice titles) — labelled as name matches.
 * Offline, deterministic, no network, no AI. Connections are reference links, not causal claims.
 */
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const read = (p, fb = null) => { try { return JSON.parse(fs.readFileSync(path.join(root, p), "utf8")); } catch { return fb; } };

// English names / filing-name variants for name matching (only used to find mentions; never shown as fact on their own).
const NAMES = {
  NVDA: ["NVIDIA"], INTC: ["Intel"], MU: ["Micron"], AAPL: ["Apple"], MSFT: ["Microsoft"], GOOGL: ["Alphabet", "Google"], META: ["Meta Platforms"],
  AMZN: ["Amazon"], TSLA: ["Tesla"], JPM: ["JPMorgan"], PFE: ["Pfizer"], LMT: ["Lockheed Martin"], RTX: ["RTX Corp", "Raytheon"], XOM: ["Exxon"],
  COIN: ["Coinbase"], ASML_AS: ["ASML"], NOVO_B_CO: ["Novo Nordisk", "NOVO"], SAP_DE: ["SAP SE"], SIE_DE: ["Siemens"], RHM_DE: ["Rheinmetall"],
  MC_PA: ["LVMH"], TTE_PA: ["TotalEnergies"], "005930_KS": ["Samsung Electronics", "Samsung"], "000660_KS": ["SK hynix", "SK Hynix"],
  "005380_KS": ["Hyundai Motor"], "373220_KS": ["LG Energy Solution"], "006400_KS": ["Samsung SDI"], "207940_KS": ["Samsung Biologics"],
  "012450_KS": ["Hanwha Aerospace"], "329180_KS": ["HD Hyundai Heavy"], "035420_KS": ["NAVER"], "105560_KS": ["KB Financial"],
  "2330_TW": ["Taiwan Semiconductor", "TSMC"], "2454_TW": ["MediaTek"], "2317_TW": ["Hon Hai", "Foxconn"], "2308_TW": ["Delta Electronics"],
  "7203_T": ["Toyota"], "6758_T": ["Sony"], "8035_T": ["Tokyo Electron"], "7011_T": ["Mitsubishi Heavy"], "8306_T": ["Mitsubishi UFJ"], "9984_T": ["SoftBank"],
};
const SKIP_TAGS = new Set(["market", "fx", "rates", "commodity", "crypto", "safe_haven"]);
const word = n => new RegExp("(^|[^A-Za-z])" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^A-Za-z])", "i");

export function factorLatest(f, load) {
  if (!f || f.status !== "collected") return null;
  if (!f.data && f.market) { // price series collected by the world-data job (data/markets/<id>.json: d = dates, c = closes)
    const m = load("data/markets/" + f.market + ".json"); const i = m && Array.isArray(m.c) ? m.c.length - 1 : -1;
    return i >= 0 && m.c[i] != null ? { value: m.c[i], date: (m.d || [])[i] || null } : null;
  }
  if (!f.data) return null;
  const d = load(f.data.file); if (!d) return null;
  if (f.data.series) { const s = d.series && d.series[f.data.series]; return s && s.latest ? { value: s.latest.value, date: s.latest.date } : null; }
  if (f.data.company) { const h = d.history && d.history[f.data.company]; const p = h && h.points.at(-1); return p ? { value: p.yoy_pct, date: p.month, unit: "yoy%" } : null; }
  if (f.data.list) { const k = f.data.list.replace(/^_/, ""), v = d[k]; return v ? { count: Array.isArray(v) ? v.length : Object.keys(v).length } : null; }
  if (f.data.item) { const it = d.items && d.items[f.data.item]; return it && it.latest ? { value: it.latest.exp_usd, date: it.latest.month, unit: "usd" } : null; }
  return null;
}

export function buildCompanyLinks({ markets, sectors, load }) {
  const factors = new Map((sectors.factors || []).map(f => [f.id, f]));
  const tw = load("data/market/factors/tw-monthly-revenue.json") || {};
  const fda = load("data/market/factors/us-fda-approvals.json") || {};
  const trade = load("data/market/factors/us-trade-controls.json") || {};
  const out = [];
  for (const m of markets) {
    if (!m.id || (m.tags || []).every(t => SKIP_TAGS.has(t))) continue;
    const inSectors = (sectors.sectors || []).filter(s => (s.markets || []).includes(m.id));
    if (!inSectors.length) continue;
    const fids = [...new Set(inSectors.flatMap(s => s.factors))];
    const links = { id: m.id, symbol: m.symbol, name: m.name, region: m.region, sectors: inSectors.map(s => ({ id: s.id, label: s.label })),
      factors: fids.map(id => factors.get(id)).filter(Boolean).map(f => ({ id: f.id, label: f.label, status: f.status, latest: factorLatest(f, load), source_url: f.source_url })),
      law_topics: [...new Set(inSectors.flatMap(s => s.law_topics || []))], exact: [], name_matches: [] };
    const code = /^(\d{4})\.TW$/.exec(m.symbol || "");
    if (code && tw.history && tw.history[code[1]]) {
      const p = tw.history[code[1]].points.at(-1);
      links.exact.push({ kind: "tw_monthly_revenue", match: "stock code " + code[1], month: p.month, revenue_twd_thousand: p.revenue, yoy_pct: p.yoy_pct, url: tw.source_url });
    }
    const names = NAMES[m.id] || [];
    for (const n of names) {
      const re = word(n);
      for (const a of fda.items || []) if (re.test(a.sponsor || "")) links.name_matches.push({ kind: "fda_approval", match: "sponsor name '" + n + "'", date: a.date, title: (a.brand || []).join(" / ") || a.application, url: a.url });
      for (const d of trade.documents || []) if (re.test(d.title || "")) links.name_matches.push({ kind: "us_trade_notice", match: "title mentions '" + n + "'", date: d.date, title: d.title, url: d.url });
    }
    const seen = new Set(); links.name_matches = links.name_matches.filter(x => !seen.has(x.url) && seen.add(x.url)).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 20);
    out.push(links);
  }
  return out;
}


const SEMI_TICKERS = ["NVDA", "TSM", "INTC", "MU", "AMD", "AVGO", "QCOM", "ASML", "AMAT", "LRCX", "KLAC", "TXN", "ADI", "MRVL", "ARM", "SMCI"];
/** Small summary of lawmakers' disclosed trades in semiconductor tickers (public House PTR records), for the map briefing. */
export function semiTradesSummary(trades) {
  const rows = (trades?.trades || []).filter(r => SEMI_TICKERS.includes(String(r.tk || "").toUpperCase()) && /^\d{4}-\d{2}-\d{2}$/.test(r.d || ""));
  const by = {}; for (const r of rows) by[r.tk] = (by[r.tk] || 0) + 1;
  const latest = rows.slice().sort((a, b) => b.d.localeCompare(a.d))[0] || null;
  return { about: "미국 하원의원이 공시한 반도체 종목 거래 건수(공개 PTR 기록). 거래 사실의 기록일 뿐 잘잘못 판단 아님.", source: trades?.source || "U.S. House Clerk financial disclosures",
    source_url: "https://disclosures-clerk.house.gov/FinancialDisclosure", count: rows.length,
    from: rows.length ? rows.map(r => r.d).sort()[0] : null, to: latest ? latest.d : null,
    by_ticker: Object.entries(by).sort((a, b) => b[1] - a[1]).map(([tk, n]) => ({ tk, n })),
    latest: latest ? { d: latest.d, tk: latest.tk, ty: latest.ty, amt: latest.amt, who: latest.who, doc: latest.doc } : null };
}

if (import.meta.url === "file://" + process.argv[1]) {
  const dir = path.join(root, "data/markets");
  const markets = fs.readdirSync(dir).filter(f => f.endsWith(".json") && f !== "index.json").map(f => ({ id: f.slice(0, -5), ...read("data/markets/" + f, {}) }));
  const cache = {}; const load = p => (p in cache ? cache[p] : (cache[p] = read(p)));
  const companies = buildCompanyLinks({ markets, sectors: read("data/market/sectors.json", {}), load });
  const data = { about: "추적 중인 기업마다 업종·함께 볼 지표(최신값)·종목코드로 정확히 연결된 기록·이름이 일치한 기록을 모은 참고 연결표. 이름 일치는 동명이인·다른 법인일 수 있어 원문 확인 필요. 원인 관계를 단정하지 않음.",
    count: companies.length, companies };
  const target = path.join(root, "data/market/company-links.json");
  const prev = read("data/market/company-links.json");
  if (prev && JSON.stringify(prev) === JSON.stringify(data)) { console.log("UNCHANGED company-links.json"); }
  else { fs.writeFileSync(target, JSON.stringify(data, null, 1) + "\n"); console.log("UPDATED company-links.json", companies.length, "companies"); }
  const sum = semiTradesSummary(read("data/us/trades.json"));
  const sp = path.join(root, "data/market/semis-trades-summary.json"), prevSum = read("data/market/semis-trades-summary.json");
  if (!(prevSum && JSON.stringify(prevSum) === JSON.stringify(sum))) { fs.writeFileSync(sp, JSON.stringify(sum, null, 1) + "\n"); console.log("UPDATED semis-trades-summary.json", sum.count); }
}
