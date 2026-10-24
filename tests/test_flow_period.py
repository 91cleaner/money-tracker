"""기간별 업체 소재지 흐름.

전체 기간 합은 data/flows.json 과 같고, 어느 시·어느 기간이든 local ≤ known ≤ total(data/daily.json).
밀양 최근 30일은 도시 합계(이 스냅샷에서 199억)를 넘지 않는다.
실행: python -m unittest tests.test_flow_period
"""
import json, os, subprocess, unittest

ROOT = os.path.join(os.path.dirname(__file__), "..")
os.sys.path.insert(0, os.path.join(ROOT, "collector"))
import flows  # noqa: E402

DATA = os.path.join(ROOT, "data")


def _eok(n):
    """assets/dive.js krw 의 억 단위 반올림(100억 이상)."""
    a = abs(n)
    if a < 1e8 or a / 1e8 < 100:
        return None
    return int(a / 1e8 + 0.5)


class FlowPeriod(unittest.TestCase):
    def test_windows_match_flows_and_daily(self):
        err = flows.period_errors(DATA)
        self.assertEqual(err, [], "\n".join(err))

    def test_miryang_30_days_within_city_total(self):
        dl = json.load(open(os.path.join(DATA, "daily.json"), encoding="utf-8"))
        fd = json.load(open(os.path.join(DATA, "flow_daily.json"), encoding="utf-8"))
        fl = json.load(open(os.path.join(DATA, "flows.json"), encoding="utf-8"))
        fr, to = flows.window_of(dl, 30)
        lo, kn, dest = flows.sum_flow_window(fd, "miryang", fr, to)
        wt = sum(v[1] for day, v in dl["c"]["miryang"].items() if fr <= day <= to)
        whole = fl["cities"]["miryang"]
        self.assertLessEqual(lo, kn)
        self.assertLessEqual(kn, wt)
        self.assertLess(kn, whole["known"])
        self.assertLessEqual(dest.get("경남 밀양시", [0])[0], wt)
        # 이 자료(2026-10-24, 30일 합 19863897747원)는 화면에 199억으로 나온다.
        if dl.get("last") == "2026-10-24" and wt == 19863897747:
            self.assertEqual(_eok(wt), 199)
            self.assertEqual(kn, wt)
            self.assertLess(dest["경남 밀양시"][0], whole["local"])

    def test_js_fixflows_same_rules(self):
        r = subprocess.run(["node", os.path.join(os.path.dirname(__file__), "check_flow_period.js")], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + "\n" + r.stderr)


if __name__ == "__main__":
    unittest.main()
