/**
 * MONEY TRACKER — keyless official factor collectors (NO AI, no paid data).
 *  - Taiwan listed-company monthly revenue: TWSE OpenAPI t187ap05_L (TSMC, MediaTek, Foxconn, Delta…)
 *  - ECB deposit facility rate: ECB Data Portal API (FM dataset)
 *  - US trade controls: Federal Register API documents from BIS (export controls, Entity List) and USTR (tariffs)
 *  - China MOFCOM: reachability probe only
 *  - FRED extra series (housing starts, copper): fredgraph CSV, or the official API when FRED_API_KEY is set
 * Each source is independent: if one fails, its previous file is kept and a ::warning:: is printed.
 * Output: data/market/factors/*.json. Values are stored as published; nothing is estimated or filled in.
 */
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const OUT = path.join(root, "data/market/factors");
const UA = { "User-Agent": "MONEY-TRACKER-research/1.0 (+https://91cleaner.github.io/money-tracker/)" };
const now = () => new Date().toISOString();
const warn = msg => console.log("::warning::" + msg);

export function rocMonth(v) { // "11509" (ROC year 115) -> "2026-09"
  const m = String(v || "").trim().match(/^(\d{2,3})(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]) + 1911, mo = Number(m[2]);
  return mo >= 1 && mo <= 12 ? y + "-" + String(mo).padStart(2, "0") : null;
}
const num = v => { const n = Number(String(v ?? "").replace(/,/g, "").trim()); return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null; };
const pick = (row, ...needles) => { for (const k of Object.keys(row)) if (needles.every(n => k.includes(n))) return row[k]; return undefined; };

export function parseTwRevenue(rows) {
  if (!Array.isArray(rows) || rows.length < 100) throw Error("unexpected TWSE revenue response size " + (rows && rows.length));
  const out = [];
  for (const r of rows) {
    const code = String(pick(r, "公司代號") ?? "").trim(), month = rocMonth(pick(r, "資料年月"));
    if (!/^\d{4,6}$/.test(code) || !month) continue;
    out.push({ code, name: String(pick(r, "公司名稱") ?? "").trim(), industry: String(pick(r, "產業別") ?? "").trim(), month,
      revenue: num(pick(r, "營業收入", "當月營收")), prev_month: num(pick(r, "營業收入", "上月營收")),
      last_year: num(pick(r, "營業收入", "去年當月營收")), mom_pct: num(pick(r, "上月比較增減")), yoy_pct: num(pick(r, "去年同月增減")),
      ytd: num(pick(r, "累計營業收入", "當月累計營收")) });
  }
  if (out.length < 100) throw Error("too few valid TWSE revenue rows: " + out.length);
  return out;
}

export function parseCsvSeries(text, dateKey, valueKey) {
  const lines = String(text || "").trim().split(/\r?\n/);
  const head = lines.shift().split(",").map(h => h.replace(/^"|"$/g, ""));
  const di = head.indexOf(dateKey), vi = head.indexOf(valueKey);
  if (di < 0 || vi < 0) throw Error("CSV columns missing: " + dateKey + "/" + valueKey);
  const points = [];
  for (const line of lines) {
    const c = line.split(",").map(x => x.replace(/^"|"$/g, ""));
    const v = num(c[vi]); if (v != null && /^\d{4}-\d{2}(-\d{2})?$/.test(c[di])) points.push({ date: c[di], value: v });
  }
  if (!points.length) throw Error("no observations");
  return points;
}


const CHINA = /\b(China|Chinese|PRC|People's Republic of China|Hong Kong|Macau)\b/i;
export function parseFedRegDocs(json, agencyLabel) {
  const rows = json && Array.isArray(json.results) ? json.results : null;
  if (!rows) throw Error("unexpected Federal Register response");
  return rows.filter(r => r && r.document_number && r.title && /^https:\/\/www\.federalregister\.gov\//.test(r.html_url || "")).map(r => {
    const text = r.title + " " + (r.abstract || "");
    return { id: r.document_number, date: r.publication_date, type: r.type, agency: agencyLabel, title: String(r.title).slice(0, 300),
      url: r.html_url, china: CHINA.test(text), entity_list: /entity list/i.test(r.title), tariff: /tariff|section 301|duty|duties/i.test(text) };
  });
}

function writeJson(file, data) {
  fs.mkdirSync(OUT, { recursive: true });
  const target = path.join(OUT, file);
  let old = null; try { old = JSON.parse(fs.readFileSync(target, "utf8")); } catch {}
  const strip = d => JSON.stringify({ ...d, collected_at: null });
  if (old && strip(old) === strip(data)) { console.log("UNCHANGED", file); return; }
  fs.writeFileSync(target, JSON.stringify(data, null, 1) + "\n");
  console.log("UPDATED", file);
}
async function get(url, timeout = 30000) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw Error("HTTP " + res.status);
  return res;
}

const WATCH = ["2330", "2454", "2317", "2308", "2303", "3711", "2382", "2412", "2881", "2882"];
async function taiwanRevenue() {
  const url = "https://openapi.twse.com.tw/v1/opendata/t187ap05_L";
  const rows = parseTwRevenue(await (await get(url)).json());
  const file = "tw-monthly-revenue.json";
  let old = {}; try { old = JSON.parse(fs.readFileSync(path.join(OUT, file), "utf8")); } catch {}
  const history = old.history || {};
  for (const r of rows) if (WATCH.includes(r.code)) {
    const h = (history[r.code] ||= { name: r.name, points: [] });
    h.name = r.name; h.points = h.points.filter(p => p.month !== r.month).concat({ month: r.month, revenue: r.revenue, yoy_pct: r.yoy_pct, mom_pct: r.mom_pct });
    h.points.sort((a, b) => a.month.localeCompare(b.month)); h.points = h.points.slice(-36);
  }
  writeJson(file, { source: "Taiwan Stock Exchange OpenAPI · 上市公司每月營業收入彙總表 (t187ap05_L)", source_url: url,
    unit: "TWD thousand (as published)", note: "공시된 값 그대로. 월매출은 회사별 공시일이 달라 일부 회사는 전월 자료일 수 있음.",
    collected_at: now(), latest_month: rows.map(r => r.month).sort().at(-1), count: rows.length, watch: WATCH, history, latest: rows });
  return rows.length + " companies";
}

async function ecbRates() {
  const series = { DFR: ["FM/D.U2.EUR.4F.KR.DFR.LEV", "ECB deposit facility rate (%)"], MRR: ["FM/D.U2.EUR.4F.KR.MRR_FR.LEV", "ECB main refinancing operations rate (%)"] };
  const out = { source: "European Central Bank · ECB Data Portal", source_url: "https://data.ecb.europa.eu/", collected_at: now(), series: {} };
  for (const [key, [flow, label]] of Object.entries(series)) {
    const url = "https://data-api.ecb.europa.eu/service/data/" + flow + "?format=csvdata&lastNObservations=400";
    const points = parseCsvSeries(await (await get(url)).text(), "TIME_PERIOD", "OBS_VALUE");
    out.series[key] = { label, url, points: points.slice(-400), latest: points.at(-1) };
  }
  writeJson("ecb-rates.json", out);
  return Object.keys(out.series).join(",");
}

async function fredExtra() {
  const key = (process.env.FRED_API_KEY || "").trim();
  const series = { HOUST: "US housing starts (thousands, SAAR)", PCOPPUSDM: "Global copper price (USD per metric ton)" };
  const out = { source: "Federal Reserve Bank of St. Louis · FRED", source_url: "https://fred.stlouisfed.org/", collected_at: now(), series: {} };
  for (const [id, label] of Object.entries(series)) {
    let points = null;
    try { points = parseCsvSeries(await (await get("https://fred.stlouisfed.org/graph/fredgraph.csv?id=" + id)).text(), "observation_date", id); }
    catch (e) {
      try { points = parseCsvSeries(await (await get("https://fred.stlouisfed.org/graph/fredgraph.csv?id=" + id)).text(), "DATE", id); } catch {}
      if (!points && key) {
        const j = await (await get("https://api.stlouisfed.org/fred/series/observations?series_id=" + id + "&api_key=" + encodeURIComponent(key) + "&file_type=json")).json();
        points = (j.observations || []).map(o => ({ date: o.date, value: num(o.value) })).filter(p => p.value != null);
      }
      if (!points || !points.length) { warn("FRED " + id + ": " + e.message); continue; } // never print the key
    }
    out.series[id] = { label, url: "https://fred.stlouisfed.org/series/" + id, points: points.slice(-240), latest: points.at(-1) };
  }
  if (!Object.keys(out.series).length) throw Error("no FRED series fetched");
  writeJson("fred-extra.json", out);
  return Object.keys(out.series).join(",");
}


async function usTradeControls() {
  const agencies = { "industry-and-security-bureau": "Commerce · Bureau of Industry and Security (수출통제)", "trade-representative-office-of-united-states": "USTR (관세·무역)" };
  const all = [];
  for (const [slug, label] of Object.entries(agencies)) {
    const q = new URL("https://www.federalregister.gov/api/v1/documents.json");
    q.searchParams.set("per_page", "200"); q.searchParams.set("order", "newest");
    q.searchParams.append("conditions[agencies][]", slug);
    for (const f of ["document_number", "title", "type", "publication_date", "html_url", "abstract"]) q.searchParams.append("fields[]", f);
    all.push(...parseFedRegDocs(await (await get(q.href)).json(), label));
  }
  if (all.length < 20) throw Error("too few Federal Register trade documents: " + all.length);
  all.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.id.localeCompare(b.id));
  writeJson("us-trade-controls.json", { source: "Federal Register API (BIS, USTR)", source_url: "https://www.federalregister.gov/developers/documentation/api/v1",
    note: "공식 고시 제목·날짜·원문 링크만 저장. china/entity_list/tariff 표시는 제목·요약의 단어로 자동 분류한 것이라 원문 확인 필요.",
    collected_at: now(), count: all.length, china_count: all.filter(d => d.china).length, entity_list_count: all.filter(d => d.entity_list).length, documents: all });
  return all.length + " docs (china " + all.filter(d => d.china).length + ")";
}

// Reachability probe only (no parsing yet): can GitHub Actions reach China's MOFCOM site? Recorded for the next step.
export function anchorLinks(html, base) {
  const out = [];
  for (const m of String(html || "").matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    try { if (text) out.push({ text: text.slice(0, 120), url: new URL(m[1], base).href }); } catch {}
  }
  return out;
}
async function chinaMofcomProbe() {
  const res = await fetch("https://www.mofcom.gov.cn/", { headers: UA, signal: AbortSignal.timeout(20000) });
  const html = await res.text();
  // Discovery aid for the next step: show which homepage links look like announcement / export-control lists.
  const hits = anchorLinks(html, "https://www.mofcom.gov.cn/").filter(a => /公告|出口管制|政策发布|管控名单|不可靠实体/.test(a.text)).slice(0, 15);
  console.log("::notice::MOFCOM_LINKS " + JSON.stringify(hits));
  return "HTTP " + res.status + " (" + html.length + " bytes, " + hits.length + " candidate links)";
}

if (import.meta.url === "file://" + process.argv[1]) {
  const results = {};
  for (const [name, fn] of Object.entries({ taiwanRevenue, ecbRates, fredExtra, usTradeControls, chinaMofcomProbe })) {
    try { results[name] = "ok: " + await fn(); }
    catch (e) { results[name] = "FAILED: " + e.message; warn(name + " failed — previous file kept: " + e.message); }
  }
  console.log("::notice::RESULTS " + JSON.stringify(results));
  // Sample values so a reviewer can check the fetched numbers against the official sites without downloading artifacts.
  try {
    const rd = f => JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
    const tw = rd("tw-monthly-revenue.json"), ecb = rd("ecb-rates.json"), fr = rd("fred-extra.json");
    const sample = { tw_month: tw.latest_month, tsmc: tw.history?.["2330"]?.points?.at(-1), mediatek: tw.history?.["2454"]?.points?.at(-1),
      ecb: Object.fromEntries(Object.entries(ecb.series || {}).map(([k, v]) => [k, v.latest])), fred: Object.fromEntries(Object.entries(fr.series || {}).map(([k, v]) => [k, v.latest])) };
    console.log("::notice::SAMPLE " + JSON.stringify(sample));
  } catch (e) { warn("sample summary unavailable: " + e.message); }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "status.json"), JSON.stringify({ results }, null, 1) + "\n");
  if (["taiwanRevenue", "ecbRates", "fredExtra", "usTradeControls"].every(k => String(results[k]).startsWith("FAILED"))) process.exit(1);
}
