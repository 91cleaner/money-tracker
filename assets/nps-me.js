/* 국민연금 페이지: ① 다음 미국 주식 목록 공개 카운트다운 ② 내 연금 보험료가 간 회사 계산기 ③ 내 종목 검색.
   모두 이미 받아 둔 공개 자료(data/nps)로만 계산한다. 투자 권유가 아니라 공시 정리. */
(async () => {
  const D = 'data/nps/';
  const $ = (id) => document.getElementById(id);
  const j = (f) => fetch(D + f, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const RATE = 9.5; // 2026년 연금 보험료율(%) — 회사원은 절반을 회사가 냄
  const won = (n) => {
    n = Math.round(Number(n) || 0);
    if (n >= 1e12) { const jo = Math.floor(n / 1e12), e = Math.round((n % 1e12) / 1e8); return jo.toLocaleString('ko-KR') + '조' + (e ? ' ' + e.toLocaleString('ko-KR') + '억' : '') + '원'; }
    if (n >= 1e8) { const e = Math.floor(n / 1e8), m = n >= 1e10 ? 0 : Math.round((n % 1e8) / 1e6) * 100; return e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만' : '') + '원'; }
    if (n >= 1e4) { const m = Math.floor(n / 1e4), r = n % 1e4; return m.toLocaleString('ko-KR') + '만' + (r ? ' ' + r.toLocaleString('ko-KR') : '') + '원'; }
    return n.toLocaleString('ko-KR') + '원';
  };
  const qL = (q) => { const m = String(q || '').match(/(\d{4})Q(\d)/); return m ? `${m[1]}년 ${m[2]}분기` : String(q || ''); };
  const qS = (q) => { const m = String(q || '').match(/Q(\d)/); return m ? m[1] + '분기' : ''; };
  const md = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일`;
  const DOW = '일월화수목금토';
  const josa = (w, a, b) => { const c = String(w).slice(-1).charCodeAt(0) - 0xac00; if (c < 0 || c > 11171) return /[0-9LMNRlmnr]$/.test(String(w)) ? a : b; return c % 28 ? a : b; };
  const kstNow = () => new Date(Date.now() + 9 * 3600e3);
  const copy = async (txt, btn) => {
    try { await navigator.clipboard.writeText(txt); } catch (e) {
      const t = document.createElement('textarea'); t.value = txt; document.body.append(t); t.select(); try { document.execCommand('copy'); } catch (_) { /* 무시 */ } t.remove();
    }
    if (btn) { const o = btn.textContent; btn.textContent = '복사했어요'; setTimeout(() => (btn.textContent = o), 1500); }
  };
  const pageUrl = (qs, hash) => location.origin + location.pathname + (qs ? '?' + qs : '') + (hash || '');

  // 미국 회사 우리말 이름(검색·표시용). 티커 기준, 티커가 없는 것은 회사 이름 일부로.
  const KO = {
    NVDA: '엔비디아', AAPL: '애플', MSFT: '마이크로소프트', AMZN: '아마존', GOOGL: '알파벳(구글)', GOOG: '알파벳(구글) C', AVGO: '브로드컴', MU: '마이크론',
    META: '메타', TSLA: '테슬라', AMD: 'AMD', LLY: '일라이릴리', JPM: 'JP모건', LRCX: '램리서치', AMAT: '어플라이드 머티어리얼즈', 'BRK/B': '버크셔 해서웨이',
    INTC: '인텔', JNJ: '존슨앤드존슨', XOM: '엑슨모빌', V: '비자', WMT: '월마트', CSCO: '시스코', KLAC: 'KLA', CAT: '캐터필러', ABBV: '애브비', GE: 'GE 에어로스페이스',
    COST: '코스트코', MA: '마스터카드', BAC: '뱅크오브아메리카', WDC: '웨스턴디지털', MRVL: '마벨', PG: 'P&G', UNH: '유나이티드헬스', STX: '시게이트', HD: '홈디포',
    KO: '코카콜라', CVX: '셰브론', MRK: '머크', NFLX: '넷플릭스', GS: '골드만삭스', PM: '필립모리스', PANW: '팔로알토 네트웍스', GEV: 'GE 버노바', IBM: 'IBM',
    TXN: '텍사스 인스트루먼트', LIN: '린데', MS: '모건스탠리', PLTR: '팔란티어', WFC: '웰스파고', SPCX: '스페이스X', APH: '암페놀', ORCL: '오라클', ADI: '아날로그디바이스',
    RTX: 'RTX(레이시온)', C: '씨티그룹', QCOM: '퀄컴', IONQ: '아이온큐', COIN: '코인베이스', MSTR: '스트래티지(마이크로스트래티지)', HOOD: '로빈후드', PEP: '펩시코',
    MCD: '맥도날드', NKE: '나이키', DIS: '디즈니', SBUX: '스타벅스', BA: '보잉', PFE: '화이자', UBER: '우버', ABNB: '에어비앤비', CRM: '세일즈포스', ADBE: '어도비',
    NOW: '서비스나우', ISRG: '인튜이티브 서지컬', AXP: '아메리칸 익스프레스', T: 'AT&T', VZ: '버라이즌', TMUS: 'T모바일', LMT: '록히드마틴', NOC: '노스롭그루먼',
    GD: '제너럴 다이내믹스', DE: '디어', HON: '하니웰', UPS: 'UPS', FDX: '페덱스', SNOW: '스노우플레이크', CRWD: '크라우드스트라이크', NET: '클라우드플레어',
    SMCI: '슈퍼마이크로', ARM: 'ARM', DELL: '델', HPQ: 'HP', ANET: '아리스타', VRT: '버티브', CEG: '컨스텔레이션 에너지', VST: '비스트라', OKLO: '오클로',
    RKLB: '로켓랩', ASTS: 'AST 스페이스모바일', SOFI: '소파이', PYPL: '페이팔', SHOP: '쇼피파이', SPOT: '스포티파이', RBLX: '로블록스', U: '유니티', DDOG: '데이터독',
    MDB: '몽고DB', ZS: '지스케일러', APP: '앱러빈', TTD: '트레이드데스크', BKNG: '부킹홀딩스', CVNA: '카바나', CCL: '카니발', TGT: '타깃', LOW: '로우스',
    AMGN: '암젠', GILD: '길리어드', REGN: '리제네론', VRTX: '버텍스', BMY: 'BMS', TMO: '써모피셔', DHR: '다나허', ABT: '애보트', MDT: '메드트로닉', NVO: '노보노디스크',
    CMCSA: '컴캐스트', CHTR: '차터', SCHW: '찰스슈왑', BLK: '블랙록', KKR: 'KKR', BX: '블랙스톤', SPGI: 'S&P 글로벌', MCO: '무디스', ICE: 'ICE', CME: 'CME',
    NEE: '넥스트에라', DUK: '듀크에너지', SO: '서던컴퍼니', ENPH: '엔페이즈', FSLR: '퍼스트솔라', COP: '코노코필립스', OXY: '옥시덴탈', SLB: 'SLB',
    IVV: 'iShares S&P500 ETF', PBUS: '인베스코 미국 ETF', SPY: 'SPDR S&P500 ETF', QQQ: '인베스코 나스닥100 ETF',
  };
  const KO_BY_NAME = [[/EXXON/i, 'XOM', '엑슨모빌'], [/COUPANG/i, 'CPNG', '쿠팡'], [/TAIWAN SEMI/i, 'TSM', 'TSMC']];
  const tidy = (n) => String(n || '').replace(/\b(CORPORATION|CORP|INCORPORATED|INC|CO|COM|LTD|PLC|HLDGS?|HLDNGS|HOLDINGS?|GROUP|TR|FD|NEW|CL [A-Z]|DEL|THE)\b\.?/gi, '').replace(/[.,&]+$/g, '').replace(/\s{2,}/g, ' ').trim()
    .toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  const norm = (s) => String(s || '').toLowerCase().replace(/[\s.,·()\-_/&']/g, '');

  const ch = await j('changes_us.json');
  if (!ch) return;
  const [ft, qa, qb, kr, hq, tk, d5] = await Promise.all([j('fund_totals.json'), j('holdings_us_' + ch.from + '.json'), j('holdings_us_' + ch.to + '.json'), j('kr_holdings.json'), j('kr_hq_region.json'), j('us_tickers.json'), j('dart5.json')]);
  const d5items = ((d5 && d5.items) || []).filter((x) => x.corp && x.stake != null);
  const pp = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2);
  const mdS = (s) => (s ? `${+s.slice(5, 7)}월 ${+s.slice(8, 10)}일` : '');
  const d5line = (x) => (x.prev != null ? `${pp(x.prev)}% → ${pp(x.stake)}%` : `${pp(x.stake)}%`) + (x.delta ? ` (${x.delta > 0 ? '+' : ''}${pp(x.delta)}%p)` : '');
  if (!qb || !kr) return;
  const fx = (qb.fx || (qa && qa.fx) || {}).usd_krw || 0;
  const SH = (((await fetch('data/og/s/index.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)) || {}).nps) || {}; // 미리보기 카드가 있는 회사
  const tick = (tk && tk.cusip) || {};
  const brand = (t, i) => (window.npsBrandOf ? window.npsBrandOf(t, i) : ['#7a5a00', '#ffb020', '#ffd27a']);
  const grad = (c) => (window.npsGrad ? window.npsGrad(c) : `linear-gradient(90deg,${c.join(',')})`);
  const LOGO = window.npsLogo || {};
  const mark = (code, label, i) => {
    if (LOGO[code]) return `<img class="me-logo" alt="" width="28" height="18" src="assets/logos/${esc(LOGO[code])}">`;
    return `<span class="me-mark" style="background:${grad(brand(code, i))}">${esc(String(label).replace(/[^A-Za-z0-9가-힣]/g, '').slice(0, /[가-힣]/.test(label) ? 2 : 4))}</span>`;
  };

  // ── 자료 묶기 ──
  const hqBy = Object.fromEntries(((hq && hq.companies) || []).map((c) => [c.company, c]));
  const krTotal = Number(kr.total_value_100m_krw) || kr.holdings.reduce((s, x) => s + (Number(x.value_100m_krw) || 0), 0);
  const krRows = kr.holdings.filter((x) => Number(x.value_100m_krw) > 0).map((x, i) => {
    const h = hqBy[x.company] || {};
    return { kind: 'kr', name: x.company, code: h.code || '', value: Number(x.value_100m_krw) * 1e8, stake: Number(x.stake_pct) || 0, rank: i + 1, sido: h.sido || '', sigungu: h.sigungu || '' };
  });
  const usName = (x, t) => { if (KO[t]) return KO[t]; const m = KO_BY_NAME.find(([re]) => re.test(x.issuer)); return m ? m[2] : tidy(x.issuer); };
  const usTick = (x) => tick[x.cusip] || (KO_BY_NAME.find(([re]) => re.test(x.issuer)) || [])[1] || '';
  const prevAdj = Object.fromEntries((ch.adjusted || []).map((x) => [x.cusip, x.shares_prev_adj]));
  const prevBy = Object.fromEntries(((qa && qa.holdings) || []).map((x) => [x.cusip, x]));
  const curBy = Object.fromEntries(qb.holdings.map((x) => [x.cusip, x]));
  const usRows = qb.holdings.map((x, i) => {
    const t = usTick(x); const p = prevBy[x.cusip];
    const prev = x.cusip in prevAdj ? prevAdj[x.cusip] : p ? p.shares : 0;
    return { kind: 'us', name: usName(x, t), en: x.issuer, code: t, cusip: x.cusip, value: x.value_usd * fx, usd: x.value_usd, rank: i + 1, shares: x.shares, prev };
  });
  // 직전 분기엔 있었는데 이번에 없는 것(모두 판 주식)
  const goneRows = ((qa && qa.holdings) || []).filter((x) => !curBy[x.cusip] && x.value_usd > 0).map((x) => { const t = usTick(x); return { kind: 'gone', name: usName(x, t), en: x.issuer, code: t, usd: x.value_usd }; });

  // ── CSS ──
  const css = document.createElement('style');
  css.textContent = `#nextq{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0;padding:12px 14px;border-radius:14px;background:#0f1a2a;border:1px solid #1f3a5f;font-size:14px;line-height:1.45;color:#d6dde4;text-decoration:none}
#nextq .dd{font:800 22px/1 Pretendard,system-ui,sans-serif;color:#ffb020;white-space:nowrap}#nextq b{color:#fff}#nextq .s{display:block;font-size:12.5px;color:#9aa6b2;margin-top:2px}
#nextq.new{background:#13230f;border-color:#2f6b2a}#nextq.new .dd{color:#3ddc84}
.me-in{display:flex;align-items:center;gap:8px;margin:8px 0}.me-in input{flex:1 1 auto;min-width:0;font:800 24px Pretendard,system-ui,sans-serif;color:#f4f7fb;background:#0b0f13;border:1px solid #3a4652;border-radius:12px;padding:8px 12px;text-align:right}
.me-in span{font-size:15px;color:#b8c3cf;white-space:nowrap}
.me-chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 6px}.me-chips button,.me-act button,.f-chips button{font:700 13px Pretendard,system-ui,sans-serif;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid #2a3541;background:#0f141b;color:#e8edf2;cursor:pointer}
.me-chips button[aria-pressed="true"]{background:#ffb020;color:#14110a;border-color:#ffb020}
.me-h{font-size:16px;margin:12px 0 8px;line-height:1.45}.me-h b{color:#ffb020;font-size:20px}
.me-list{list-style:none;margin:0;padding:0;display:grid;gap:9px}.me-list li{min-width:0}
.me-r{display:flex;align-items:center;gap:6px;min-width:0;font-size:14px;margin-bottom:3px}.me-r .n{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}.me-r .t{color:#8fa0b3;font-size:12px;font-family:ui-monospace,Menlo,monospace}
.me-r b{margin-left:auto;white-space:nowrap;font-variant-numeric:tabular-nums}.me-r small{color:#8fa0b3;font-weight:500;margin-left:4px}
.me-tr{height:12px;background:#0b0f13;border-radius:6px;overflow:hidden}.me-tr i{display:block;height:100%;border-radius:6px}
.me-logo{width:28px;height:18px;object-fit:contain;background:#f4f7fb;border-radius:4px;padding:1px 2px;flex:none}
.me-mark{flex:none;min-width:28px;height:18px;padding:0 4px;border-radius:4px;color:#fff;font:800 10px/18px ui-monospace,Menlo,monospace;text-align:center;text-shadow:0 1px 1px rgba(0,0,0,.5)}
.me-mix{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 0}.me-mix span{font-size:12.5px;padding:3px 9px;border-radius:999px;background:#0f141b;border:1px solid #2a3541;color:#c9d3dd}.me-mix b{color:#fff}
.me-act{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 0}.me-act .p{background:#0a84ff;border-color:#0a84ff;color:#fff}
#find input{width:100%;font:700 18px Pretendard,system-ui,sans-serif;color:#f4f7fb;background:#0b0f13;border:1px solid #3a4652;border-radius:12px;padding:12px 14px;margin:6px 0}
.f-chips{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0}.f-sug{display:grid;gap:4px;margin:4px 0}
.f-sug button{display:flex;justify-content:space-between;gap:8px;width:100%;text-align:left;font:600 14px Pretendard,system-ui,sans-serif;padding:10px 12px;border-radius:10px;border:1px solid #222b36;background:#0f141b;color:#e8edf2;cursor:pointer;min-height:44px;align-items:center}
.f-sug button span{color:#8fa0b3;font-size:12px;white-space:nowrap}
.f-card{margin-top:10px;padding:14px;border-radius:14px;background:#0f141b;border:1px solid #2a3541;display:grid;gap:6px}
.f-card .hd{display:flex;align-items:center;gap:8px;font-size:17px;font-weight:800;min-width:0}.f-card .hd span{min-width:0;overflow-wrap:anywhere}
.f-card .v{font-size:26px;font-weight:800;color:#ffb020;line-height:1.2}.f-card .l{font-size:14px;color:#d6dde4}.f-card .up{color:#3ddc84;font-weight:800}.f-card .dn{color:#ff6b6b;font-weight:800}
.f-card .s{font-size:12.5px;color:#8fa0b3}
.d5{display:grid}.d5r{display:flex;align-items:center;gap:8px;padding:9px 0;border-top:1px solid #222b36;font-size:14px;min-width:0}
.d5d{color:#8fa0b3;font-size:12.5px;white-space:nowrap;min-width:4.6em}.d5n{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e8edf2;font-weight:700;text-decoration:none}
.d5v{white-space:nowrap;font-variant-numeric:tabular-nums;color:#b8c3cf}.d5v b{color:#fff}.d5r .up,.d5r .dn,.d5z{white-space:nowrap;font-weight:800;font-size:13px;min-width:4.4em;text-align:right}
.d5r .up{color:#3ddc84}.d5r .dn{color:#ff6b6b}.d5z{color:#8fa0b3}.d5o{font-size:12px;color:#8fa0b3;white-space:nowrap}
@media(max-width:420px){.d5p{display:none}.d5d{min-width:0;flex:none}}`;
  document.head.append(css);

  // ── ① 카운트다운 ──
  (() => {
    const box = $('nextq'); if (!box) return;
    const now = kstNow(); const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const filed = qb.filed ? new Date(qb.filed + 'T00:00:00Z') : null;
    const since = filed ? Math.round((today - filed) / 864e5) : 99;
    if (since >= 0 && since <= 21) {
      box.className = 'new'; box.href = '#s3';
      box.innerHTML = `<span class="dd">NEW</span><span><b>${esc(qL(qb.quarter))} 미국 주식 목록</b>이 ${esc(md(filed))}에 나왔어요. 무엇을 늘리고 줄였는지 보기 ›<span class="s">국민연금이 석 달에 한 번 미국 정부(SEC)에 내는 목록이에요.</span></span>`;
      return;
    }
    const [y, m] = String(qb.period).split('-').map(Number);
    const end = new Date(Date.UTC(y, m + 3, 0)); // 다음 분기 마지막 날
    const due = new Date(end.getTime() + 45 * 864e5);
    const wd = due.getUTCDay(); if (wd === 6) due.setUTCDate(due.getUTCDate() + 2); else if (wd === 0) due.setUTCDate(due.getUTCDate() + 1);
    const left = Math.round((due - today) / 864e5);
    const nq = `${end.getUTCFullYear()}Q${Math.floor(end.getUTCMonth() / 3) + 1}`;
    const tb = (ch.top_buys || []).find((x) => x.real === true && !x.suspect_note);
    const tbn = tb ? usName(tb, usTick(tb)) : '';
    const fmt = (d) => `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${DOW[d.getUTCDay()]})`;
    const lead = [qa, qb].filter((q) => q && q.filed && q.period).map((q) => {
      const [yy, mm] = q.period.split('-').map(Number); const e = new Date(Date.UTC(yy, mm, 0)); const d = new Date(e.getTime() + 45 * 864e5);
      if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 2); else if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
      return Math.round((d - new Date(q.filed + 'T00:00:00Z')) / 864e5);
    });
    const leadTxt = lead.length ? `지난 ${lead.length === 2 ? '두' : '한'} 번은 마감 ${Math.min(...lead)}${lead.length === 2 && Math.min(...lead) !== Math.max(...lead) ? '~' + Math.max(...lead) : ''}일 전에 냈어요. ` : '';
    box.href = '#s3';
    box.innerHTML = `<span class="dd">${left > 0 ? 'D-' + left : left === 0 ? 'D-DAY' : '곧'}</span><span><b>${esc(qL(nq))} 국민연금 미국 주식 목록 공개</b> · 늦어도 ${esc(fmt(due))}${tbn ? `<span class="s">지난 분기엔 ${esc(tbn)}${josa(tbn, '을', '를')} 가장 많이 늘렸어요. 이번엔 뭘 샀을까요?</span>` : ''}<span class="s">${leadTxt}나오면 이 페이지가 하루 안에 저절로 바뀌어요.</span></span>`;
  })();

  // ── ④ 국민연금 지분 변동(대량보유 보고) ──
  (() => {
    const box = $('dart5'); if (!box || !d5items.length) return;
    box.hidden = false;
    const row = (x) => `<div class="d5r"><span class="d5d">${esc(mdS(x.date))}</span><a class="d5n" href="nps.html?q=${encodeURIComponent(x.corp)}#find">${esc(x.corp)}</a><span class="d5v">${x.prev != null ? `<span class="d5p">${esc(pp(x.prev))}% → </span>` : ''}<b>${esc(pp(x.stake))}%</b></span>${x.delta ? `<span class="${x.delta > 0 ? 'up' : 'dn'}">${x.delta > 0 ? '▲' : '▼'}${esc(pp(Math.abs(x.delta)))}%p</span>` : '<span class="d5z">유지</span>'}<a class="d5o" href="${esc(x.url)}" target="_blank" rel="noopener" aria-label="${esc(x.corp)} 공시 원문">원문↗</a></div>`;
    const head = d5items.slice(0, 8), more = d5items.slice(8, 60);
    const lastDay = d5items[0].date, sameDay = d5items.filter((x) => x.date === lastDay);
    const up = sameDay.filter((x) => x.delta > 0).length, dn = sameDay.filter((x) => x.delta < 0).length;
    box.innerHTML = `<h2>📣 국민연금 지분 변동</h2>
      <p class="sub">${esc(mdS(lastDay))} 공시 ${sameDay.length}건${up || dn ? ` · 늘림 ${up} · 줄임 ${dn}` : ''}. 국민연금이 5% 넘게 가진 회사의 지분이 바뀌면 금융감독원에 보고해요.</p>
      <div class="d5">${head.map(row).join('')}</div>
      ${more.length ? `<details class="nps-all"><summary>지난 보고 ${more.length}건 더 보기</summary><div class="d5">${more.map(row).join('')}</div></details>` : ''}
      <div class="me-act"><button type="button" class="p" data-a="t">최근 변동 글 복사</button></div>
      <p class="src">출처 <a href="https://dart.fss.or.kr" target="_blank" rel="noopener">금융감독원 전자공시</a> 주식등의 대량보유상황보고서(제출인 국민연금공단). 국민연금은 보통 변동이 있던 달(또는 분기)의 다음 달 10일 무렵에 몰아서 보고해서, 실제 사고판 날과 공시 날이 달라요. 투자 권유가 아니에요.</p>`;
    box.querySelector('[data-a="t"]').onclick = (e) => copy(`국민연금 지분 변동 (${mdS(lastDay)} 공시)\n` + sameDay.slice(0, 5).map((x) => `${x.corp} ${d5line(x)}`).join('\n'), e.target);
  })();

  // ── ② 내 연금 계산기 ──
  (() => {
    const box = $('mine'); if (!box) return;
    const ba = (ft && ft.half_year_release && ft.half_year_release.by_asset) || {};
    const wt = (k) => (Number((ba[k] || {}).weight_pct) || 0) / 100;
    const forTotal = (Number((ba['해외주식'] || {}).value_billion_krw) || 0) * 1e9;
    const asOf = (ft && ft.half_year_release && ft.half_year_release.as_of) || '';
    const chips = [[100000, '10만'], [200000, '20만'], [285000, '28만 5천', '월급 300만'], [475000, '47만 5천', '월급 500만']];
    const sp = new URLSearchParams(location.search); let P = Math.max(0, Math.min(5e7, Number(sp.get('p')) || 285000));
    box.innerHTML = `<h2>내 연금 돈은 어느 회사에?</h2>
      <p class="sub">한 달에 내는 국민연금 보험료를 넣어 보세요. 국민연금이 돈을 나눠 둔 비율대로 나눠 드려요.</p>
      <label class="me-in"><input id="meP" inputmode="numeric" autocomplete="off" aria-label="한 달 연금 보험료(원)"><span>원 / 한 달</span></label>
      <div class="me-chips">${chips.map(([v, l, h]) => `<button type="button" data-v="${v}">${l}${h ? `<small style="font-weight:500;color:inherit;opacity:.75"> · ${h}</small>` : ''}</button>`).join('')}</div>
      <p class="s src">2026년 보험료는 월급의 ${RATE}%예요. 회사원은 그 절반만 월급에서 빠지고 절반은 회사가 내니, 명세서 금액의 2배를 넣으면 돼요.</p>
      <div id="meOut"></div>`;
    const inp = $('meP'), out = $('meOut');
    const paint = () => {
      inp.value = P ? P.toLocaleString('ko-KR') : '';
      box.querySelectorAll('.me-chips button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === P)));
      if (!P) { out.innerHTML = ''; return; }
      const dom = P * wt('국내주식'), fo = P * wt('해외주식');
      const items = [
        ...krRows.slice(0, 40).map((r) => ({ ...r, m: dom * (r.value / 1e8) / krTotal })),
        ...(forTotal ? usRows.slice(0, 60).map((r) => ({ ...r, m: fo * r.value / forTotal })) : []),
      ].sort((a, b) => b.m - a.m).slice(0, 10);
      const mx = items.length ? items[0].m : 1;
      const stock = dom + fo;
      const rest = [['국내 채권', wt('국내채권')], ['해외 채권', wt('해외채권')], ['대체투자(건물·도로 등)', wt('대체투자')], ['단기자금', wt('단기자금')]].filter(([, w]) => w > 0);
      const show = (r) => (r.kind === 'us' && r.code ? r.code : r.code && !/^\d+$/.test(r.code) ? r.code : '');
      out.innerHTML = `<div class="me-h">월 <b>${esc(won(P))}</b> 중 주식에 <b>${esc(won(stock))}</b><br><span class="sub">우리나라 회사 ${esc(won(dom))} · 다른 나라 회사 ${esc(won(fo))}</span></div>
        <ol class="me-list">${items.map((r, i) => `<li><div class="me-r">${mark(r.code, r.code && !/^\d+$/.test(r.code) ? r.code : r.name, i)}<span class="n">${esc(r.name)}</span>${show(r) ? `<span class="t">${esc(show(r))}</span>` : ''}<b>${esc(won(r.m))}<small>1년 ${esc(won(r.m * 12))}</small></b></div><div class="me-tr"><i style="width:${Math.max(2, (r.m / mx) * 100).toFixed(1)}%;background:${grad(brand(r.code, i))}"></i></div></li>`).join('')}</ol>
        <div class="me-mix">${rest.map(([k, w]) => `<span>${esc(k)} <b>${esc(won(P * w))}</b></span>`).join('')}</div>
        <div class="me-act"><button type="button" class="p" data-a="t">결과 글 복사</button><button type="button" data-a="l">링크 복사</button></div>
        <p class="src">어림값이에요. 보험료가 그대로 이 주식을 사는 데 쓰이는 건 아니고, 기금 전체를 나눠 둔 비율(${esc(asOf.slice(0, 4))}년 ${esc(String(+asOf.slice(5, 7)))}월 말)로 계산했어요. 우리나라 회사는 ${esc(kr.as_of.slice(0, 4))}년 말 목록, 다른 나라 회사는 ${esc(qL(qb.quarter))} 미국 주식 목록 기준(미국 말고 다른 나라 주식은 공개 목록이 없어 빠졌어요). 투자 권유가 아니에요.</p>`;
      const top3 = items.slice(0, 3).map((r) => `${r.name} ${won(r.m)}`).join(', ');
      out.querySelector('[data-a="t"]').onclick = (e) => copy(`내 국민연금 월 ${won(P)} 중 주식에 ${won(stock)}이 들어가요.\n가장 많이 간 곳: ${top3}\n1년이면 ${items[0].name}에만 ${won(items[0].m * 12)}`, e.target);
      out.querySelector('[data-a="l"]').onclick = (e) => copy(pageUrl('p=' + P, '#mine'), e.target);
    };
    inp.addEventListener('input', () => { const v = Number(String(inp.value).replace(/[^0-9]/g, '')) || 0; P = Math.min(5e7, v); const pos = inp.value.length; paint(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) { /* 무시 */ } void pos; });
    box.querySelectorAll('.me-chips button').forEach((b) => (b.onclick = () => { P = Number(b.dataset.v); paint(); }));
    paint();
  })();

  // ── ③ 종목 검색 ──
  (() => {
    const box = $('find'); if (!box) return;
    const all = [...krRows, ...usRows, ...goneRows].map((r) => ({ ...r, key: norm(r.name) + '|' + norm(r.en) + '|' + norm(r.code) + '|' + norm(KO[r.code] || '') }));
    box.innerHTML = `<h2>내 종목, 국민연금도 갖고 있을까?</h2>
      <input id="fq" type="search" placeholder="삼성전자, 엔비디아, TSLA…" autocomplete="off" aria-label="종목 이름이나 티커">
      <div class="f-chips">${['삼성전자', 'SK하이닉스', '엔비디아', '테슬라', '팔란티어', '스페이스X'].map((n) => `<button type="button">${n}</button>`).join('')}</div>
      <div class="f-sug" id="fsug"></div><div id="fres"></div>`;
    const inp = $('fq'), sug = $('fsug'), res = $('fres');
    const find = (q) => {
      const n = norm(q); if (!n) return [];
      const up = String(q).trim().toUpperCase();
      const exact = all.filter((r) => r.code && r.code.toUpperCase() === up);
      const starts = all.filter((r) => !exact.includes(r) && (norm(r.name).startsWith(n) || norm(KO[r.code] || '').startsWith(n)));
      const has = all.filter((r) => !exact.includes(r) && !starts.includes(r) && r.key.includes(n));
      return [...exact, ...starts, ...has].slice(0, 6);
    };
    const tag = (r) => (r.kind === 'kr' ? '국내' : r.kind === 'us' ? '미국' : '미국 · 모두 팖');
    const card = (r) => {
      const label = r.code && !/^\d+$/.test(r.code) ? r.code : r.name;
      let body = '', text = '';
      if (r.kind === 'kr') {
        const where = [r.sido, r.sigungu].filter(Boolean).join(' ');
        body = `<div class="v">${esc(won(r.value))}</div>
          <div class="l">국민연금이 가진 우리나라 주식 ${krRows.length.toLocaleString('ko-KR')}개 중 <b>${r.rank}위</b>${r.stake ? ` · 이 회사 주식의 <b>${r.stake}%</b>를 가졌어요` : ''}</div>
          ${where ? `<div class="s">본사 ${esc(where)} · <a href="nps.html?co=${encodeURIComponent(r.name)}#s5">지도에서 보기</a></div>` : ''}
          <div class="s">${esc(kr.as_of.slice(0, 4))}년 ${+kr.as_of.slice(5, 7)}월 말 평가액 · 국민연금은 국내 주식 전체 목록을 1년에 한 번 공개해요.</div>`;
        text = `국민연금은 ${r.name} 주식을 ${won(r.value)}어치 갖고 있어요. 국내 주식 중 ${r.rank}위${r.stake ? `, 지분 ${r.stake}%` : ''}.`;
        const dx = d5items.find((x) => (r.code && x.code === r.code) || x.corp === r.name);
        if (dx) {
          body += `<div class="l">📣 최근 공시(${esc(mdS(dx.date))}): 지분 ${dx.prev != null ? esc(pp(dx.prev)) + '% → ' : ''}<b>${esc(pp(dx.stake))}%</b>${dx.delta ? ` <span class="${dx.delta > 0 ? 'up' : 'dn'}">${dx.delta > 0 ? '▲' : '▼'}${esc(pp(Math.abs(dx.delta)))}%p</span>` : ''} · <a href="${esc(dx.url)}" target="_blank" rel="noopener">원문</a></div>`;
          text += `\n최근 공시(${mdS(dx.date)}): 지분 ${d5line(dx)}`;
        }
      } else if (r.kind === 'us') {
        let chg = '', chgT = '';
        if (!r.prev) { chg = `<span class="up">${esc(qS(qb.quarter))}에 새로 샀어요</span>`; chgT = `${qS(qb.quarter)}에 새로 샀어요.`; }
        else {
          const d = (r.shares - r.prev) / r.prev * 100;
          if (Math.abs(d) < 0.5) { chg = `${esc(qS(qa.quarter))}와 주식 수가 거의 같아요`; chgT = '주식 수는 그대로예요.'; }
          else { chg = `${esc(qS(qa.quarter))}보다 주식 수 <span class="${d > 0 ? 'up' : 'dn'}">${Math.abs(d).toFixed(Math.abs(d) < 10 ? 1 : 0)}%</span> ${d > 0 ? '늘렸어요' : '줄였어요'}`; chgT = `${qS(qa.quarter)}보다 주식 수를 ${Math.abs(d).toFixed(Math.abs(d) < 10 ? 1 : 0)}% ${d > 0 ? '늘렸어요' : '줄였어요'}.`; }
        }
        body = `<div class="v">${esc(won(r.value))}</div>
          <div class="l">미국 주식 ${usRows.length.toLocaleString('ko-KR')}개 중 <b>${r.rank}위</b> · ${chg}</div>
          <div class="s">${esc(r.en)} · ${(r.usd / 1e8).toFixed(r.usd >= 1e9 ? 0 : 2).replace(/\.?0+$/, '')}억 달러 · ${esc(qL(qb.quarter))} 말, 1달러 ${fx.toLocaleString('ko-KR')}원으로 바꾼 어림값</div>`;
        text = `국민연금은 ${r.name}${r.code ? `(${r.code})` : ''}를 약 ${won(r.value)}어치 갖고 있어요. 미국 주식 ${usRows.length}개 중 ${r.rank}위, ${chgT}`;
      } else {
        body = `<div class="v" style="color:#ff6b6b">모두 팔았어요</div><div class="l">${esc(qL(qa.quarter))}엔 ${(r.usd / 1e8).toFixed(2).replace(/\.?0+$/, '')}억 달러어치 있었는데 ${esc(qL(qb.quarter))} 목록엔 없어요.</div><div class="s">${esc(r.en)} · 회사가 합쳐지거나 이름·코드가 바뀌어 빠진 것일 수도 있어요.</div>`;
        text = `국민연금은 ${qS(qa.quarter)}에 갖고 있던 ${r.name}${r.code ? `(${r.code})` : ''}를 ${qS(qb.quarter)}에 모두 판 것으로 나와요.`;
      }
      res.innerHTML = `<div class="f-card"><div class="hd">${mark(r.code, label, 0)}<span>${esc(r.name)}</span>${r.code ? `<span class="bb-t" style="color:#8fa0b3;font:12px ui-monospace,Menlo,monospace">${esc(r.code)}</span>` : ''}</div>${body}
        <div class="me-act"><button type="button" class="p" data-a="t">글 복사</button><button type="button" data-a="l">링크 복사</button></div></div>`;
      res.querySelector('[data-a="t"]').onclick = (e) => copy(text, e.target);
      res.querySelector('[data-a="l"]').onclick = (e) => copy(SH[r.name] ? location.origin + location.pathname.replace(/[^/]*$/, '') + 's/n/' + SH[r.name] + '.html' : pageUrl('q=' + encodeURIComponent(r.name), '#find'), e.target);
    };
    const notFound = (q) => { res.innerHTML = `<div class="f-card"><div class="l">‘${esc(q)}’${josa(q, '은', '는')} 국민연금 공개 목록에서 못 찾았어요.</div><div class="s">미국은 ${esc(qL(qb.quarter))} 미국 주식 목록, 국내는 ${esc(kr.as_of.slice(0, 4))}년 말 국내 주식 목록 기준이에요. 이름을 조금 다르게(영어·티커) 넣어 보세요.</div></div>`; };
    const run = (q, pickFirst) => {
      const hits = find(q); sug.innerHTML = '';
      if (!String(q).trim()) { res.innerHTML = ''; return; }
      if (!hits.length) { notFound(q); return; }
      if (pickFirst || hits.length === 1) { card(hits[0]); return; }
      res.innerHTML = '';
      sug.innerHTML = hits.map((r, i) => `<button type="button" data-i="${i}">${esc(r.name)}${r.code ? ` <small style="color:#8fa0b3">${esc(r.code)}</small>` : ''}<span>${tag(r)}</span></button>`).join('');
      sug.querySelectorAll('button').forEach((b) => (b.onclick = () => { sug.innerHTML = ''; card(hits[Number(b.dataset.i)]); }));
    };
    let tmr = 0;
    inp.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => run(inp.value, false), 120); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(tmr); run(inp.value, true); } });
    box.querySelectorAll('.f-chips button').forEach((b) => (b.onclick = () => { inp.value = b.textContent; run(b.textContent, true); }));
    const q0 = new URLSearchParams(location.search).get('q');
    if (q0) { inp.value = q0; run(q0, true); }
  })();
})();
