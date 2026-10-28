/**
 * MONEY TRACKER — keyless official factor collectors (NO AI, no paid data).
 *  - Taiwan listed-company monthly revenue: TWSE OpenAPI t187ap05_L (TSMC, MediaTek, Foxconn, Delta…)
 *  - ECB deposit facility rate: ECB Data Portal API (FM dataset)
 *  - US trade controls: Federal Register API documents from BIS (export controls, Entity List) and USTR (tariffs)
 *  - China MOFCOM: 政策发布 announcement titles/numbers/links (export-control tagging by title words)
 *  - US FDA new drug approvals (openFDA Drugs@FDA, keyless)
 *  - US county jobs for key industries (BLS QCEW open data, keyless)
 *  - Country profiles (GDP, population, exports %GDP, inflation, military spending) from the World Bank API
 *  - UK House of Commons divisions (Commons Votes API) and European Parliament roll-call votes (HowTheyVote.eu)
 *  - FRED extra series (housing starts, copper, Korea/Japan monthly exports): fredgraph CSV, or the official API when FRED_API_KEY is set
 * Each source is independent: if one fails, its previous file is kept and a ::warning:: is printed.
 * Output: data/market/factors/*.json. Values are stored as published; nothing is estimated or filled in.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
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


export function parseMofcomList(html, base = "https://www.mofcom.gov.cn/") {
  const out = [], seen = new Set(), src = String(html || "");
  for (const m of src.matchAll(/<a\b[^>]*href=["']([^"'#]*\/zwgk\/zcfb\/art\/[^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    let url; try { url = new URL(m[1], base).href; } catch { continue; }
    if (!title || seen.has(url) || !/^https:\/\/www\.mofcom\.gov\.cn\//.test(url)) continue;
    seen.add(url);
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 300);
    const date = (after.match(/(20\d{2}-\d{2}-\d{2})/) || [])[1] || null;
    const no = title.match(/公告\s*(20\d{2})\s*年\s*第\s*(\d+)\s*号/);
    const targets = ["美国", "日本", "欧盟", "台湾", "韩国", "英国", "加拿大", "荷兰", "德国"].filter(c => title.includes(c));
    out.push({ title: title.slice(0, 200), url, date, number: no ? no[1] + "-" + no[2] : null,
      export_control: /出口管制|两用物项|管控名单|关注名单|不可靠实体/.test(title), targets });
  }
  return out;
}



export function csvRow(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  out.push(cur.trim()); return out;
}

export function parseBisCsv(text) {
  const lines = String(text || "").trim().split(/\r?\n/);
  const head = csvRow(lines.shift());
  const ai = head.findIndex(h => /^REF_AREA/i.test(h)), ti = head.indexOf("TIME_PERIOD"), vi = head.indexOf("OBS_VALUE");
  if (ai < 0 || ti < 0 || vi < 0) throw Error("BIS CSV columns missing");
  const by = {};
  for (const line of lines) {
    const c = csvRow(line);
    const area = String(c[ai] || "").split(":")[0], v = num(c[vi]);
    if (v == null || !/^\d{4}-\d{2}(-\d{2})?$/.test(c[ti])) continue;
    (by[area] ||= []).push({ date: c[ti], value: v });
  }
  for (const k of Object.keys(by)) by[k].sort((a, b) => a.date.localeCompare(b.date));
  if (!Object.keys(by).length) throw Error("no BIS observations");
  return by;
}


const ymd = v => /^\d{8}$/.test(String(v || "")) ? String(v).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3") : null;
export function parseFdaApprovals(json, since) {
  const rows = json && Array.isArray(json.results) ? json.results : null;
  if (!rows) throw Error("unexpected openFDA response");
  const out = [];
  for (const r of rows) {
    const orig = (r.submissions || []).filter(x => x.submission_type === "ORIG" && x.submission_status === "AP").map(x => ({ ...x, date: ymd(x.submission_status_date) })).filter(x => x.date && x.date >= since).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!orig || !/^[A-Z]{2,4}\d{4,7}$/.test(r.application_number || "")) continue;
    const brand = [...new Set((r.products || []).map(p => p.brand_name).filter(Boolean))].slice(0, 3);
    const ingredients = [...new Set((r.products || []).flatMap(p => (p.active_ingredients || []).map(a => a.name)).filter(Boolean))].slice(0, 4);
    out.push({ application: r.application_number, sponsor: String(r.sponsor_name || "").slice(0, 80), brand, ingredients, date: orig.date,
      novel: /TYPE 1/.test(orig.submission_class_code || ""), class_code: orig.submission_class_code || null,
      url: "https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=" + r.application_number.replace(/^\D+/, "") });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.application.localeCompare(b.application));
}


export function parseQcew(text, titles = {}) {
  const lines = String(text || "").trim().split(/\r?\n/);
  const head = csvRow(lines.shift());
  const col = k => head.indexOf(k);
  const need = ["area_fips", "own_code", "agglvl_code", "year", "qtr", "disclosure_code", "month3_emplvl"];
  for (const k of need) if (col(k) < 0) throw Error("QCEW column missing: " + k);
  const counties = [], states = [];
  for (const line of lines) {
    const c = csvRow(line), get = k => c[col(k)];
    if (get("own_code") !== "5" || get("disclosure_code") === "N") continue;
    const lvl = get("agglvl_code"), emp = num(get("month3_emplvl"));
    if (emp == null || emp <= 0) continue;
    const row = { fips: get("area_fips"), name: titles[get("area_fips")] || null, employment: emp,
      yoy_change: col("oty_month3_emplvl_chg") >= 0 ? num(get("oty_month3_emplvl_chg")) : null,
      weekly_wage: col("avg_wkly_wage") >= 0 ? num(get("avg_wkly_wage")) : null, period: get("year") + "-Q" + get("qtr") };
    if (/^7[5-8]$/.test(lvl)) counties.push(row); else if (/^5[5-8]$/.test(lvl)) states.push(row);
  }
  counties.sort((a, b) => b.employment - a.employment); states.sort((a, b) => b.employment - a.employment);
  if (!counties.length && !states.length) throw Error("no QCEW private-sector rows");
  return { counties, states };
}


export function parseWorldBank(json) {
  if (!Array.isArray(json) || !Array.isArray(json[1])) throw Error("unexpected World Bank response");
  const by = {};
  for (const r of json[1]) {
    const iso = r.countryiso3code || r.country?.id, v = typeof r.value === "number" ? r.value : null;
    if (!iso || v == null || !/^\d{4}$/.test(r.date || "")) continue;
    (by[iso] ||= { name: r.country?.value || iso, points: [] }).points.push({ year: Number(r.date), value: v });
  }
  for (const k of Object.keys(by)) by[k].points.sort((a, b) => a.year - b.year);
  return by;
}


export function parseUkDivisions(rows) {
  if (!Array.isArray(rows)) throw Error("unexpected UK Commons votes response");
  return rows.filter(r => r && Number.isFinite(Number(r.DivisionId)) && r.Title).map(r => ({
    id: Number(r.DivisionId), date: String(r.Date || "").slice(0, 10), number: r.Number ?? null, title: String(r.Title).slice(0, 300),
    ayes: num(r.AyeCount), noes: num(r.NoCount), url: "https://votes.parliament.uk/votes/commons/division/" + Number(r.DivisionId) }));
}


/** Minimal reader for a single-entry ZIP (Census Gazetteer files). Returns the first file's text. */
export function unzipFirst(buf) {
  const b = Buffer.from(buf);
  if (b.readUInt32LE(0) !== 0x04034b50) throw Error("not a zip file");
  const method = b.readUInt16LE(8), csize = b.readUInt32LE(18), nlen = b.readUInt16LE(26), xlen = b.readUInt16LE(28);
  const start = 30 + nlen + xlen;
  let size = csize;
  if (size === 0 || start + size > b.length) { // sizes in data descriptor: use the central directory instead
    const cd = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    if (cd < 0) throw Error("zip central directory missing");
    size = b.readUInt32LE(cd + 20);
  }
  const data = b.subarray(start, start + size);
  return (method === 0 ? data : zlib.inflateRawSync(data)).toString("utf8");
}
export function parseGazetteer(text) {
  const lines = String(text || "").trim().split(/\r?\n/);
  const head = lines.shift().split("\t").map(h => h.trim());
  const gi = head.indexOf("GEOID"), ni = head.indexOf("NAME"), ui = head.indexOf("USPS"), la = head.indexOf("INTPTLAT"), lo = head.indexOf("INTPTLONG");
  if (gi < 0 || la < 0 || lo < 0) throw Error("Gazetteer columns missing");
  const out = {};
  for (const line of lines) {
    const c = line.split("\t").map(x => x.trim()), lat = num(c[la]), lng = num(c[lo]);
    if (/^\d{5}$/.test(c[gi]) && lat != null && lng != null) out[c[gi]] = { lat, lng, name: ni >= 0 ? c[ni] + (ui >= 0 ? ", " + c[ui] : "") : null };
  }
  if (Object.keys(out).length < 1000) throw Error("too few Gazetteer counties");
  return out;
}
async function countyCentroids() {
  for (const y of [2025, 2024, 2023]) {
    try {
      const res = await fetch("https://www2.census.gov/geo/docs/maps-data/data/gazetteer/" + y + "_Gazetteer/" + y + "_Gaz_counties_national.zip", { headers: UA, signal: AbortSignal.timeout(60000) });
      if (!res.ok) continue;
      return { year: y, map: parseGazetteer(unzipFirst(Buffer.from(await res.arrayBuffer()))) };
    } catch (e) { warn("Gazetteer " + y + ": " + e.message); }
  }
  return null;
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
  const series = { HOUST: "US housing starts (thousands, SAAR)", PCOPPUSDM: "Global copper price (USD per metric ton)",
    XTEXVA01KRM667S: "Korea exports value (monthly, OECD MEI via FRED)", XTEXVA01JPM667S: "Japan exports value (monthly, OECD MEI via FRED)" };
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
async function chinaMofcom() {
  const pages = ["https://www.mofcom.gov.cn/zwgk/zcfb/index.html", "https://www.mofcom.gov.cn/"];
  const found = [];
  for (const u of pages) { try { found.push(...parseMofcomList(await (await get(u, 25000)).text())); } catch (e) { warn("MOFCOM " + u + ": " + e.message); } }
  if (!found.length) throw Error("no MOFCOM announcement links parsed (page layout may have changed)");
  const file = "cn-mofcom-announcements.json";
  let old = {}; try { old = JSON.parse(fs.readFileSync(path.join(OUT, file), "utf8")); } catch {}
  const byUrl = new Map((old.items || []).map(x => [x.url, x]));
  for (const x of found) byUrl.set(x.url, { ...(byUrl.get(x.url) || {}), ...x, date: x.date || byUrl.get(x.url)?.date || null });
  const items = [...byUrl.values()].sort((a, b) => String(b.number || b.date || "").localeCompare(String(a.number || a.date || ""), "en", { numeric: true })).slice(0, 500);
  writeJson(file, { source: "中华人民共和国商务部 · 政策发布", source_url: pages[0],
    note: "공고 제목·번호·원문 링크만 저장(본문 저장 안 함). export_control·targets는 제목 단어 기준 자동 분류라 원문 확인 필요. 이전 수집분은 누적 보관.",
    collected_at: now(), count: items.length, export_control_count: items.filter(x => x.export_control).length, items });
  return items.length + " items (export control " + items.filter(x => x.export_control).length + ")";
}


async function bisPolicyRates() {
  const areas = { KR: "한국은행 기준금리", JP: "일본은행 정책금리", CN: "중국인민은행 정책금리", TW: "대만 중앙은행 정책금리", GB: "영란은행 기준금리", US: "미국 연준 정책금리", XM: "유럽중앙은행 정책금리" };
  const keys = Object.keys(areas).join("+");
  const urls = ["https://stats.bis.org/api/v1/data/WS_CBPOL/M." + keys + "/all?format=csv&startPeriod=2015-01",
                "https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/M." + keys + "?format=csv&startPeriod=2015-01"];
  let by = null, used = null, last = null;
  for (const u of urls) { try { by = parseBisCsv(await (await get(u, 40000)).text()); used = u; break; } catch (e) { last = e; warn("BIS " + u + ": " + e.message); } }
  if (!by) throw last || Error("BIS fetch failed");
  const series = {};
  console.log("::notice::BIS_AREAS " + JSON.stringify(Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.length + " to " + v.at(-1).date]))));
  for (const [k, label] of Object.entries(areas)) if (by[k]) series[k] = { label: label + " (%)", points: by[k].slice(-140), latest: by[k].at(-1) };
  writeJson("policy-rates.json", { source: "Bank for International Settlements · Central bank policy rates (WS_CBPOL, monthly)", source_url: "https://data.bis.org/topics/CBPOL", api_url: used,
    note: "월말 기준 BIS 집계값. 각 중앙은행 발표 직후에는 반영이 늦을 수 있음.", collected_at: now(), series });
  return Object.keys(series).join(",");
}


async function fdaApprovals() {
  const since = new Date(Date.now() - 400 * 86400e3).toISOString().slice(0, 10);
  const range = since.replace(/-/g, "") + "+TO+" + new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const url = "https://api.fda.gov/drug/drugsfda.json?search=submissions.submission_type:ORIG+AND+submissions.submission_status:AP+AND+submissions.submission_status_date:[" + range + "]&limit=1000";
  const items = parseFdaApprovals(await (await get(url, 40000)).json(), since);
  if (items.length < 10) throw Error("too few FDA approvals parsed: " + items.length);
  writeJson("us-fda-approvals.json", { source: "U.S. FDA · openFDA Drugs@FDA API", source_url: "https://open.fda.gov/apis/drug/drugsfda/",
    note: "최근 약 13개월 신규 허가(ORIG·AP). novel=true는 신규 분자(제출 분류 TYPE 1). 기업·주가 영향은 단정하지 않음. openFDA는 FDA 공식 웹사이트와 지연·차이가 있을 수 있음.",
    collected_at: now(), since, count: items.length, novel_count: items.filter(x => x.novel).length, items });
  return items.length + " approvals (novel " + items.filter(x => x.novel).length + ")";
}


async function qcewJobs() {
  const industries = { "3344": "반도체·전자부품 제조", "3361": "자동차 제조", "3364": "항공우주 제품·부품 제조", "3254": "제약·의약품 제조", "3359": "기타 전기장비(배터리 포함) 제조" };
  const titles = {};
  try {
    const t = await (await get("https://data.bls.gov/cew/doc/titles/area/area_titles.csv", 40000)).text();
    for (const line of t.trim().split(/\r?\n/).slice(1)) { const c = csvRow(line); if (c[0]) titles[c[0]] = c[1]; }
  } catch (e) { warn("QCEW area titles: " + e.message); }
  const y = new Date().getUTCFullYear(), quarters = [];
  for (let yy = y; yy >= y - 2; yy--) for (let q = 4; q >= 1; q--) quarters.push([yy, q]);
  const out = {};
  for (const [code, label] of Object.entries(industries)) {
    for (const [yy, q] of quarters) {
      try {
        const res = await fetch("https://data.bls.gov/cew/data/api/" + yy + "/" + q + "/industry/" + code + ".csv", { headers: UA, signal: AbortSignal.timeout(40000) });
        if (!res.ok) continue;
        const { counties, states } = parseQcew(await res.text(), titles);
        out[code] = { label, period: yy + "-Q" + q, counties: counties.slice(0, 40), states: states.slice(0, 55),
          url: "https://data.bls.gov/cew/apps/table_maker/v4/table_maker.htm#type=2&year=" + yy + "&qtr=" + q + "&own=5&ind=" + code };
        break;
      } catch (e) { /* try the previous quarter */ }
    }
    if (!out[code]) warn("QCEW " + code + ": no recent quarter available");
  }
  if (!Object.keys(out).length) throw Error("no QCEW industry data");
  // Attach official county centroids (Census Gazetteer internal points) so the map can draw the counties.
  const cent = await countyCentroids();
  let placed = 0;
  if (cent) for (const v of Object.values(out)) for (const c of v.counties) { const g = cent.map[c.fips]; if (g) { c.lat = g.lat; c.lng = g.lng; placed++; } }
  else warn("county centroids unavailable; counties saved without coordinates");
  writeJson("us-jobs-by-county.json", { source: "U.S. Bureau of Labor Statistics · QCEW open data", source_url: "https://www.bls.gov/cew/additional-resources/open-data/",
    note: "민간 부문(own_code 5) 분기 3번째 달 고용. 비공개(disclosure N) 지역 제외. 카운티 lat/lng는 미국 인구조사국 Gazetteer 내부 대표점(카운티 중심 근처, 공장 위치 아님). 약 5~6개월 지연 발표.",
    coordinates_source: cent ? "U.S. Census Bureau Gazetteer " + cent.year + " counties (INTPTLAT/INTPTLONG)" : null,
    collected_at: now(), industries: out });
  return Object.entries(out).map(([k, v]) => k + "@" + v.period).join(",") + " · coords " + placed;
}


async function worldBankCountries() {
  const countries = "USA;CHN;JPN;KOR;DEU;GBR;FRA;NLD;IND;RUS;ITA;CAN;AUS;SAU;ISR;UKR;VNM;MEX;BRA";
  const indicators = { "NY.GDP.MKTP.CD": "GDP (current US$)", "NY.GDP.MKTP.KD.ZG": "GDP growth (annual %)", "SP.POP.TOTL": "Population",
    "NE.EXP.GNFS.ZS": "Exports of goods and services (% of GDP)", "FP.CPI.TOTL.ZG": "Inflation, consumer prices (annual %)",
    "MS.MIL.XPND.CD": "Military expenditure (current US$, SIPRI)", "MS.MIL.XPND.GD.ZS": "Military expenditure (% of GDP, SIPRI)" };
  const out = {};
  for (const [id, label] of Object.entries(indicators)) {
    try {
      const url = "https://api.worldbank.org/v2/country/" + countries + "/indicator/" + id + "?format=json&per_page=2000&mrv=8";
      const by = parseWorldBank(await (await get(url, 40000)).json());
      out[id] = { label, url: "https://data.worldbank.org/indicator/" + id, countries: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { name: v.name, latest: v.points.at(-1), points: v.points }])) };
    } catch (e) { warn("World Bank " + id + ": " + e.message); }
  }
  if (Object.keys(out).length < 3) throw Error("too few World Bank indicators");
  writeJson("country-profiles.json", { source: "World Bank Open Data API (군사비 지표의 원 출처는 SIPRI)", source_url: "https://data.worldbank.org/",
    note: "연간 자료, 1~2년 지연. 대만은 세계은행 자료에 없음.", collected_at: now(), indicators: out });
  return Object.keys(out).length + " indicators";
}


async function ukCommonsVotes() {
  const all = [];
  for (let skip = 0; skip < 200; skip += 25) {
    const url = "https://commonsvotes-api.parliament.uk/data/divisions.json/search?queryParameters.take=25&queryParameters.skip=" + skip;
    const rows = parseUkDivisions(await (await get(url)).json());
    all.push(...rows); if (rows.length < 25) break;
  }
  if (all.length < 10) throw Error("too few UK divisions: " + all.length);
  const file = "uk-commons-divisions.json";
  let old = {}; try { old = JSON.parse(fs.readFileSync(path.join(OUT, file), "utf8")); } catch {}
  const by = new Map((old.divisions || []).map(d => [d.id, d])); for (const d of all) by.set(d.id, d);
  const divisions = [...by.values()].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 1000);
  writeJson(file, { source: "UK Parliament · Commons Votes API", source_url: "https://commonsvotes-api.parliament.uk/swagger/ui/index",
    note: "하원 표결(division) 제목·날짜·찬반 수와 원문 링크. 의원별 표는 원문 링크에서 확인(다음 단계에서 저장 예정). 매일 누적.", collected_at: now(), count: divisions.length, divisions });
  return divisions.length + " divisions";
}

// European Parliament roll-call votes via HowTheyVote.eu (open data built from official EP records). Probe + store summaries.
async function euParliamentVotes() {
  const json = await (await get("https://howtheyvote.eu/api/votes?page_size=100", 40000)).json();
  const rows = Array.isArray(json) ? json : (json.results || json.data || []);
  const votes = rows.filter(v => v && v.id && (v.display_title || v.title)).map(v => ({ id: v.id, date: String(v.timestamp || v.date || "").slice(0, 10),
    title: String(v.display_title || v.title).slice(0, 300), result: v.result || null, url: "https://howtheyvote.eu/votes/" + v.id }));
  if (!votes.length) throw Error("no votes parsed; keys: " + Object.keys(json || {}).slice(0, 8).join(","));
  const file = "eu-parliament-votes.json";
  let old = {}; try { old = JSON.parse(fs.readFileSync(path.join(OUT, file), "utf8")); } catch {}
  const by = new Map((old.votes || []).map(d => [String(d.id), d])); for (const d of votes) by.set(String(d.id), d);
  const all = [...by.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 1500);
  writeJson(file, { source: "HowTheyVote.eu (European Parliament roll-call votes, built from official EP records)", source_url: "https://howtheyvote.eu/",
    note: "유럽의회 기명 표결 요약과 링크. 의원별 표는 링크에서 확인. 원 출처 유럽의회 공식 기록.", collected_at: now(), count: all.length, votes: all });
  return all.length + " votes";
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
  for (const [name, fn] of Object.entries({ taiwanRevenue, ecbRates, fredExtra, usTradeControls, chinaMofcom, bisPolicyRates, fdaApprovals, qcewJobs, worldBankCountries, ukCommonsVotes, euParliamentVotes })) {
    try { results[name] = "ok: " + await fn(); }
    catch (e) { results[name] = "FAILED: " + e.message; warn(name + " failed — previous file kept: " + e.message); }
  }
  console.log("::notice::RESULTS " + JSON.stringify(results));
  // Sample values so a reviewer can check the fetched numbers against the official sites without downloading artifacts.
  try {
    const rd = f => JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
    const tw = rd("tw-monthly-revenue.json"), ecb = rd("ecb-rates.json"), fr = rd("fred-extra.json");
    const cn = (() => { try { return rd("cn-mofcom-announcements.json").items.slice(0, 3).map(x => x.number + " " + x.title.slice(0, 50)); } catch { return null; } })();
    const pr = (() => { try { return Object.fromEntries(Object.entries(rd("policy-rates.json").series).map(([k, v]) => [k, v.latest])); } catch { return null; } })();
    const fda = (() => { try { const f = rd("us-fda-approvals.json"); return { count: f.count, novel: f.novel_count, latest: f.items.filter(x => x.novel).slice(0, 2).map(x => x.date + " " + x.brand.join("/") + " · " + x.sponsor) }; } catch { return null; } })();
    const jobs = (() => { try { const f = rd("us-jobs-by-county.json"); return Object.fromEntries(Object.entries(f.industries).map(([k, v]) => [k, v.period + " top: " + (v.counties[0] ? v.counties[0].name + " " + v.counties[0].employment : "-")])); } catch { return null; } })();
    const wb = (() => { try { const f = rd("country-profiles.json").indicators; return { KOR_gdp: f["NY.GDP.MKTP.CD"]?.countries?.KOR?.latest, KOR_mil_pct: f["MS.MIL.XPND.GD.ZS"]?.countries?.KOR?.latest, USA_mil: f["MS.MIL.XPND.CD"]?.countries?.USA?.latest }; } catch { return null; } })();
    const votes = (() => { const o = {}; try { o.uk = rd("uk-commons-divisions.json").divisions.slice(0, 2).map(d => d.date + " " + d.title.slice(0, 60) + " " + d.ayes + ":" + d.noes); } catch {} try { o.eu = rd("eu-parliament-votes.json").votes.slice(0, 2).map(d => d.date + " " + d.title.slice(0, 60)); } catch {} return o; })();
    const sample = { votes, wb, jobs, fda, policy_rates: pr, cn, tw_month: tw.latest_month, tsmc: tw.history?.["2330"]?.points?.at(-1), mediatek: tw.history?.["2454"]?.points?.at(-1),
      ecb: Object.fromEntries(Object.entries(ecb.series || {}).map(([k, v]) => [k, v.latest])), fred: Object.fromEntries(Object.entries(fr.series || {}).map(([k, v]) => [k, v.latest])) };
    console.log("::notice::SAMPLE " + JSON.stringify(sample));
  } catch (e) { warn("sample summary unavailable: " + e.message); }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "status.json"), JSON.stringify({ results }, null, 1) + "\n");
  if (["taiwanRevenue", "ecbRates", "fredExtra", "usTradeControls"].every(k => String(results[k]).startsWith("FAILED"))) process.exit(1);
}
