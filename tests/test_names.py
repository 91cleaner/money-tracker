"""계약명 인명 가리기. collector/privacy.names 와 assets/mask.js maskN 이 같다.

실행: python -m unittest tests.test_names
"""
import json, os, shutil, subprocess, unittest

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "collector"))
from privacy import names  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
# (입력, privacy.names 와 maskN 이 같이 내야 하는 결과)
CASES = [
    ("이균영 작가 기념시설 조성 기본구상 용역", "이균영 작가 기념시설 조성 기본구상 용역"),
    ("초청 김철수 공원 정비", "초청 김철수 공원 정비"),
    ("최경주 골프꿈나무 지원행사 진행 용역", "○○○ 골프꿈나무 지원행사 진행 용역"),
    ("지장물 철거(김철수)", "지장물 철거(○○○)"),
    ("연오랑세오녀 파크골프장 지장물 철거(2차)(윤문준)", "연오랑세오녀 파크골프장 지장물 철거(2차)(○○○)"),
    ("꿈나무도서관 점검", "꿈나무도서관 점검"),
    ("송파꿈나무 인쇄 계약", "송파꿈나무 인쇄 계약"),
    ("국공립 서희꿈나무어린이집 외벽 보수", "국공립 서희꿈나무어린이집 외벽 보수"),
    ("서초꿈나무보금자리주택 현관경사로", "서초꿈나무보금자리주택 현관경사로"),
    ("어린이 식품안전 꿈나무 교실", "어린이 식품안전 꿈나무 교실"),
    ("(꿈나무, 광적, 남면, 장흥)", "(꿈나무, 광적, 남면, 장흥)"),
    ("피아니스트 손열음 리사이틀", "피아니스트 ○○○ 리사이틀"),
    ("2026년 제2차 인문학 강의(홍지민과 함께하는 꿈과 음악여행) 강사운영 용역", "2026년 제2차 인문학 강의(○○○과 함께하는 꿈과 음악여행) 강사운영 용역"),
]


def mask_js(titles):
    node = shutil.which("node")
    if not node:
        return None
    script = r"""
const fs = require('fs');
const window = { Response: function(){} };
window.Response.prototype = { json(){ return Promise.resolve(null); } };
global.window = window; global.Response = window.Response;
eval(fs.readFileSync(process.argv[1], 'utf8'));
const titles = JSON.parse(fs.readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(titles.map((t) => window.maskN(t))));
"""
    proc = subprocess.run([node, "-e", script, os.path.join(ROOT, "assets", "mask.js")],
                          input=json.dumps(titles, ensure_ascii=False), text=True, capture_output=True)
    if proc.returncode != 0:
        raise AssertionError(proc.stderr)
    return json.loads(proc.stdout)


class Names(unittest.TestCase):
    def test_keep_before_memorial_and_park(self):
        self.assertEqual(names("이균영 작가 기념시설 조성 기본구상 용역"), "이균영 작가 기념시설 조성 기본구상 용역")
        self.assertEqual(names("초청 김철수 공원 정비"), "초청 김철수 공원 정비")

    def test_mask_before_kkumnamu_player_scholarship(self):
        self.assertEqual(names("최경주 골프꿈나무 지원행사 진행 용역"), "○○○ 골프꿈나무 지원행사 진행 용역")

    def test_mask_name_in_land_clearance_parens(self):
        self.assertEqual(names("지장물 철거(김철수)"), "지장물 철거(○○○)")
        self.assertEqual(names("연오랑세오녀 파크골프장 지장물 철거(2차)(윤문준)"), "연오랑세오녀 파크골프장 지장물 철거(2차)(○○○)")

    def test_plain_kkumnamu_stays(self):
        for t in ("꿈나무도서관 점검", "송파꿈나무 인쇄 계약", "국공립 서희꿈나무어린이집 외벽 보수",
                  "서초꿈나무보금자리주택 현관경사로", "어린이 식품안전 꿈나무 교실", "(꿈나무, 광적, 남면, 장흥)"):
            self.assertEqual(names(t), t)

    def test_mask_js_matches_data_side(self):
        got = mask_js([a for a, _ in CASES])
        if got is None:
            self.skipTest("node 없음")
        for (src, want), js in zip(CASES, got):
            self.assertEqual(names(src), want, src)
            self.assertEqual(js, want, src)


if __name__ == "__main__":
    unittest.main()
