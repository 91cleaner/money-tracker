"""Plain type labels for foreign policy items (no translation of titles).
Built only from the item's kind, department and feed category -- never from guessing the title's meaning.
Free machine translation (Argos) was tested on 2026-10-30 and gave wrong meanings, so titles stay original behind the link."""
JP_DEPT = {"厚生労働省": ("후생노동성(보건·노동 담당 부처)", "Ministry of Health, Labour and Welfare"), "経済産業省": ("경제산업성(산업·무역 담당 부처)", "Ministry of Economy, Trade and Industry"),
  "農林水産省": ("농림수산성(농업·수산 담당 부처)", "Ministry of Agriculture, Forestry and Fisheries"), "総務省": ("총무성(행정·통신 담당 부처)", "Ministry of Internal Affairs and Communications"),
  "国土交通省": ("국토교통성(국토·교통 담당 부처)", "Ministry of Land, Infrastructure, Transport and Tourism"), "環境省": ("환경성(환경 담당 부처)", "Ministry of the Environment"),
  "国税庁": ("국세청(세금 담당 기관)", "National Tax Agency"), "文部科学省": ("문부과학성(교육·과학 담당 부처)", "Ministry of Education, Culture, Sports, Science and Technology"),
  "個人情報保護委員会": ("개인정보보호위원회", "Personal Information Protection Commission"), "出入国在留管理庁": ("출입국재류관리청(출입국 담당 기관)", "Immigration Services Agency"),
  "法務省": ("법무성(법 담당 부처)", "Ministry of Justice"), "海上保安庁": ("해상보안청(바다 경비 기관)", "Japan Coast Guard"), "資源エネルギー庁": ("자원에너지청(에너지 담당 기관)", "Agency for Natural Resources and Energy"),
  "水産庁": ("수산청(수산 담당 기관)", "Fisheries Agency"), "金融庁": ("금융청(금융 감독 기관)", "Financial Services Agency"), "内閣府": ("내각부", "Cabinet Office"), "財務省": ("재무성(나라 살림 담당 부처)", "Ministry of Finance"),
  "外務省": ("외무성(외교 담당 부처)", "Ministry of Foreign Affairs"), "防衛省": ("방위성(국방 담당 부처)", "Ministry of Defense"), "消費者庁": ("소비자청", "Consumer Affairs Agency"), "デジタル庁": ("디지털청", "Digital Agency")}
KANTEI = {"総理の一日": ("일본 총리의 하루 일정 소식", "Japan PM's daily activities"), "総理の発表": ("일본 총리 발표", "Statement by the Japanese PM"), "総理会見": ("일본 총리 기자회견", "Japanese PM's press conference"),
  "長官会見": ("일본 관방장관(정부 대변인) 기자회견", "Japan Chief Cabinet Secretary press conference")}
EU = {"regulation": ("EU 규칙(모든 회원국에 바로 적용되는 법)", "EU regulation"), "decision": ("EU 결정(정해진 대상에 적용되는 법)", "EU decision"),
  "directive": ("EU 지침(회원국이 따라서 자기 법을 만들어야 해요)", "EU directive"), "press": ("EU 집행위원회 보도자료", "European Commission press release")}
def label(cc, b):
    k, d = b.get("kind"), b.get("dept") or ""
    if cc == "jp":
        if k == "pubcomment":
            ko, en = JP_DEPT.get(d, ("일본 정부 부처", "Japanese government ministry"))
            return f"일본 {ko}의 의견 모집 공고(새 규칙 초안에 국민 의견을 받아요)", f"{en}: public comment request on a draft rule"
        ko, en = KANTEI.get(b.get("cat") or "", ("일본 총리 관저 새 소식", "News from the Japanese PM's office"))
        return ko, en
    if cc == "cn":
        if k == "notice": return "중국 상무부(무역 담당 부처) 정책 공고", "China Ministry of Commerce policy notice"
        return "중국 국무원(중앙 정부) 정책 문서", "China State Council policy document"
    if cc == "tw":
        if k == "notice": return "대만 경제부 국제무역서(무역 담당 기관) 공고", "Taiwan Bureau of Foreign Trade notice"
        return "대만 행정원(중앙 정부) 소식", "Taiwan Executive Yuan news"
    if cc == "eu":
        ko, en = EU.get(k, ("EU 공식 문서", "EU official document")); return ko, en
    return None, None
def apply(cc, items):
    for b in items:
        b["lk"], b["le"] = label(cc, b)
    return items
