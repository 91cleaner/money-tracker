import importlib.util
import os
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("ctl", os.path.join(ROOT, "scripts", "collect_congress_timeline.py"))
ctl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ctl)


class TimelineTest(unittest.TestCase):
    def test_bill_events(self):
        rows = [{"n": "A Act", "no": "HR 1", "d": "2026-01-02", "a": "Became Public Law No: 1.", "ad": "2026-03-04", "law": 1, "pass": 1, "u": "https://www.congress.gov/x"},
                {"n": "B Act", "no": "S 2", "d": "2026-02-02", "a": "Referred", "ad": "2026-02-02", "law": 0, "pass": 0, "u": None}]
        ev = ctl.bill_events(rows)
        self.assertEqual(sorted(e["k"] for e in ev), ["intro", "intro", "law"])

    def test_parse_member_votes(self):
        d = {"houseRollCallVoteMemberVotes": {"voteQuestion": "On Passage", "legislationType": "HR", "legislationNumber": "5",
             "results": [{"bioguideID": "A000001", "voteCast": "Yea"}, {"bioguideID": "B000002", "voteCast": "Not Voting"}, {"bioguideID": "C1", "voteCast": "???"}]}}
        info, cast = ctl.parse_member_votes(d)
        self.assertEqual(cast, {"A000001": "Y", "B000002": "X"})
        e = ctl.vote_event(1, 7, info, {"startDate": "2025-05-06T10:00:00-04:00"}, "Y")
        self.assertEqual((e["d"], e["no"], e["u"]), ("2025-05-06", "HR 5", "https://clerk.house.gov/Votes/20257"))

    def test_no_causal_or_advice_words(self):
        src = open(os.path.join(ROOT, "scripts", "collect_congress_timeline.py"), encoding="utf-8").read()
        for w in ("때문에", "추천"):
            self.assertNotIn(w, src.replace("원인·평가 문구 없음", ""))


if __name__ == "__main__":
    unittest.main()
