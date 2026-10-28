"""Regression: a bill's introduction date is not its enactment date."""
import importlib.util
import pathlib
import sys
import unittest
from datetime import date, timedelta

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "collector" / "world" / "build_flow.py"
spec = importlib.util.spec_from_file_location("mt_world_flow", SCRIPT)
flow = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = flow
spec.loader.exec_module(flow)


class WorldFlowDates(unittest.TestCase):
    def test_introduction_date_never_substitutes_for_passage(self):
        for cc, st in (("kr", "원안가결"), ("us", "Became Public Law No: 119-1"),
                       ("jp", "成立"), ("tw", "三讀通過")):
            with self.subTest(cc=cc):
                self.assertEqual(flow.event_date(cc, {"st": st, "d": "2024-01-10", "sd": ""}), "")

    def test_uses_verified_status_action_date(self):
        for cc, st in (("kr", "수정가결"), ("us", "Signed by President"),
                       ("jp", "成立"), ("tw", "三讀")):
            with self.subTest(cc=cc):
                self.assertEqual(flow.event_date(cc, {"st": st, "d": "2024-01-10", "sd": "2024-06-20"}), "2024-06-20")

    def test_eu_uses_adopted_act_document_date(self):
        self.assertEqual(flow.event_date("eu", {"st": "adopted", "d": "2024-05-01", "sd": ""}), "2024-05-01")

    def test_unpassed_or_invalid_or_future_dates_never_create_events(self):
        self.assertEqual(flow.event_date("kr", {"st": "계류", "d": "2024-01-10", "sd": "2024-06-20"}), "")
        for bad in ("", "unknown", "2024-02-30", (date.today() + timedelta(days=1)).isoformat()):
            with self.subTest(day=bad):
                self.assertEqual(flow.event_date("us", {"st": "Signed by President", "d": "2024-01-10", "sd": bad}), "")


if __name__ == "__main__":
    unittest.main()
