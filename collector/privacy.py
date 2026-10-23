"""업체명 가리기: 회사 표시 없이 2~3글자 한글이고 흔한 성으로 시작하면 사람 이름일 수 있어 '개인사업자'로 바꾼다."""
import re

MASK = "개인사업자"
MARKERS = ("주식회사", "(주)", "㈜", "유한", "합자", "합명", "법인", "협동조합", "조합", "협회", "재단", "공사", "공단", "상사", "상회", "건설",
           "기업", "엔지니어링", "산업", "조경", "환경", "전기", "통신", "기획", "테크", "텍", "광고", "측량", "기계", "설비", "개발", "종합",
           "디자인", "컨설팅", "시스템", "중기", "교육", "메디", "팜", "가든", "세상", "필터", "월드", "인쇄", "기술", "전력", "에너지", "토건",
           "토목", "건축", "인테리어", "센터", "연구", "공업", "물산", "기공", "전설", "수도", "컴퍼니", "솔루션", "정보", "사", "청", "원", "소")
SURNAMES = set("김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예봉경사부황보")


def mask(name):
    n = (name or "").strip()
    if not n or n == MASK:
        return n
    if re.fullmatch(r"[가-힣]{2,3}", n) and n[0] in SURNAMES and not any(m in n for m in MARKERS):
        return MASK
    return name


def _bunji(m):
    t = m.group(0)
    return " 외" if t.endswith("외") else (" 일원" if ("일원" in t or "일대" in t) else " ")


def loc(s):
    """계약명 속 지번·도로명 건물번호를 지운다(동·리·로 이름은 남김). assets/mask.js 와 같은 규칙."""
    if not isinstance(s, str):
        return s
    s = re.sub(r"\s?(산\s?)?\d+(-\d+)?\s?번지\s?(선|일원|일대|외)?", _bunji, s)
    s = re.sub(r"(^|[\s(가-힣])(산\s?)?\d+(-\d+)?\s?(일원|일대)", r"\1 일원", s)
    s = re.sub(r"([가-힣](?:동|리))\s?(산\s?)?\d+(-\d+)?(?=[\s,()·\]]|외|일원|주변|$)", r"\1", s)
    s = re.sub(r"([로길])\s?\d+(-\d+)?(?=[\s,()·]|$)", r"\1", s)
    s = re.sub(r"(^|[\s(])(산\s?)?\d{1,5}-\d{1,5}(?=[\s,()·]|$)", r"\1", s)
    s = re.sub(r"\s{2,}", " ", s)
    return re.sub(r"\s+([,)\]])", r"\1", s).strip()


try:
    import hanja as _hj
except ImportError:  # 라이브러리가 없으면 한자 이름을 그대로 둔다
    _hj = None
_CJK = re.compile(r"[\u4e00-\u9fff\uf900-\ufaff]")


def kor(name):
    """한자 업체명에 한글 읽기를 붙인다: '九一綜合建設' → '九一綜合建設 (구일종합건설)'. 이미 붙어 있으면 그대로."""
    if not name or _hj is None or not _CJK.search(re.sub(r"\([^)]*\)", "", name)) or re.search(r"\([가-힣\s]+\)\s*$", name):
        return name
    k = _hj.translate(name, "substitution")
    return f"{name} ({k})" if k != name else name


def korify(o):
    """저장 직전: name/vendor 필드의 한자 업체명에 한글 읽기를 붙인다(요약·순위·흐름·검색 공통)."""
    if isinstance(o, list):
        return [korify(x) for x in o]
    if isinstance(o, dict):
        return {k: (kor(v) if k in ("name", "vendor") and isinstance(v, str) else korify(v)) for k, v in o.items()}
    return o


# 축제 공연·섭외 계약: 공연 용역만 (공사·보수·시설·무대장치 제작은 뺌). 출연자 이름은 절대 저장·표시하지 않는다.
FEST_CAT = "축제 공연·섭외"
_FEST_IN = re.compile(r"공연|출연|섭외|콘서트|축하공연|초청가수|아티스트")
_FEST_OUT = re.compile(r"공사|보수|시설|무대장치\s*제작|무대\s*제작")
_FEST_CUT = re.compile(r"(초청\s*가수|가수|아티스트|출연자|출연진|출연|섭외|게스트)")


def is_fest(title, kind):
    t = title or ""
    if kind and ("공사" in kind or "물품" in kind):
        return False
    return bool(_FEST_IN.search(t)) and not _FEST_OUT.search(t)


def fest_title(title):
    """출연자 이름이 들어갈 수 있는 부분(괄호·따옴표 안, '가수/아티스트/섭외' 뒤)을 지우고 '공연·섭외 용역'으로 끝맺는다."""
    t = title or ""
    if t.endswith("[공연·섭외 용역]"):
        return t
    t = re.sub(r"[\(\[「『<〈《\"'“‘][^\)\]」』>〉》\"'”’]*[\)\]」』>〉》\"'”’]", " ", t)
    m = _FEST_CUT.search(t)
    if m:
        t = t[:m.start()]
    t = re.sub(r"\s+", " ", t).strip(" ·-,/")
    return (t + " " if t else "") + "[공연·섭외 용역]"
