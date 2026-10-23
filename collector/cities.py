"""전국 시 단위 목록 (특별·광역·특별자치시 + 도 소속 시 + 제주 행정시).

slug: 사이트 주소에 쓰는 영문 이름. province: 소속 시·도. match: 수요기관명에서 이 시를 알아보는 접두어들.
"""

METRO = [
    ("seoul", "서울특별시", "서울", ["서울특별시", "서울시"]),
    ("busan", "부산광역시", "부산", ["부산광역시", "부산시"]),
    ("daegu", "대구광역시", "대구", ["대구광역시", "대구시"]),
    ("incheon", "인천광역시", "인천", ["인천광역시", "인천시"]),
    ("gwangju", "광주광역시", "광주", ["광주광역시"]),
    ("daejeon", "대전광역시", "대전", ["대전광역시", "대전시"]),
    ("ulsan", "울산광역시", "울산", ["울산광역시", "울산시"]),
    ("sejong", "세종특별자치시", "세종", ["세종특별자치시", "세종시"]),
]

PROVINCE_CITIES = {
    "경기도": [("suwon", "수원시"), ("seongnam", "성남시"), ("goyang", "고양시"), ("yongin", "용인시"), ("bucheon", "부천시"),
              ("ansan", "안산시"), ("anyang", "안양시"), ("namyangju", "남양주시"), ("hwaseong", "화성시"), ("pyeongtaek", "평택시"),
              ("uijeongbu", "의정부시"), ("siheung", "시흥시"), ("paju", "파주시"), ("gimpo", "김포시"), ("gwangmyeong", "광명시"),
              ("gwangju-gg", "광주시"), ("gunpo", "군포시"), ("hanam", "하남시"), ("osan", "오산시"), ("icheon", "이천시"),
              ("anseong", "안성시"), ("uiwang", "의왕시"), ("yangju", "양주시"), ("guri", "구리시"), ("pocheon", "포천시"),
              ("dongducheon", "동두천시"), ("gwacheon", "과천시"), ("yeoju", "여주시")],
    "강원특별자치도": [("chuncheon", "춘천시"), ("wonju", "원주시"), ("gangneung", "강릉시"), ("donghae", "동해시"),
                  ("taebaek", "태백시"), ("sokcho", "속초시"), ("samcheok", "삼척시")],
    "충청북도": [("cheongju", "청주시"), ("chungju", "충주시"), ("jecheon", "제천시")],
    "충청남도": [("cheonan", "천안시"), ("gongju", "공주시"), ("boryeong", "보령시"), ("asan", "아산시"), ("seosan", "서산시"),
              ("nonsan", "논산시"), ("gyeryong", "계룡시"), ("dangjin", "당진시")],
    "전북특별자치도": [("jeonju", "전주시"), ("gunsan", "군산시"), ("iksan", "익산시"), ("jeongeup", "정읍시"),
                  ("namwon", "남원시"), ("gimje", "김제시")],
    "전라남도": [("mokpo", "목포시"), ("yeosu", "여수시"), ("suncheon", "순천시"), ("naju", "나주시"), ("gwangyang", "광양시")],
    "경상북도": [("pohang", "포항시"), ("gyeongju", "경주시"), ("gimcheon", "김천시"), ("andong", "안동시"), ("gumi", "구미시"),
              ("yeongju", "영주시"), ("yeongcheon", "영천시"), ("sangju", "상주시"), ("mungyeong", "문경시"), ("gyeongsan", "경산시")],
    "경상남도": [("changwon", "창원시"), ("jinju", "진주시"), ("tongyeong", "통영시"), ("sacheon", "사천시"), ("gimhae", "김해시"),
              ("miryang", "밀양시"), ("geoje", "거제시"), ("yangsan", "양산시")],
    "제주특별자치도": [("jeju", "제주시"), ("seogwipo", "서귀포시")],
}
PROVINCE_SHORT = {"경기도": "경기", "강원특별자치도": "강원", "충청북도": "충북", "충청남도": "충남", "전북특별자치도": "전북",
                  "전라남도": "전남", "경상북도": "경북", "경상남도": "경남", "제주특별자치도": "제주"}
PROVINCE_ALIASES = {"강원특별자치도": ["강원특별자치도", "강원도"], "전북특별자치도": ["전북특별자치도", "전라북도"]}


def all_cities():
    out = []
    for slug, name, short, match in METRO:
        out.append({"slug": slug, "name": name, "short": short, "province": name, "match": match, "metro": True})
    for prov, cities in PROVINCE_CITIES.items():
        provs = PROVINCE_ALIASES.get(prov, [prov])
        for slug, name in cities:
            match = [f"{p} {name}" for p in provs] + [f"{p}{name}" for p in provs]
            # '광주시' 단독 표기는 광주광역시와 헷갈리므로 도 이름이 붙은 것만 인정
            if name != "광주시":
                match.append(name)
            out.append({"slug": slug, "name": name, "short": f"{PROVINCE_SHORT[prov]} {name}", "province": prov, "match": match, "metro": False})
    return out


CITIES = all_cities()

# 2026-07-01 전남광주통합특별시 출범(광주광역시·전라남도 폐지, 시·군·구 이름은 그대로).
# 이 사이트는 시 단위로 보므로, 새 이름을 옛 광주(5개 구)·전남(시·군) 구분으로 되돌려 묶는다.
JNGJ = ("전남광주통합특별시", "광주특별시")
JNGJ_GU = ("동구", "서구", "남구", "북구", "광산구")


def legacy(name):
    """'전남광주통합특별시 서구' → '광주광역시 서구', '전남광주통합특별시 나주시' → '전라남도 나주시'.
    통합특별시 본청·청사·본부(시·군·구가 안 붙은 것)는 광주·전남 어느 한 시의 돈으로 볼 수 없어 빼고 원래 이름을 그대로 둔다."""
    if not name:
        return name
    n = str(name).strip()
    for p in JNGJ:
        if n.startswith(p):
            rest = n[len(p):].strip()
            t = rest.split()[0] if rest else ""
            g = next((x for x in JNGJ_GU if t == x or (t.startswith(x) and not t.startswith(x[:-1] + "청"))), None)
            if g:
                return "광주광역시 " + rest
            if t[-1:] in ("시", "군") and len(t) >= 2:
                return "전라남도 " + rest
            if t.startswith("광주청사"):
                return "광주광역시 " + rest  # 광주청사 계약은 옛 광주 몫으로 본다(무안·동부청사 등은 제외)
            return n  # 통합특별시 본청·청사·본부: 옛 광주·전남 어느 시에도 넣지 않음
    return n
EXCLUDE_WORDS = ["교육청", "교육지원청", "경찰청", "경찰서"]


def city_of(institution_name):
    """수요기관명 → 시 slug. 교육청·국가기관·공기업 등은 제외."""
    if not institution_name:
        return None
    n = legacy(institution_name.strip())
    if any(w in n for w in EXCLUDE_WORDS):
        return None
    best = None
    for c in CITIES:
        for m in c["match"]:
            if n.startswith(m) and (best is None or len(m) > best[1]):
                best = (c["slug"], len(m))
    return best[0] if best else None


if __name__ == "__main__":
    print(len(CITIES))
    for t in ["인천광역시 종합건설본부", "경기도 광주시", "광주광역시 북구", "경기도 수원시 장안구", "수원시", "경기도교육청 수원교육지원청",
              "강원도 춘천시", "전남광주통합특별시 북구", "전남광주통합특별시 목포시", "전남광주통합특별시", "전남광주통합특별시 무안군", "제주특별자치도 서귀포시", "서울특별시 강남구", "한국도로공사"]:
        print(t, "→", city_of(t))
