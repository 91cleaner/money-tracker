"""관제실 주제 규칙: 법안 제목(한국어·영어·일본어·중국어) → 주제, 주제 → 관련 시세·지도 위치.

규칙은 모두 여기 있는 낱말 목록뿐이다(보이지 않는 가중치·AI 판단 없음). 화면에도 '어떤 낱말로 묶었는지'를 보여 줄 수 있다.
위치는 공개적으로 알려진 기관·산업 단지의 대략적 좌표다(지도 이동용, 측량 좌표 아님).
"""

PARLIAMENTS = {
    "kr": {"name": "대한민국 국회", "lat": 37.5318, "lng": 126.9140},
    "us": {"name": "미국 의회(워싱턴 D.C.)", "lat": 38.8899, "lng": -77.0091},
    "jp": {"name": "일본 국회(도쿄 나가타초)", "lat": 35.6759, "lng": 139.7450},
    "tw": {"name": "대만 입법원(타이베이)", "lat": 25.0441, "lng": 121.5194},
    "eu": {"name": "유럽의회(브뤼셀)", "lat": 50.8386, "lng": 4.3753},
}
REGION_LABEL = {"kr": "한국", "us": "미국", "jp": "일본", "tw": "대만", "eu": "유럽(EU)"}
REGION_WORDS = {
    "kr": ["한국", "대한민국", "korea", "국회", "韓国", "韓國"],
    "us": ["미국", "usa", "us", "america", "미 의회", "congress", "米国", "美國"],
    "jp": ["일본", "japan", "日本"],
    "tw": ["대만", "taiwan", "台湾", "台灣", "臺灣"],
    "eu": ["유럽", "eu", "europe", "european", "유럽연합", "欧州", "歐盟"],
}

# id: label, words(법안 제목 낱말, 소문자 비교), query(검색어로만 쓰는 추가 낱말), tags(시세 태그), anchors(지도 위치)
TOPICS = [
    {"id": "semiconductor", "label": "반도체", "words": ["반도체", "semiconductor", "chips act", "chip ", "chips", "半導体", "半導體", "晶片", "積體電路", "wafer"],
     "query": ["칩", "엔비디아", "tsmc", "삼성전자", "하이닉스", "asml", "파운드리"], "tags": ["semiconductor"],
     "anchors": [{"name": "신주 과학단지(TSMC 본사 지역)", "lat": 24.7736, "lng": 121.0105, "cc": "tw"},
                 {"name": "평택 반도체 단지(삼성전자)", "lat": 37.0206, "lng": 127.0587, "cc": "kr"},
                 {"name": "구마모토 기쿠요(TSMC 일본 공장 지역)", "lat": 32.8836, "lng": 130.8270, "cc": "jp"},
                 {"name": "애리조나 피닉스(TSMC 미국 공장 지역)", "lat": 33.7700, "lng": -112.0919, "cc": "us"},
                 {"name": "펠트호번(ASML 본사)", "lat": 51.4057, "lng": 5.4161, "cc": "eu"}]},
    {"id": "ai", "label": "인공지능·데이터", "words": ["인공지능", "artificial intelligence", " ai ", "(ai)", "ai act", "人工知能", "人工智慧", "人工智能", "생성형", "algorithm", "알고리즘", "데이터센터", "data center"],
     "query": ["ai", "인공지능", "엔비디아", "챗gpt", "데이터"], "tags": ["ai"],
     "anchors": [{"name": "산타클라라(엔비디아 본사)", "lat": 37.3708, "lng": -121.9637, "cc": "us"}]},
    {"id": "trade", "label": "관세·무역·수출통제", "words": ["관세", "tariff", "무역", "trade", "수출통제", "export control", "export administration", "関税", "貿易", "輸出", "關稅", "出口管制", "customs", "anti-dumping", "반덤핑", "free trade", "자유무역"],
     "query": ["관세", "무역", "수출", "트럼프 관세", "미중"], "tags": ["trade", "industrial", "fx"],
     "anchors": [{"name": "로스앤젤레스·롱비치 항만", "lat": 33.7540, "lng": -118.2160, "cc": "us"},
                 {"name": "부산항", "lat": 35.1040, "lng": 129.0400, "cc": "kr"}]},
    {"id": "energy", "label": "에너지·원전·석유", "words": ["에너지", "energy", "원자력", "원전", "nuclear", "석유", "oil", "가스", "natural gas", "전력", "electricity", "エネルギー", "原子力", "電力", "能源", "核能", "電業", "lng"],
     "query": ["유가", "원유", "전기요금"], "tags": ["energy"],
     "anchors": [{"name": "쿠싱(WTI 원유 인도 거점)", "lat": 35.9850, "lng": -96.7670, "cc": "us"}]},
    {"id": "climate", "label": "기후·재생에너지·탄소", "words": ["탄소", "carbon", "기후", "climate", "재생에너지", "renewable", "태양광", "solar", "풍력", "wind", "온실가스", "greenhouse", "emission", "脱炭素", "再生可能", "溫室", "再生能源", "淨零", "net-zero", "net zero"],
     "query": ["탄소중립", "친환경"], "tags": ["clean_energy"], "anchors": []},
    {"id": "battery_ev", "label": "배터리·전기차", "words": ["배터리", "이차전지", "battery", "batteries", "전기차", "전기자동차", "electric vehicle", "蓄電池", "電気自動車", "電動車", "電池", "charging", "충전"],
     "query": ["2차전지", "테슬라", "lg에너지", "리튬"], "tags": ["battery", "ev"],
     "anchors": [{"name": "오스틴(테슬라 기가팩토리 텍사스)", "lat": 30.2220, "lng": -97.6170, "cc": "us"}]},
    {"id": "defense", "label": "국방·방산", "words": ["국방", "방위", "방산", "군사", "defense", "defence", "military", "armed forces", "national security", "防衛", "国防", "國防", "軍", "兵役", "missile", "미사일", "무기", "weapon"],
     "query": ["전쟁", "방산주", "한화에어로", "록히드"], "tags": ["defense"],
     "anchors": [{"name": "펜타곤(미 국방부)", "lat": 38.8719, "lng": -77.0563, "cc": "us"}]},
    {"id": "finance", "label": "금융·은행·자본시장", "words": ["금융", "은행", "자본시장", "증권", "financial", "bank", "securities", "investment", "金融", "銀行", "証券", "證券", "保險", "insurance", "보험"],
     "query": ["주식시장", "증시"], "tags": ["finance"],
     "anchors": [{"name": "뉴욕증권거래소(월가)", "lat": 40.7069, "lng": -74.0113, "cc": "us"}]},
    {"id": "crypto", "label": "가상자산·디지털화폐", "words": ["가상자산", "암호화폐", "디지털자산", "crypto", "digital asset", "stablecoin", "스테이블코인", "blockchain", "블록체인", "暗号資産", "虛擬資產", "虛擬通貨"],
     "query": ["비트코인", "코인", "이더리움"], "tags": ["crypto"], "anchors": []},
    {"id": "rates", "label": "금리·통화정책", "words": ["금리", "interest rate", "monetary", "federal reserve", "중앙은행", "한국은행", "日本銀行", "中央銀行", "利率", "inflation", "물가"],
     "query": ["연준", "fed", "기준금리", "인플레이션"], "tags": ["rates", "finance"],
     "anchors": [{"name": "연방준비제도(워싱턴 D.C.)", "lat": 38.8928, "lng": -77.0458, "cc": "us"}]},
    {"id": "housing", "label": "주택·부동산", "words": ["주택", "부동산", "전세", "임대차", "housing", "mortgage", "real estate", "住宅", "不動産", "房屋", "租賃", "rent"],
     "query": ["집값", "전세사기", "아파트"], "tags": ["housing"], "anchors": []},
    {"id": "health", "label": "의료·제약·바이오", "words": ["의료", "약사", "의약품", "바이오", "health", "drug", "medicare", "medicaid", "pharmaceutical", "医療", "医薬", "醫療", "藥", "健保", "vaccine", "백신"],
     "query": ["제약", "신약", "비만약"], "tags": ["health"], "anchors": []},
    {"id": "auto", "label": "자동차", "words": ["자동차", "automobile", "motor vehicle", "自動車", "汽車", "車輛"],
     "query": ["현대차", "도요타"], "tags": ["auto"], "anchors": []},
    {"id": "shipbuilding", "label": "조선·해운", "words": ["조선", "해운", "shipbuilding", "maritime", "shipping", "造船", "海運", "航運"],
     "query": ["조선주", "선박"], "tags": ["shipbuilding"],
     "anchors": [{"name": "울산(HD현대중공업)", "lat": 35.5062, "lng": 129.4370, "cc": "kr"}]},
    {"id": "cross_strait", "label": "대만·중국 관계", "words": ["대만", "taiwan", "중국", "china", "chinese", "兩岸", "台湾", "中国", "中國", "大陸", "cross-strait", "uyghur", "hong kong", "홍콩"],
     "query": ["양안", "미중"], "tags": ["semiconductor", "market"],
     "anchors": [{"name": "대만 해협", "lat": 24.4, "lng": 119.6, "cc": "tw"}]},
]
