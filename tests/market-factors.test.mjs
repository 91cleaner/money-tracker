import test from "node:test";
import assert from "node:assert/strict";
import { rocMonth, parseTwRevenue, parseCsvSeries } from "../scripts/collect-market-factors.mjs";

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
