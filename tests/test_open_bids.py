import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "collector", "sections"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "collector"))
import open_bids as ob  # noqa: E402


def ts(dd):
    return (datetime.now(ob.KST) + timedelta(days=dd)).strftime("%Y-%m-%d %H:%M:%S")


class OpenBids(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.d, "data", "city"))
        json.dump({"cities": [{"slug": "sangju", "name": "상주시", "short": "경북 상주시"}, {"slug": "seoul", "name": "서울특별시", "short": "서울"}]},
                  open(os.path.join(self.d, "data", "index.json"), "w"), ensure_ascii=False)
        json.dump({"city": {"slug": "sangju", "name": "상주시", "short": "경북 상주시", "province": "경상북도"}, "rows": [{"inst": "상주시보건소"}]},
                  open(os.path.join(self.d, "data", "city", "sangju.json"), "w"), ensure_ascii=False)
        json.dump({"city": {"slug": "seoul", "name": "서울특별시", "short": "서울", "province": "서울특별시"}, "rows": []},
                  open(os.path.join(self.d, "data", "city", "seoul.json"), "w"), ensure_ascii=False)
        self.items = {
            "Servc": [
                {"bidNtceNo": "R26BK1", "bidNtceOrd": "000", "bidNtceNm": "시청 청사 청소 용역", "ntceInsttNm": "경상북도 상주시", "bidClseDt": ts(2), "presmptPrce": "50000000", "bidNtceDtlUrl": "u1", "ntceKindNm": "등록공고"},
                {"bidNtceNo": "R26BK2", "bidNtceOrd": "000", "bidNtceNm": "지난 공고", "ntceInsttNm": "경상북도 상주시", "bidClseDt": ts(-1)},
                {"bidNtceNo": "R26BK3", "bidNtceOrd": "000", "bidNtceNm": "다른 지역", "ntceInsttNm": "전라남도 순천시", "bidClseDt": ts(3)},
                {"bidNtceNo": "R26BK4", "bidNtceOrd": "001", "bidNtceNm": "보건소 소독", "ntceInsttNm": "조달청", "dminsttNm": "상주시보건소", "bidClseDt": ts(1)},
                {"bidNtceNo": "R26BK5", "bidNtceOrd": "000", "bidNtceNm": "구청 경비", "ntceInsttNm": "서울특별시 강남구", "bidClseDt": ts(5)},
            ],
            "Cnstwk": [], "Thng": [],
        }

    def run_once(self):
        def fake(op, **q):
            it = self.items[op]
            return it, len(it)
        with mock.patch.object(ob, "ROOT", self.d), mock.patch.object(ob, "OUT", os.path.join(self.d, "data", "open_bids.json")), \
                mock.patch.object(ob, "K", "k"), mock.patch.object(ob, "get", fake):
            ob.main()
        return json.load(open(os.path.join(self.d, "data", "open_bids.json"), encoding="utf-8"))

    def test_keeps_only_open_bids_of_our_cities(self):
        out = self.run_once()
        got = {x["no"]: x["slug"] for x in out["items"]}
        self.assertEqual(got, {"R26BK1": "sangju", "R26BK4": "sangju", "R26BK5": "seoul"})
        one = next(x for x in out["items"] if x["no"] == "R26BK1")
        self.assertEqual((one["cat"], one["price"], one["kind"]), ("청소", 50000000, "용역"))
        self.assertEqual([x["no"] for x in out["items"]][0], "R26BK4")  # 마감 임박 순

    def test_cancel_notice_removes(self):
        self.run_once()
        self.items["Servc"] = [{"bidNtceNo": "R26BK1", "bidNtceOrd": "001", "bidNtceNm": "시청 청사 청소 용역", "ntceInsttNm": "경상북도 상주시", "bidClseDt": ts(2), "ntceKindNm": "취소공고"}]
        out = self.run_once()
        self.assertNotIn("R26BK1", {x["no"] for x in out["items"]})


if __name__ == "__main__":
    unittest.main()
