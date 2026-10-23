"""제목 키워드 매칭: 단순 부분 문자열로 잡으면 틀리는 경우를 막는다.
예) '청소' ⊂ '청소년', '보안' ⊂ '보안등'·'버스정보안내기', '제초' ⊂ '통제초소', '행사' ⊂ '대행사업'·'이행사업',
'소방' ⊂ '○○소방서'(기관 이름), '시설관리' ⊂ '○○시설관리공단'(기관 이름)."""
import re

_RX = {
    "청소": r"청소(?!년)",
    "보안": r"(?<!정)보안(?!등)",
    "제초": r"(?<!통)제초(?!소)",
    "행사": r"(?<![대이])행사",
    "소방": r"소방(?!서|본부|도로)",
    "시설관리": r"시설관리(?!공단)",
    "인쇄": r"(?<!고)인쇄",
    "기기": r"(?<!동)기기",
}
_C = {k: re.compile(v) for k, v in _RX.items()}


def hit(title, w):
    t = title or ""
    c = _C.get(w)
    return bool(c.search(t)) if c else (w in t)


# 수의계약 비교(sec_sole) 분야. 원래 제목(띄어쓰기 그대로)에 맞춘다.
# 여러 낱말 표현만 \s* 로 띄어쓰기를 허용한다. 제목 전체 공백을 지우면
# '진해구청 소류지' → '진해구청소류지' 처럼 낱말 경계를 넘어 '청소'가 잡히는 오탐이 생긴다.
SOLE_SECT = [
    ("건설재해예방", r"재해\s*예방\s*(기술\s*)?지도|건설\s*재해\s*예방", None),
    ("긴급누수", r"긴급\s*누수", None),
    ("아스콘 포장", r"아스콘", r"폐\s*아스콘|폐기물"),
    ("폐아스콘 처리", r"폐\s*아스콘", None),
    ("폐기물", r"폐기물", None),
    ("방역", r"방역", None),
    ("CCTV", r"CCTV", None),
    ("청소", r"청소(?!년)", None),
    ("제초", r"(?<!통)제초(?!소)", None),
    ("가로등", r"가로등", None),
    ("안전점검", r"안전\s*점검", None),
]
SOLE_TERM = re.compile(r"단가|연간|년간|연중|1년|12개월|반기|분기")  # 1년·반기 단가계약은 단건 일과 섞지 않음
_SOLE = {k: (re.compile(i, re.I), re.compile(x) if x else None) for k, i, x in SOLE_SECT}


def sole_hit(title, sector):
    t = title or ""
    i, x = _SOLE[sector]
    return bool(i.search(t)) and not (x and x.search(t)) and not SOLE_TERM.search(t)

SOLE_SECT_NAMES = {k for k, _, _ in SOLE_SECT}
