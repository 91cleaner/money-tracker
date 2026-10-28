import test from "node:test";
import assert from "node:assert/strict";
import { rocMonth, parseTwRevenue, parseCsvSeries, parseFedRegDocs, parseMofcomList, parseBisCsv } from "../scripts/collect-market-factors.mjs";

test("ROC year-month converts to ISO month", () => {
  assert.equal(rocMonth("11509"), "2026-09");
  assert.equal(rocMonth("11413"), null);
  assert.equal(rocMonth(""), null);
});

test("TWSE monthly revenue rows parse with published values only", () => {
  const row = (code, rev) => ({ "出表日期": "1151010", "資料年月": "11509", "公司代號": code, "公司名稱": "公司" + code, "產業別": "半導體業",
    "營業收入-當月營收": rev, "營業收入-上月營收": "100", "營業收入-去年當月營收": "80", "營業收入-上月比較增減(%)": "5.5", "營業收入-去年同月增減(%)": "-", "累計營業收入-當月累計營收": "1,000" });
  const rows = Array.from({ length: 120 }, (_, i) => row(String(1100 + i), "1,234"));
  rows.push({ "公司代號": "bad", "資料年月": "11509" });
  const out = parseTwRevenue(rows);
  assert.equal(out.length, 120);
  assert.deepEqual(out[0], { code: "1100", name: "公司1100", industry: "半導體業", month: "2026-09", revenue: 1234, prev_month: 100, last_year: 80, mom_pct: 5.5, yoy_pct: null, ytd: 1000 });
  assert.throws(() => parseTwRevenue(rows.slice(0, 50)), /size/);
});

test("ECB / FRED CSV parsing keeps real observations only", () => {
  const ecb = "KEY,FREQ,TIME_PERIOD,OBS_VALUE\nFM.D,D,2026-10-01,2.00\nFM.D,D,2026-10-02,\nFM.D,D,2026-10-03,1.75\n";
  assert.deepEqual(parseCsvSeries(ecb, "TIME_PERIOD", "OBS_VALUE"), [{ date: "2026-10-01", value: 2 }, { date: "2026-10-03", value: 1.75 }]);
  const fred = "observation_date,HOUST\n2026-08-01,1300\n2026-09-01,.\n";
  assert.deepEqual(parseCsvSeries(fred, "observation_date", "HOUST"), [{ date: "2026-08-01", value: 1300 }]);
  assert.throws(() => parseCsvSeries("a,b\n1,2", "TIME_PERIOD", "OBS_VALUE"), /columns/);
});

test("Federal Register trade documents are tagged by title words only", () => {
  const json = { results: [
    { document_number: "2026-1", title: "Additions to the Entity List", abstract: "entities in the People's Republic of China", type: "Rule", publication_date: "2026-10-20", html_url: "https://www.federalregister.gov/documents/2026/10/20/2026-1/x" },
    { document_number: "2026-2", title: "Notice of Action: Section 301", abstract: "", type: "Notice", publication_date: "2026-10-19", html_url: "https://www.federalregister.gov/documents/2026/10/19/2026-2/y" },
    { document_number: "2026-3", title: "Bad link", html_url: "https://evil.example/x" } ] };
  const out = parseFedRegDocs(json, "BIS");
  assert.equal(out.length, 2);
  assert.deepEqual([out[0].china, out[0].entity_list, out[0].tariff], [true, true, false]);
  assert.deepEqual([out[1].china, out[1].entity_list, out[1].tariff], [false, false, true]);
  assert.throws(() => parseFedRegDocs({}, "BIS"), /unexpected/);
});

test("MOFCOM policy list parses announcement numbers and export-control tags from titles", () => {
  const html = `<ul><li><a href="/zwgk/zcfb/art/2026/art_9ce3.html" target="_blank">商务部 海关总署公告2026年第50号 公布对盾构机等物项实施出口管制的决定</a><span>2026-10-20</span></li>
  <li><a href="https://www.mofcom.gov.cn/zwgk/zcfb/art/2026/art_aaaa.html">商务部公告2026年第23号 公布将10家美国实体列入出口管制管控名单决定</a></li>
  <li><a href="/zwgk/zcfb/art/2026/art_9ce3.html">dup</a><a href="/other/page.html">商务部公告 other</a></li></ul>`;
  const out = parseMofcomList(html);
  assert.equal(out.length, 2);
  assert.deepEqual([out[0].number, out[0].date, out[0].export_control], ["2026-50", "2026-10-20", true]);
  assert.equal(out[0].url, "https://www.mofcom.gov.cn/zwgk/zcfb/art/2026/art_9ce3.html");
  assert.deepEqual(out[1].targets, ["美国"]);
});

test("BIS policy-rate CSV groups observations by country", () => {
  const csv = "FREQ:Frequency,REF_AREA:Reference area,TIME_PERIOD:Time period,OBS_VALUE:Value\nM:Monthly,KR:Korea,2026-08,2.75\nM:Monthly,KR:Korea,2026-09,3.00\nM:Monthly,JP:Japan,2026-09,0.75\nM:Monthly,JP:Japan,2026-10,NaN\n";
  const out = parseBisCsv(csv.replace("FREQ:Frequency,REF_AREA:Reference area,TIME_PERIOD:Time period,OBS_VALUE:Value", "FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE"));
  assert.deepEqual(out.KR.at(-1), { date: "2026-09", value: 3 });
  assert.equal(out.JP.length, 1);
  assert.throws(() => parseBisCsv("A,B\n1,2"), /columns/);
});
