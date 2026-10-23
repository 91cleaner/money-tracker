"""데이터 검증 게이트 단위 테스트. 과거에 실제로 났던 버그를 회귀 사례로 넣는다.
실행: python -m unittest discover -s tests"""
import copy, json, os, sys, tempfile, unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "collector"))
import kw, validate  # noqa: E402


def row(no, title="도로 포장 공사", amount=1000, ord_="00", date="2026-10-20", odate="2026-10-20", cat="건설·공사", kind="공사"):
    return {"id": no + ord_, "no": no, "ord": ord_, "title": title, "amount": amount, "date": date, "odate": odate, "cat": cat, "kind": kind, "atype": "본청"}


def ids(n, ord_="00", title="진해구 정수지 청소 용역"):
    return [{"no": f"S{i}", "ord": ord_, "a": 100, "d": "2026-10-20", "t": title} for i in range(n)]


BASE = {
    "city": {"a": {"rows": [row("A1"), row("A2", "청사 청소 용역", cat="청소", kind="용역")], "changes": [row("A9", ord_="01", odate=None)]},
             "b": {"rows": [row("S0", "정수지 청소 용역", cat="청소", kind="용역"), row("S1", "정수지 청소 용역", cat="청소", kind="용역"),
                            row("S2", "정수지 청소 용역", cat="청소", kind="용역")], "changes": []}},
    "sole": {"comp": [{"kw": "청소", "city": "b", "cn": 3, "small": False, "ids": ids(3)}]},
    "fest": {"rev_none": 1, "top": [{"nm": "x", "rev": None, "rr": None}, {"nm": "y", "rev": 5, "rr": 1.0}], "zero": []},
}


def build(spec, d):
    os.makedirs(os.path.join(d, "city"), exist_ok=True)
    cities = []
    for slug, c in spec["city"].items():
        json.dump(c, open(os.path.join(d, "city", slug + ".json"), "w"), ensure_ascii=False)
        cities.append({"slug": slug, "count": len(c["rows"]), "total": sum(r["amount"] for r in c["rows"]), "changes": len(c["changes"]),
                       **spec.get("idx_over", {}).get(slug, {})})
    json.dump({"updated": "2026-10-23T10:00", "days": 90, "cities": cities}, open(os.path.join(d, "index.json"), "w"))
    daily = {}
    for slug, c in spec["city"].items():
        m = daily.setdefault(slug, {})
        for r in c["rows"]:
            e = m.setdefault(r.get("odate") or r["date"], [0, 0, {}]); e[0] += 1; e[1] += r["amount"]
            ce = e[2].setdefault(r["cat"], [0, 0]); ce[0] += 1; ce[1] += r["amount"]
    if not spec.get("no_daily"):
        json.dump({"last": "2026-10-23", "c": daily}, open(os.path.join(d, "daily.json"), "w"), ensure_ascii=False)
    json.dump(spec["sole"], open(os.path.join(d, "sec_sole.json"), "w"), ensure_ascii=False)
    json.dump(spec["fest"], open(os.path.join(d, "sec_fest.json"), "w"), ensure_ascii=False)


class Gate(unittest.TestCase):
    def run_gate(self, mut=None, prev=None):
        s = copy.deepcopy(BASE)
        if mut: mut(s)
        with tempfile.TemporaryDirectory() as d, tempfile.TemporaryDirectory() as p:
            build(s, d)
            if prev: build(prev, p)
            return validate.check(d, p if prev else None)

    def assertTag(self, mut, tag):
        err, _ = self.run_gate(mut)
        self.assertTrue(any(tag in e for e in err), err)

    def test_clean(self):
        self.assertEqual(self.run_gate()[0], [])

    def test_1_duplicate_contract(self):
        self.assertTag(lambda s: s["city"]["b"]["rows"].append(row("A1")), "[1 중복]")

    def test_2_milyang_change_order_in_totals(self):
        # 밀양 버그: 기간 전에 맺은 계약의 변경(ord 01+)이 신규 합계에 섞임
        self.assertTag(lambda s: s["city"]["a"]["rows"].append(row("M1", ord_="03", odate=None)), "[2 기간 전 변경분]")
        self.assertTag(lambda s: s["city"]["a"]["rows"].append(row("M2", ord_="01", odate="2025-01-02")), "[2 기간 전 변경분]")

    def test_2_sole_from_changes(self):
        # 원주/서울/용인 1위가 changes 에서 나온 버그
        def m(s):
            s["sole"]["comp"][0]["ids"][0]["no"] = "A9"
        self.assertTag(m, "changes")

    def test_3_category_false_positive(self):
        self.assertTag(lambda s: s["city"]["a"]["rows"].append(row("F1", "청소년 수련관 운영", cat="청소", kind="용역")), "[3 오탐]")
        self.assertTag(lambda s: s["city"]["a"]["rows"].append(row("F2", "보안등 교체", cat="경비", kind="공사")), "[3 오탐]")
        self.assertTag(lambda s: s["city"]["a"]["rows"].append(row("F3", "서초소방서 구급 장비", cat="시설관리", kind="물품")), "[3 오탐]")

    def test_3_sole_false_positive(self):
        def jinhae(s):  # '진해구청 소류지' → 공백 제거 시 '청소' 오탐 (창원 R26TA02339293)
            s["sole"]["comp"][0]["ids"][0]["t"] = "진해구청 소류지 수생식물 제거 및 환경정비 용역"
        self.assertTag(jinhae, "[3 오탐]")
        def term(s):
            s["sole"]["comp"][0]["ids"][1]["t"] = "2026년 연간 청소 단가계약"
        self.assertTag(term, "[3 오탐]")
        def asc(s):
            s["sole"]["comp"].append({"kw": "아스콘 포장", "city": "b", "cn": 3, "small": False, "ids": ids(3, title="폐아스콘 처리 용역")})
        self.assertTag(asc, "[3 오탐]")

    def test_4_small_sample(self):
        def m(s):
            s["sole"]["comp"][0].update(cn=2, ids=ids(2))
        self.assertTag(m, "[4 표본]")

    def test_4_ord(self):
        self.assertTag(lambda s: s["sole"]["comp"][0]["ids"][0].update(ord="01"), "차수")

    def test_5_index_mismatch(self):
        self.assertTag(lambda s: s.setdefault("idx_over", {}).update(a={"total": 1}), "[5 합계]")
        self.assertTag(lambda s: s.setdefault("idx_over", {}).update(a={"changes": 0}), "[5 합계]")

    def test_17_daily_matches(self):
        self.assertTag(lambda s: s.update(no_daily=True), "[17 일별 집계]")

    def test_6_rev_none_zero_regression(self):
        def m(s):
            s["fest"].update(n=417, rev_none=0)
        self.assertTag(m, "[6 null]")

    def test_6_null_not_zero(self):
        self.assertTag(lambda s: s["fest"]["top"].append({"nm": "z", "rev": None, "rr": 0}), "[6 null]")
        self.assertTag(lambda s: s["fest"]["zero"].append({"nm": "z", "rev": None}), "[6 null]")

    def test_7_swing_warns_not_fails(self):
        prev = copy.deepcopy(BASE)
        prev["city"]["a"]["rows"][0]["amount"] = 100000
        err, warn = self.run_gate(prev=prev)
        self.assertEqual(err, [])
        self.assertTrue(any("[7 급변]" in w for w in warn))


class Keywords(unittest.TestCase):
    def test_kw(self):
        self.assertFalse(kw.hit("청소년 문화의집", "청소"))
        self.assertFalse(kw.hit("보안등 정비", "보안"))
        self.assertFalse(kw.hit("통제초소 설치", "제초"))
        self.assertFalse(kw.hit("대행사업 위탁", "행사"))
        self.assertTrue(kw.hit("공원 제초 작업", "제초"))

    def test_sole(self):
        self.assertTrue(kw.sole_hit("○○공사 건설 재해예방 기술지도", "건설재해예방"))
        self.assertTrue(kw.sole_hit("○○공사 재해예방 기술지도 용역", "건설재해예방"))
        self.assertFalse(kw.sole_hit("진해구청 소류지 수생식물 제거", "청소"))
        self.assertFalse(kw.sole_hit("폐아스콘 처리 용역", "아스콘 포장"))
        self.assertTrue(kw.sole_hit("폐아스콘 처리 용역", "폐아스콘 처리"))
        self.assertFalse(kw.sole_hit("아스콘 절삭 후 덧씌우기 폐기물처리용역", "아스콘 포장"))
        self.assertFalse(kw.sole_hit("2026년 공공청사 청소 연간 단가계약", "청소"))


class Fields(unittest.TestCase):
    def test_jv_flag(self):
        import collect
        self.assertTrue(collect.jv_flag("Y")); self.assertTrue(collect.jv_flag("공동"))
        self.assertFalse(collect.jv_flag("N")); self.assertIsNone(collect.jv_flag(None))

    def test_sido(self):
        import collect
        self.assertEqual(collect.sido_fix("경북 포항시"), "경상북도 포항시")
        self.assertEqual(collect.sido_fix("경기"), "경기도")
        self.assertEqual(collect.sido_fix("강원도 춘천시"), "강원특별자치도 춘천시")
        self.assertEqual(collect.sido_fix("서울특별시 중구"), "서울특별시 중구")

    def test_agency(self):
        import collect
        self.assertEqual(collect.agency_type("서울시설공단", {"short": "서울"}), "산하기관")
        self.assertEqual(collect.agency_type("서울특별시 서울시립대학교 산학협력단", {"short": "서울"}), "산하기관")
        self.assertEqual(collect.agency_type("인천광역시 소방본부", {"short": "인천"}), "소방")
        self.assertEqual(collect.agency_type("서울특별시 서대문구", {"short": "서울"}), "자치구")
        self.assertEqual(collect.agency_type("경상남도 창원시 성산구", {"short": "경남 창원시"}), "일반구")
        self.assertEqual(collect.agency_type("경기도 안성시", {"short": "경기 안성시"}), "본청")


class Coverage(unittest.TestCase):
    """감사에서 찾은 문제: 9/24~10/19 수집 공백, jv 0%, lt 전부 비어 있음, 원계약 없는 변경 차수, 비공식 시도 이름."""
    def big(self, gap=False, jv=True, lt=True):
        rows = []
        import datetime as D
        d = D.date(2026, 9, 21)
        k = 0
        while d <= D.date(2026, 10, 23):
            if d.weekday() < 5 and not (gap and D.date(2026, 9, 28) <= d <= D.date(2026, 10, 16)):
                for i in range(30):
                    k += 1
                    r = row(f"N{k}", date=d.isoformat(), odate=d.isoformat())
                    r["jv"] = jv and i == 0; r["jvm"] = [{"name": "a"}, {"name": "b"}] if r["jv"] else []
                    r["lt"] = ("장기계속" if i == 1 else "단년도") if lt else None
                    rows.append(r)
            d += D.timedelta(days=1)
        return {"city": {"a": {"rows": rows, "changes": []}}, "sole": {"comp": []}, "fest": {"rev_none": 0}}

    def gate(self, spec):
        with tempfile.TemporaryDirectory() as d:
            build(spec, d)
            return validate.check(d)[0]

    def test_ok(self):
        self.assertEqual(self.gate(self.big()), [])

    def test_gap(self):
        self.assertTrue(any("[8 수집 공백]" in e for e in self.gate(self.big(gap=True))))

    def test_jv_zero(self):
        self.assertTrue(any("[9 공동도급]" in e for e in self.gate(self.big(jv=False))))

    def test_lt_none(self):
        self.assertTrue(any("[9 장기계속]" in e for e in self.gate(self.big(lt=False))))

    def test_jv_without_members(self):
        s = self.big(); s["city"]["a"]["rows"][0]["jvm"] = []
        self.assertTrue(any("참여 업체" in e for e in self.gate(s)))
        s["city"]["a"]["rows"][0]["jvp"] = True  # 조회 대기 표시가 있으면 경고만
        self.assertFalse(any("참여 업체" in e for e in self.gate(s)))

    def test_change_without_original(self):
        s = self.big(); s["city"]["a"]["rows"][0].update(ord="01", hist=[])
        self.assertTrue(any("[10 원계약]" in e for e in self.gate(s)))

    def test_sido_name(self):
        s = self.big(); s["city"]["a"]["rows"][0]["vregion"] = "경북 포항시"
        self.assertTrue(any("[11 시도]" in e for e in self.gate(s)))


class Lofin(unittest.TestCase):
    def test_empty_revenue_is_null(self):
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "collector", "sections"))
        from lofin import parse_rev
        self.assertIsNone(parse_rev({"biz_ern_amt": ""}))
        self.assertIsNone(parse_rev({"biz_ern_amt": None}))
        self.assertIsNone(parse_rev({}))
        self.assertIsNone(parse_rev({"biz_ern_amt": 0}))  # 17:17 회귀: 숫자 0 이 0원으로 들어감
        self.assertEqual(parse_rev({"biz_ern_amt": "0"}), 0)
        self.assertEqual(parse_rev({"biz_ern_amt": "1200"}), 1200)


if __name__ == "__main__":
    unittest.main()
