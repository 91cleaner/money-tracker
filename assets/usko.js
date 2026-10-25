/* Congress Tracker: 한국어 보기(버튼 하나로 화면 글자를 바로 한국어로). 의원 이름·종목 이름 같은 자료는 그대로 두고 화면 문구만 바꾼다.
   선택은 이 기기에만 저장(localStorage), ?lang=ko 로도 열 수 있다. */
(() => {
  const K = 'mt.us.lang';
  let ko = false; try { ko = (new URLSearchParams(location.search).get('lang') || localStorage.getItem(K)) === 'ko'; } catch (e) { /* 무시 */ }
  // [영어, 한국어] — 긴 문장부터(짧은 낱말이 먼저 바뀌어 문장이 깨지지 않게)
  const P = [
    ['CONGRESS TRACKER', '미국 의회 추적실'], ['U.S. CONGRESS', '미국 의회'], ['Congress pay accrued today', '오늘 의원 세비 누적'],
    ['Congress Trading Dashboard', '미국 의원 주식 거래 대시보드'],
    ['When they bought, when they sold, what they traded — and who beat the market. Disclosed trades of House members, last 12 months. Senate filings coming soon.', '언제 샀고, 언제 팔았고, 무엇을 거래했는지, 그리고 누가 시장을 이겼는지. 하원 의원이 신고한 최근 12개월 거래예요. 상원은 곧 들어와요.'],
    ["House members' disclosed trades · Senate filings coming soon", '하원 의원 신고 거래 · 상원은 곧 추가'],
    ['🏆 Who beat the market?', '🏆 누가 시장을 이겼나?'], ['🎯 Best-timed buys', '🎯 가장 잘 산 타이밍'], ['📉 Sold right before a drop', '📉 팔고 나서 떨어진 주식'],
    ['Biggest moves since the purchase date.', '산 날 이후 가장 많이 오른 거래예요.'], ['The stock fell the most after they sold.', '판 뒤에 가장 많이 떨어진 거래예요.'],
    ['Show the bottom 10', '하위 10명 보기'], ['Who picks better stocks? Democrats vs Republicans', '누가 종목을 더 잘 고르나? 민주당 vs 공화당'],
    ['These are stock price moves, not actual profits — filings show amount ranges, not share counts or prices. Members with few trades can look lucky.', '실제 수익이 아니라 그 주식의 가격 움직임이에요. 신고서에는 주식 수·체결가가 없고 금액 구간만 있어요. 거래가 적은 의원은 운이 좋아 보일 수 있어요.'],
    ['Filed after the 45-day deadline', '45일 기한 넘겨 신고한 거래'],
    ['The STOCK Act asks members to report a trade within 45 days. These were filed later (trade date → filing date).', '미국 법(STOCK Act)은 거래 후 45일 안에 신고하게 해요. 아래는 그보다 늦게 신고된 거래예요(거래일 → 신고일).'],
    ['More: monthly trend and every member\'s numbers', '더 보기: 월별 추이와 전체 의원 숫자'], ['Trades per month', '월별 거래'], ['Every member', '전체 의원'],
    ['Tap a column to sort. Tap a name to open their file on the map.', '열 이름을 누르면 정렬, 이름을 누르면 지도에서 파일이 열려요.'],
    ['Most traded tickers · last 90 days', '최근 90일 많이 거래된 종목'], ['What Congress is buying', '의회가 사는 종목'], ['What Congress is selling', '의회가 파는 종목'],
    ['Most bought · by number of members', '많이 산 종목 · 산 의원 수 기준'], ['Most sold · by number of members', '많이 판 종목 · 판 의원 수 기준'],
    ['Ranked by how many members bought it (last 12 months)', '산 의원 수 순서(최근 12개월)'], ['Ranked by how many members sold it (last 12 months)', '판 의원 수 순서(최근 12개월)'],
    ['Est. = sum of the midpoints of reported amount ranges, a rough guide. Tap a ticker to see every trade.', '추정 금액 = 신고 금액 구간의 중간값 합계(어림값). 종목을 누르면 모든 거래가 나와요.'],
    ['Public records as filed. A trade disclosure is not an accusation of wrongdoing. Amounts are the reported ranges.', '신고된 공개 기록 그대로예요. 거래 신고가 잘못을 뜻하지는 않아요. 금액은 신고된 구간이에요.'],
    ['Built by one person. If this is useful,', '혼자 만드는 사이트예요. 도움이 됐다면'], ['support it for $1/month on X ›', 'X에서 월 1달러로 응원하기 ›'],
    ['Tap a party to show only its members on the map.', '정당을 누르면 그 당 의원만 지도에 남아요.'], ['📊 Compare D vs R charts', '📊 민주 vs 공화 차트 비교'],
    ['Pick someone to compare with', '비교할 의원을 고르세요:'], ['Compare · pick a rival', '비교 · 상대 고르기'], ['You can also tap a dot on the map.', '지도에서 점을 눌러도 돼요.'], ['Same state', '같은 주'],
    ['Head to head', '1:1 비교'], ['New rival', '다른 상대'], ['Side-by-side public records, not a scorecard. Est. volume = sum of the midpoints of reported ranges (12 months).', '공개 기록을 나란히 놓은 것일 뿐 성적표가 아니에요. 추정 거래액 = 신고 구간 중간값 합계(12개월).'],
    ['Find my representatives (near me)', '내 근처 의원 찾기'], ['Name, state, or ticker (e.g. Pelosi, TX, NVDA)', '이름·주·종목 (예: Pelosi, TX, NVDA)'], ['Name or state (e.g. TX)', '이름 또는 주 (예: TX)'],
    ['No stock trade disclosures (PTRs) parsed for the last 12 months.', '최근 12개월 신고된 주식 거래가 없어요.'], ['Bill data is loading in the next update.', '법안 자료는 다음 업데이트에 들어와요.'],
    ['Official biography', '공식 약력'], ['Official website', '공식 홈페이지'], ['Financial disclosures (net worth, trades)', '재산 공개(재산·거래)'], ['Campaign money', '선거 자금'], ['Check the source', '원문으로 확인'], ['Committees', '소속 위원회'],
    ['Trades in last 30 days', '최근 30일 거래'], ['Stocks rose after buying', '매수 후 상승'], ['Stocks fell after buying', '매수 후 하락'], ['Reported trades in the last 30 days', '최근 30일 신고 거래 기준'], ['Average stock price movement since disclosed buys · not actual member profit', '신고된 매수 이후 주가 변동 평균 · 실제 의원 손익 아님'], ['Recent trades', '최근 거래'],
    ['More', '더 보기'], ['Trade disclosures', '거래 내역표'], ['Reported amounts are ranges; price moves are not actual member profits.', '신고 금액은 범위이며 주가 변동은 의원의 실제 수익이 아닙니다.'], ['Trade date', '거래일'], ['Reported amount', '신고 금액'], ['Price move since trade', '거래 이후 주가 변동'], ['Action', '구분'], ['N/A', '자료 없음'], ['FILE · U.S. SENATE', '의원 기록 · 미국 상원'], ['FILE · U.S. HOUSE', '의원 기록 · 미국 하원'], ['sponsored', '발의'], ['passed', '통과'], ['Introduced', '발의'], ['in the filings.', '건의 추가 신고 기록'], ['more in the filings.', '건의 추가 신고 기록'], ['Radar · stock activity', '레이더 · 주식 거래 탐지'], ['Green: buy', '초록: 매수'], ['Red: sell', '빨강: 매도'], ['Stock trade timeline', '주식 거래 시점 차트'], ['Recent trades', '최근 거래'], ['No matching records with priced purchases.', '주가 변동 기록이 있는 매수 내역이 없어요.'], ['Radar · traded in the last 30 days', '레이더 · 최근 30일 거래'], ['Beat the market', '시장 대비'], ['Est. volume', '추정 거래액'], ['Most trades', '거래 많은 순'], ['Became law', '법이 됨'],
    ['members traded', '명 거래'], ['members trading', '거래한 의원'], ['trades each (avg)', '1인 평균 거래'], ['filed after 45 days', '45일 넘겨 신고'], ['passed a chamber', '한 원 통과'],
    ['stock trades', '주식 거래'], ['bills sponsored', '발의 법안'], ['vs S&P 500', 'S&P 500 대비'], ['vs the market', '시장 대비'], ['in Congress since', '의회 입성'],
    ['Track anyone', '아무나 추적'], ['Copy link', '링크 복사'], ['Copied', '복사됨'], ['Compare', '비교'], ['Profile', '프로필'], ['Members', '의원'], ['Trades', '거래'], ['Party', '정당'], ['Radar', '레이더'], ['Rank', '순위'], ['Find', '찾기'], ['Bills', '법안'],
    ['Latest', '최근'], ['Most bought', '많이 산 종목'], ['Most sold', '많이 판 종목'], ['Most', '많은 순'], ['Fewest', '적은 순'],
    ['Democrats', '민주당'], ['Republicans', '공화당'], ['Independents', '무소속'], ['Democrat', '민주당'], ['Republican', '공화당'], ['Independent', '무소속'],
    ['Senator', '상원의원'], ['Member', '의원'], ['Ticker', '종목'], ['Type', '구분'], ['Traded', '거래일'], ['Filed', '신고일'], ['Days', '일수'], ['Bought', '산 날'], ['Sold', '판 날'], ['Since', '이후'], ['After', '판 뒤'], ['Laws', '법'], ['Late', '늦은 신고'],
    ['Charts', '차트'], ['Support · ', '응원 · '], [' on X', ' (X)'], ['Korea', '한국 국회'],
  ];
  const S = [
    [/For members with 5\+ disclosed buys: how much the stocks they bought moved after the trade date, minus the S&P 500 over the same days\. As of ([\d-]+)\./, '매수 5건 이상인 의원만: 산 날 이후 그 주식이 움직인 %에서 같은 기간 S&P 500을 뺀 값이에요. $1 기준.'],
    [/Average move of the stocks each party bought, from the trade date to ([\d-]+), compared with the S&P 500 over the same days\./, '각 당이 산 주식이 산 날부터 $1까지 움직인 평균을 같은 기간 S&P 500과 비교했어요.'],
    [/Disclosed stock trades of House members, last 12 months\. Senate filings coming soon\./, '하원 의원이 신고한 최근 12개월 주식 거래예요. 상원은 곧 들어와요.'],
    [/^ members traded stocks $/, '명의 의원이 주식을 '], [/^ times\.$/, '번 거래했어요.'], [/^trades$/, '거래'], [/\best\./, '추정'], [/^All$/, '전체'], [/^D vs R$/, '민주 vs 공화'],
    [/· (\d+) members$/, '· 의원 $1명'], [/File opened:/, '파일 열람:'], [/SAT · SATELLITE/, 'SAT · 위성'], [/Scanning…/, '스캔 중…'], [/Search ready…/, '검색 대기…'],
    [/disclosed trades · (\d+) in the last 90 days/, '건 신고 거래 · 최근 90일 $1건'], [/Radar on · (\d+) members disclosed trades in the last 30 days/, '레이더 가동 · 최근 30일 거래 신고 의원 $1명'],
    [/top 20 on the map/, '상위 20명 지도에 표시'], [/Your delegation:/, '우리 지역 의원:'], [/Near you \(approximate\)/, '내 근처(대략)'], [/No match\./, '못 찾았어요.'],
    [/Members with few trades can look lucky\./, '거래가 적은 의원은 운이 좋아 보일 수 있어요.'], [/Sources:/, '출처:'], [/^Public records — not an accusation of wrongdoing\./, '공개 기록일 뿐 잘잘못을 뜻하지 않아요.'],
  ];
  const R = [
    [/(\d[\d,]*) members of Congress · tap a dot to open a file \(bigger dots = senators\)/, '의원 $1명 · 점을 누르면 파일이 열려요(큰 점 = 상원)'],
    [/^(\d+) trades$/, '$1건'], [/^(\d+) members$/, '$1명'], [/(\d+) buys · est\./, '매수 $1건 · 추정'], [/(\d+) sells · est\./, '매도 $1건 · 추정'],
    [/\btraded\b/, '거래'], [/\bsold\b/, '매도'], [/\bsince\b/, '이후'], [/\bafter\b/, '판 뒤'], [/\bfiled\b/, '신고'], [/filing ↗/, '신고서 ↗'],
    [/^BUY$/, '매수'], [/^SELL$/, '매도'], [/^EXCH$/, '교환'], [/\bbuys\b/, '매수'], [/\bsells\b/, '매도'], [/\bseats\b/, '석'], [/\bsenators\b/, '상원'],
    [/^Rep\. · /, '하원의원 · '], [/^Age (\d+)/, '나이 $1'], [/They bought about/, '산 금액은 약'], [/members traded stocks/, '명의 의원이 주식을'], [/times\./, '번 거래했어요.'], [/Favorite:/, '가장 많이 산 종목:'], [/Best stock picker:/, '종목 고르기 1위:'],
  ];
  const orig = new WeakMap();
  // Explicitly re-translate sections rebuilt with innerHTML (dashboard filters, sorting).
  window.addEventListener('mt:us-content-updated', (e) => {
    if (!ko) return;
    busy = true;
    walk(e.detail && e.detail.root ? e.detail.root : document.body);
    busy = false;
  });
    const rx = (re) => new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const tr = (t) => { let s = t; if (!s.trim()) return t; S.forEach(([re, h]) => (s = s.replace(rx(re), h))); for (const [e, h] of P) if (s.includes(e)) s = s.split(e).join(h); R.forEach(([re, h]) => (s = s.replace(rx(re), h))); return s; };
  const walk = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement && /^(SCRIPT|STYLE)$/.test(n.parentElement.tagName) ? 2 : 1) });
    const ns = []; while (w.nextNode()) ns.push(w.currentNode);
    for (const n of ns) { if (!orig.has(n)) orig.set(n, n.nodeValue); const o = orig.get(n); const v = ko ? tr(o) : o; if (n.nodeValue !== v) n.nodeValue = v; }
    root.querySelectorAll && root.querySelectorAll('input[placeholder]').forEach((el) => { if (!el.dataset.ph) el.dataset.ph = el.placeholder; el.placeholder = ko ? tr(el.dataset.ph) : el.dataset.ph; });
  };
  let busy = false;
  const mo = new MutationObserver((ms) => { if (busy || !ko) return; busy = true; for (const m of ms) { if (m.type === 'characterData') { const n = m.target; if (n.parentElement && /^(SCRIPT|STYLE)$/.test(n.parentElement.tagName)) continue; if (orig.get(n) !== n.nodeValue) { orig.set(n, n.nodeValue); n.nodeValue = tr(n.nodeValue); } } else m.addedNodes.forEach((x) => { if (x.nodeType === 3) { if (x.parentElement && /^(SCRIPT|STYLE)$/.test(x.parentElement.tagName)) return; orig.set(x, x.nodeValue); x.nodeValue = tr(x.nodeValue); } else if (x.nodeType === 1) walk(x); }); } busy = false; });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  // 버튼
  const btn = document.createElement('a'); btn.href = '#'; btn.className = 'lang'; btn.setAttribute('role', 'button');
  const paint = () => { btn.textContent = ko ? 'English' : '한국어'; btn.setAttribute('lang', ko ? 'en' : 'ko'); document.documentElement.lang = ko ? 'ko' : 'en'; };
  btn.onclick = (e) => { e.preventDefault(); const next = ko ? 'en' : 'ko'; try { localStorage.setItem(K, next); } catch (x) { /* 무시 */ } const url = new URL(location.href); url.searchParams.set('lang', next); location.assign(url.toString()); };
  const nav = document.querySelector('.ubar nav'); if (nav) nav.prepend(btn);
  paint(); if (ko) { busy = true; walk(document.body); busy = false; }
})();
