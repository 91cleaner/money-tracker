"""수집 데이터에 남은 지번·개인 이름의 재마스킹 회귀 테스트."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "collector"))
from collect import ADDR_RX, mask_addr  # noqa: E402
from mask_names import walk  # noqa: E402


class StoredTitlePrivacy(unittest.TestCase):
    def test_legacy_open_bids_addresses_masked(self):
        titles = [
            "보행자전용도로(이매동 127-11 등) 정비공사 폐기물처리용역",
            "영주시 조와동 618-2 세천 교량 수해복구공사",
            "경기도 양주시 덕계동 474-6 해체공사",
        ]
        payload = {"items": [{"title": t} for t in titles]}
        hits = []
        walk(payload, hits)
        self.assertEqual(len(hits), len(titles))
        for row in payload["items"]:
            self.assertIsNone(ADDR_RX.search(row["title"]), row["title"])
            self.assertIn("○", row["title"])
        second = []
        walk(payload, second)
        self.assertEqual(second, [], "재실행 시 같은 제목이 다시 바뀌면 안 됨")

    def test_nested_titles_and_names(self):
        payload = {"items": [{"t": "도련2동 328 외 상수도 긴급 누수복구 공사",
                              "detail": "피아니스트 손열음 리사이틀",
                              "metadata": "조와동 618-2"}]}
        hits = []
        walk(payload, hits)
        self.assertEqual(payload["items"][0]["t"], "도련2동 ○○○ 외 상수도 긴급 누수복구 공사")
        self.assertEqual(payload["items"][0]["detail"], "피아니스트 ○○○ 리사이틀")
        self.assertEqual(payload["items"][0]["metadata"], "조와동 618-2")
        self.assertEqual(len(hits), 2)

    def test_road_names_not_broken(self):
        for title in ("봉곡로111번길 급수폐전공사", "삼계본동2길 외 3개소 긴급누수복구공사"):
            self.assertEqual(mask_addr(title), title)


if __name__ == "__main__":
    unittest.main()
