"""공유용 카드 이미지(1200x630)와 시별 정적 공유 페이지(c/<slug>.html) 만들기.
X·카카오톡 같은 곳은 자바스크립트를 실행하지 않으므로, 미리보기용 og 태그를 가진 정적 HTML이 따로 필요하다."""
import html, os

SITE_URL = os.environ.get("SITE_URL", "https://91cleaner.github.io/money-tracker/").rstrip("/") + "/"
SITE_NAME = "세금추적단"
CAVEAT = "데이터상 이상 징후, 위법 아님"
FONT_BOLD = ["/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", "/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc"]
FONT_REG = ["/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc"]
SHORT = {"split": "같은 날 나눠진 계약", "threshold": "금액선 근처 계약", "repeat": "같은 업체 반복", "big": "1억원 이상 계약"}


def _font(paths, size):
    from PIL import ImageFont
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size, index=1)  # ttc 안의 KR 글꼴
    return None


def _fit(draw, text, paths, size, width):
    f = _font(paths, size)
    while f and size > 30 and draw.textlength(text, font=f) > width:
        size -= 4
        f = _font(paths, size)
    return f


def krw(n):
    if n >= 1e12:
        return f"{n / 1e12:.1f}".rstrip("0").rstrip(".") + "조원"
    if n >= 1e8:
        return (f"{round(n / 1e8):,}" if n >= 1e10 else f"{n / 1e8:.1f}".rstrip("0").rstrip(".")) + "억원"
    if n >= 1e4:
        return f"{round(n / 1e4):,}만원"
    return f"{n:,}원"


def headline(city, alert):
    if alert:
        t = SHORT.get(alert["kind"], "")
        if alert["kind"] in ("split", "repeat"):
            n = len(alert.get("ids") or [])
            t += f" {n}건" if alert["kind"] == "split" else ""
            if alert["kind"] == "repeat":
                t = alert["title"].split(" (")[0]
        return f"{city['short']} · 최근 90일 · {t}"
    return f"{city['short']} · 최근 90일"


def card(path, top, big, sub, caveat=True):
    """흰 바탕, 큰 글씨 한 줄, 작은 설명 두 줄. 글꼴이 없으면 건너뜀."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return False
    if not _font(FONT_BOLD, 10):
        return False
    W, H, M = 1200, 630, 80
    im = Image.new("RGB", (W, H), "#ffffff")
    d = ImageDraw.Draw(im)
    d.text((M, 70), SITE_NAME, font=_font(FONT_BOLD, 34), fill="#0071e3")
    d.text((M, 170), top, font=_fit(d, top, FONT_BOLD, 64, W - 2 * M), fill="#1d1d1f")
    d.text((M, 250), big, font=_fit(d, big, FONT_BOLD, 120, W - 2 * M), fill="#1d1d1f")
    if sub:
        d.text((M, 430), sub, font=_fit(d, sub, FONT_REG, 36, W - 2 * M), fill="#6e6e73")
    if caveat:
        f = _font(FONT_BOLD, 30)
        w = d.textlength(CAVEAT, font=f)
        d.rounded_rectangle((M, 520, M + w + 44, 576), radius=28, fill="#fff4e5")
        d.text((M + 22, 526), CAVEAT, font=f, fill="#bf5b00")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)
    return True


PAGE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:type" content="website"><meta property="og:site_name" content="{site}">
<meta property="og:title" content="{title}"><meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{img}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}"><meta name="twitter:image" content="{img}">
<link rel="canonical" href="{target}">
<meta http-equiv="refresh" content="0; url=../city.html?c={slug}">
<script>location.replace('../city.html?c={slug}' + location.hash);</script>
<script data-goatcounter="https://moneytracker.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
</head><body style="font-family:sans-serif;padding:40px">
<p><a href="../city.html?c={slug}">{title} 보러 가기</a></p>
</body></html>
"""


def build(root, city, summary, alerts, version):
    """시 하나의 카드 이미지와 공유 페이지를 만든다. version은 캐시를 피하려고 이미지 주소 뒤에 붙인다."""
    slug = city["slug"]
    flagged = [a for a in alerts if a["kind"] != "big"]
    top = flagged[0] if flagged else None
    og_rel = f"data/og/{slug}.png"
    sub = f"계약 {summary['count']:,}건" + (f" · 다른 지역 업체 {round((1 - summary['local_share']) * 100)}%" if summary.get("local_share") is not None else "")
    if top:
        ok = card(os.path.join(root, og_rel), headline(city, top), krw(top["amount"] or 0), f"{city['short']} 전체 {krw(summary['total'])} · " + sub)
    else:
        ok = card(os.path.join(root, og_rel), f"{city['short']} · 최근 90일 계약 금액", krw(summary["total"]), sub, caveat=False)
    title = f"{city['name']} 돈 추적기 · {headline(city, top)}" if top else f"{city['name']} 돈 추적기"
    desc = (f"최근 90일 {city['short']} 계약 {krw(summary['total'])}. " + (f"{CAVEAT}." if top else "") + " 공개 데이터, 출처 포함.").strip()
    img = SITE_URL + (og_rel if ok else "assets/og.png") + f"?v={version}"
    page = PAGE.format(title=html.escape(title), desc=html.escape(desc), site=SITE_NAME, url=f"{SITE_URL}c/{slug}.html", img=img,
                       target=f"{SITE_URL}city.html?c={slug}", slug=slug)
    os.makedirs(os.path.join(root, "c"), exist_ok=True)
    with open(os.path.join(root, "c", slug + ".html"), "w", encoding="utf-8") as f:
        f.write(page)
