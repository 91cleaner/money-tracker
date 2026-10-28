import test from "node:test";
import assert from "node:assert/strict";
import { rocMonth, parseTwRevenue, parseCsvSeries, parseFedRegDocs, parseMofcomList, parseBisCsv, csvRow, parseFdaApprovals, parseQcew, parseWorldBank, parseUkDivisions, unzipFirst, parseGazetteer, parseCustomsXml } from "../scripts/collect-market-factors.mjs";

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

test("CSV rows keep quoted commas together", () => {
  assert.deepEqual(csvRow('M,"TW:Taiwan, China",2026-09,"2,000"'), ["M", "TW:Taiwan, China", "2026-09", "2,000"]);
  const out = parseBisCsv('FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE\nM,"XM:Euro area, 20",2026-09,2.15\n');
  assert.deepEqual(out.XM, [{ date: "2026-09", value: 2.15 }]);
});

test("openFDA approvals keep original approvals in range and flag novel molecules", () => {
  const json = { results: [
    { application_number: "NDA219999", sponsor_name: "ACME", products: [{ brand_name: "NEWDRUG", active_ingredients: [{ name: "XYZ" }] }],
      submissions: [{ submission_type: "ORIG", submission_status: "AP", submission_status_date: "20260915", submission_class_code: "TYPE 1" }, { submission_type: "SUPPL", submission_status: "AP", submission_status_date: "20261001" }] },
    { application_number: "ANDA200000", sponsor_name: "GEN", products: [{ brand_name: "OLD" }], submissions: [{ submission_type: "ORIG", submission_status: "AP", submission_status_date: "20240101" }] },
    { application_number: "BLA761234", sponsor_name: "BIO", products: [], submissions: [{ submission_type: "ORIG", submission_status: "AP", submission_status_date: "20261010", submission_class_code: "TYPE 5" }] } ] };
  const out = parseFdaApprovals(json, "2025-09-01");
  assert.deepEqual(out.map(x => [x.application, x.date, x.novel]), [["BLA761234", "2026-10-10", false], ["NDA219999", "2026-09-15", true]]);
  assert.match(out[1].url, /ApplNo=219999$/);
  assert.throws(() => parseFdaApprovals({}, "2025-01-01"), /unexpected/);
});

test("QCEW keeps private-sector county/state rows and drops undisclosed ones", () => {
  const csv = ['"area_fips","own_code","industry_code","agglvl_code","size_code","year","qtr","disclosure_code","month3_emplvl","avg_wkly_wage","oty_month3_emplvl_chg"',
    '"04013","5","3344","76","0","2026","1","","21000","2900","1500"',
    '"48453","5","3344","76","0","2026","1","N","0","0","0"',
    '"04000","5","3344","56","0","2026","1","","30000","2800","2000"',
    '"04013","1","3344","76","0","2026","1","","50","1000","0"'].join("\n");
  const out = parseQcew(csv, { "04013": "Maricopa County, Arizona" });
  assert.deepEqual(out.counties, [{ fips: "04013", name: "Maricopa County, Arizona", employment: 21000, yoy_change: 1500, weekly_wage: 2900, period: "2026-Q1" }]);
  assert.equal(out.states[0].employment, 30000);
  assert.throws(() => parseQcew("a,b\n1,2"), /missing/);
});

test("World Bank rows group by ISO3 and skip empty values", () => {
  const json = [{ page: 1 }, [
    { countryiso3code: "KOR", country: { id: "KR", value: "Korea, Rep." }, date: "2024", value: 2.6 },
    { countryiso3code: "KOR", country: { id: "KR", value: "Korea, Rep." }, date: "2025", value: null },
    { countryiso3code: "KOR", country: { id: "KR", value: "Korea, Rep." }, date: "2023", value: 2.8 } ]];
  const by = parseWorldBank(json);
  assert.deepEqual(by.KOR.points, [{ year: 2023, value: 2.8 }, { year: 2024, value: 2.6 }]);
  assert.throws(() => parseWorldBank({ message: "x" }), /unexpected/);
});

test("UK Commons divisions keep id, date, title, counts and official link", () => {
  const out = parseUkDivisions([{ DivisionId: 2001, Date: "2026-10-21T00:00:00", Number: 300, Title: "Finance Bill: Third Reading", AyeCount: 320, NoCount: 180 }, { Title: "no id" }]);
  assert.deepEqual(out, [{ id: 2001, date: "2026-10-21", number: 300, title: "Finance Bill: Third Reading", ayes: 320, noes: 180, url: "https://votes.parliament.uk/votes/commons/division/2001" }]);
  assert.throws(() => parseUkDivisions({}), /unexpected/);
});

test("single-entry zip reader and Gazetteer parser", async () => {
  const zlib = await import("node:zlib");
  const rows = ["USPS\tGEOID\tANSICODE\tNAME\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG"];
  for (let i = 0; i < 1100; i++) rows.push("AZ\t" + String(4000 + i).padStart(5, "0") + "\t1\tCounty " + i + "\t1\t1\t1\t1\t33.3\t-112.4");
  const text = rows.join("\n"), raw = zlib.deflateRawSync(Buffer.from(text));
  const name = Buffer.from("g.txt"), h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(8, 8); h.writeUInt32LE(raw.length, 18); h.writeUInt32LE(text.length, 22); h.writeUInt16LE(name.length, 26);
  const zip = Buffer.concat([h, name, raw]);
  assert.equal(unzipFirst(zip), text);
  const g = parseGazetteer(text);
  assert.deepEqual(g["04013"], { lat: 33.3, lng: -112.4, name: "County 13, AZ" });
  assert.throws(() => unzipFirst(Buffer.from("nope")), /not a zip/);
});

test("Korea customs XML parses months and fails on API error codes", () => {
  const ok = "<response><header><resultCode>00</resultCode></header><body><items><item><year>2026.09</year><hsCd>854231</hsCd><expDlr>1000</expDlr><impDlr>200</impDlr></item><item><year>총계</year></item></items></body></response>";
  assert.deepEqual(parseCustomsXml(ok), [{ month: "2026-09", hs: "854231", exp_usd: 1000, imp_usd: 200 }]);
  assert.throws(() => parseCustomsXml("<resultCode>30</resultCode><resultMsg>SERVICE KEY IS NOT REGISTERED ERROR.</resultMsg>"), /30/);
});
