/* 세계 관제실 언어 전환 (한국어 / English). 영어 문구: 이 파일 + data/i18n/skysea_en.json. ?lang=en 또는 localStorage 'mt_lang' */
(function () {
  var qs = new URLSearchParams(location.search), q = qs.get('lang');
  var lang = q === 'en' || q === 'ko' ? q : (function () { try { return localStorage.getItem('mt_lang'); } catch (e) { return null; } })() === 'en' ? 'en' : 'ko';
  try { localStorage.setItem('mt_lang', lang); } catch (e) {}
  window.mtLang = lang;
  var setBtn = function () {
    var side = document.getElementById('side'); if (!side || document.getElementById('langBtn')) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'langBtn'; b.className = 'btn';
    b.setAttribute('data-noi18n', '1');
    b.style.cssText = 'position:absolute;top:10px;right:10px;padding:6px 12px;font-size:12px;z-index:2';
    b.textContent = lang === 'en' ? '한국어' : 'English';
    b.setAttribute('aria-label', lang === 'en' ? '한국어로 보기' : 'View in English');
    b.addEventListener('click', function () {
      var n = lang === 'en' ? 'ko' : 'en'; try { localStorage.setItem('mt_lang', n); } catch (e) {}
      var u = new URL(location.href); if (n === 'en') u.searchParams.set('lang', 'en'); else u.searchParams.delete('lang'); location.href = u.toString();
    });
    side.style.position = side.style.position || ''; var h = side.querySelector('h1'); if (h) { h.parentNode.style.position = 'relative'; h.parentNode.style.paddingRight = '78px'; h.parentNode.appendChild(b); b.style.top = '0'; b.style.right = '0'; } else side.prepend(b);
  };
  if (lang !== 'en') { document.addEventListener('DOMContentLoaded', setBtn); return; }
  document.documentElement.lang = 'en';
  var TITLE = 'The Greatest History Record Control Room';
  document.title = TITLE;
  var MAP = {};
  var UI = {
    '지상 최대의 역사 기록 관제실': TITLE, '지도': 'Map', '불러오는 중이에요': 'Loading',
    '비행기 (지금)': 'Aircraft (now)', '배 (하루 기록)': 'Ships (daily record)', '비행기': 'Aircraft', '배': 'Ships', '실시간 배': 'Live ships', '군용기 따로 색칠': 'Highlight military aircraft',
    '나라 찾기 (예: 미국, USA, US)': 'Find a country (e.g. USA, US, Korea)', '나라 찾기': 'Find a country', '지우기': 'Clear', '닫기': 'Close',
    '더 보기': 'More layers', '분쟁 사건': 'Conflict events', 'GPS 전파 방해 구역': 'GPS interference areas', '비행 회피 구역': 'Flight avoidance zones', '위성 화재': 'Satellite fire detections', '지진·폭발': 'Earthquakes and explosions',
    '군용기': 'military aircraft', '군용기 · 나라 이름을 누르면 그 나라 숫자가 나와요': '= military · Tap a country name to see its numbers', '2014–진행 중': '2014–ongoing', '나라 이름을 누르면 그 나라 숫자가 나와요': 'Tap a country name to see its numbers',
    '비행기 나라 (등록)': 'Aircraft by country (registration)', '배 나라 (국기)': 'Ships by country (flag)', '전체 보기': 'Show all', '나가기': 'Exit',
    '비행기나 배 점을 누르면 자세한 사실이 나와요.': 'Tap an aircraft or ship dot to see details.', '자세히 보기': 'Details',
    '배 모양: 흰 테두리 배는 실시간 배, 작은 배는 Global Fishing Watch 하루 기록을 크게 확대했을 때 칸 안에 흩어 그린 것이라 실제 위치가 아니에요.': 'Ship icons: ships with a white outline are live ships. Small ships are Global Fishing Watch daily records scattered inside each grid cell when zoomed in, so they are not actual positions.',
    '움직임: 지난 약 1시간(최근 6번 저장) 위치를 흐린 꼬리로 그려요. 저장 사이에는 속도와 방향으로 앞으로 옮겨 그리고(최대 15분), 새 자료가 오면 실제 위치로 돌아가요. 그래서 그림 위치는 추정이에요.': 'Movement: positions from about the last hour (the last 6 saves) are drawn as a faint trail. Between saves, dots are moved forward using speed and heading (up to 15 minutes) and return to the reported position when new data arrives. Drawn positions are therefore estimates.',
    '군용기: adsb.lol의 군용 표시가 있는 비행기만 따로 색칠해요. 많은 군용기는 신호를 끄고 날아서 안 보여요.': 'Military aircraft: only aircraft with the adsb.lol military flag are highlighted. Many military aircraft fly with transponders off and do not appear.',
    '분쟁 사건: GDELT 자료예요. 최근 24시간 뉴스 기사에 나온 공격·충돌·대규모 폭력 사건을 1도 칸마다 기사 수로 세요. 기사에 나온 장소 기준이라 실제 사건 수나 위치와 다를 수 있어요.': 'Conflict events: GDELT data. Attacks, clashes and mass violence mentioned in news articles from the last 24 hours, counted as articles per 1-degree cell. Locations are as named in articles, so counts and positions may differ from actual events.',
    'GPS 전파 방해 구역: adsb.lol 비행기 신호 중 위치 정확도가 낮게 보고된 비행기(NACp 8 미만 또는 NIC 7 미만)가 30% 이상인 1도 칸이에요. 원인은 알 수 없어요.': 'GPS interference areas: 1-degree cells where 30% or more of aircraft in adsb.lol data report low position accuracy (NACp below 8 or NIC below 7). The source is unknown.',
    '비행 회피 구역: 유럽항공안전청(EASA) 분쟁 지역 안내(CZIB) 중 지금 유효한 것을 나라 단위로 칠해요. 실제 구역은 나라 일부일 수 있어요.': 'Flight avoidance zones: currently valid EASA Conflict Zone Information Bulletins (CZIB), shaded by country. The actual zone may cover only part of a country.',
    '위성 화재: NASA FIRMS VIIRS 위성이 최근 24시간 잡은 열점을 1도 칸마다 세요. 산불, 농사 불, 공장 열도 들어가요.': 'Satellite fire detections: hotspots detected by NASA FIRMS VIIRS satellites in the last 24 hours, counted per 1-degree cell. Includes wildfires, agricultural burning and industrial heat.',
    '지진·폭발: 미국 지질조사국(USGS) 최근 7일 규모 2.5 이상 기록이에요. 종류가 폭발이면 폭발로 보여 줘요.': 'Earthquakes and explosions: USGS records of magnitude 2.5 or higher from the last 7 days. Events typed as explosions are shown as explosions.',
    '흰 테두리 점은 실시간 배예요. AISStream이 10분마다 약 1분 동안 받은 배 위치이고, 바닷가 수신기 근처 배만 잡혀요. 배 이름과 나라는 배가 보낸 신호(MMSI) 기준이에요.': 'Dots with a white outline are live ships: positions received by AISStream for about 1 minute every 10 minutes, only near coastal receivers. Ship names and countries are based on the signal the ship sends (MMSI).',
    '비행기: adsb.lol 무료 공개 자료(ODbL)예요. 전 세계를 한 번에 주는 무료 자료가 없어서, 비행기가 많은 지역을 반경 250해리씩 나눠 10분마다 저장해요. 먼 바다 위와 수신기가 없는 곳은 비어 있어요. 땅 위에 서 있는 비행기는 빼요.': 'Aircraft: free open adsb.lol data (ODbL). No free source covers the whole world at once, so busy regions are split into 250 nautical mile radius areas and saved every 10 minutes. Open ocean and areas without receivers are empty. Aircraft on the ground are excluded.',
    '비행기 나라: 고유 번호(ICAO 24비트 주소)의 나라별 배정 범위로 나눠요. 등록한 나라라서 항공사 나라와 다를 수 있어요. 신호를 끈 비행기는 안 보여요.': 'Aircraft country: grouped by the national allocation block of the ICAO 24-bit address. This is the country of registration and may differ from the airline country. Aircraft with transponders off do not appear.',
    '배: Global Fishing Watch 자료(AIS 신호)예요. 며칠 늦게 들어와서 지금 위치가 아니에요. 하루 동안 2도 칸마다 지나간 배 수를 국기별로 세요. 지구를 24칸으로 나눠 받아서, 칸 경계를 지난 배는 두 번 셀 수 있어요. 신호를 끈 배는 안 보여요.': 'Ships: Global Fishing Watch data (AIS signals). It arrives a few days late, so these are not current positions. Ships passing through each 2-degree cell during one day are counted by flag. The globe is fetched in 24 tiles, so ships crossing a tile boundary may be counted twice. Ships with AIS off do not appear.',
    '지도: Esri, Maxar 위성 사진이에요.': 'Map: Esri, Maxar satellite imagery.',
    '배: Global Fishing Watch, AISStream · 비행기: adsb.lol': 'Ships: Global Fishing Watch, AISStream · Aircraft: adsb.lol',
    '정보 없음': 'no data', '군용기 표시': 'Military flag', '군용기 표시가 있는 신호예요': 'This signal carries a military flag', '이름 없는 배': 'Unnamed ship', '나라 기록 없음': 'No country on record', '기타 나라': 'Other countries', '기타': 'Other',
    '기록 위치 (하루 기록)': 'Recorded position (daily record)', '비행기 자료를 불러오지 못했어요': 'Could not load aircraft data', '배 자료를 불러오지 못했어요': 'Could not load ship data', '실시간 배 자료를 아직 못 받았어요.': 'No live ship data received yet.',
    'EASA 안내문': 'EASA bulletin', 'GPS 전파 방해 구역 (추정)': 'GPS interference area (estimated)', 'NASA FIRMS 지도': 'NASA FIRMS map', 'USGS 지도': 'USGS map', '분쟁 사건 기사': 'Conflict event articles', '기사 원문 보기': 'Read the original article', '폭발': 'Explosion', '지진': 'Earthquake', '바다': 'Sea',
    '배 (국기, 하루)': 'Ships (flag, one day)', '비행기 (등록)': 'Aircraft (registration)', '위성 화재 열점': 'Satellite fire hotspots', '없음': 'none', '찾는 나라가 없어요': 'No matching country',
    '세계 역사 사건': 'World history events', '전쟁 시나리오': 'War scenarios', '미국 정권 교체 기록': 'US regime change record', '최근 미군 작전': 'Recent US military operations',
    '눌러 보세요': 'Tap to open', '다음': 'Next', '이전': 'Previous', '재생': 'Play', '멈춤': 'Pause', '사진': 'Photos', '출처': 'Sources', '단계 이동': 'Move between steps', '날짜 이동': 'Move between dates',
    '불러오지 못했어요': 'Could not load', '시나리오 닫기': 'Close scenario', '시나리오를 불러오지 못했어요': 'Could not load the scenario', '이 장면의 추가 설명은 없어요.': 'No further description for this scene.', '전선 (대략)': 'Front line (approximate)',
    '화살표와 전선은 이해를 돕기 위한 대략적인 그림이에요. 지도: Esri, Maxar 위성 사진, 나라 경계 Natural Earth.': 'Arrows and front lines are approximate drawings. Map: Esri, Maxar satellite imagery; borders: Natural Earth.',
    '원, 화살표, 장소 표시는 이해를 돕기 위한 대략적인 그림이에요. 노란 점선 원은 넓이가 숫자에 비례해요(아주 큰 수는 크기를 줄였어요).': 'Circles, arrows and place markers are approximate drawings. The area of a yellow dashed circle is proportional to the number (very large numbers are scaled down).',
    '아시아': 'Asia', '유럽': 'Europe', '중동·아프리카': 'Middle East and Africa', '세계': 'World',
    '당시 사진 · 누르면 커져요': 'Photos from the time · tap to enlarge', '사진 없음': 'No photo', '사진 크게 보기': 'Enlarged photo', '위키미디어 공용': 'Wikimedia Commons',
    '가로 전체 화면으로 봐요': 'View in landscape full screen', '시작': 'Start', '그냥 보기': 'View as is', '세로로 그냥 보기': 'View in portrait', '폰을 가로로': 'Turn your phone', '돌려 주세요': 'to landscape'
  };
  var CC = {"미국":"United States","미합중국":"United States","미 국":"United States","중국":"China","중화인민공화국":"China","한국":"South Korea","대한민국":"South Korea","남한":"South Korea","북한":"North Korea","조선":"North Korea","일본":"Japan","대만":"Taiwan","러시아":"Russia","영국":"United Kingdom","잉글랜드":"England","독일":"Germany","프랑스":"France","인도":"India","캐나다":"Canada","호주":"Australia","튀르키예":"Türkiye","터키":"Türkiye","아랍에미리트":"United Arab Emirates","이탈리아":"Italy","스페인":"Spain","브라질":"Brazil","멕시코":"Mexico","사우디":"Saudi Arabia","사우디아라비아":"Saudi Arabia","파나마":"Panama","라이베리아":"Liberia","마셜제도":"Marshall Islands","홍콩":"Hong Kong","싱가포르":"Singapore","몰타":"Malta","바하마":"Bahamas","그리스":"Greece","노르웨이":"Norway","인도네시아":"Indonesia","베트남":"Vietnam","태국":"Thailand","말레이시아":"Malaysia","필리핀":"Philippines","키프로스":"Cyprus","포르투갈":"Portugal","덴마크":"Denmark","네덜란드":"Netherlands","아르헨티나":"Argentina","칠레":"Chile","페루":"Peru","에콰도르":"Ecuador","뉴질랜드":"New Zealand","스웨덴":"Sweden","핀란드":"Finland","아이슬란드":"Iceland","이란":"Iran","이집트":"Egypt","나이지리아":"Nigeria","방글라데시":"Bangladesh","스리랑카":"Sri Lanka","파키스탄":"Pakistan","미얀마":"Myanmar","버마":"Myanmar","캄보디아":"Cambodia","앤티가바부다":"Antigua and Barbuda","세인트빈센트그레나딘":"St. Vincent and the Grenadines","토고":"Togo","카메룬":"Cameroon","팔라우":"Palau","바누아투":"Vanuatu","키리바시":"Kiribati","피지":"Fiji","벨기에":"Belgium","폴란드":"Poland","우크라이나":"Ukraine","크로아티아":"Croatia","모로코":"Morocco","세네갈":"Senegal","콜롬비아":"Colombia","탄자니아":"Tanzania","케냐":"Kenya","남아프리카공화국":"South Africa","오만":"Oman","카타르":"Qatar","쿠웨이트":"Kuwait","우루과이":"Uruguay","베네수엘라":"Venezuela","쿠바":"Cuba","벨리즈":"Belize","온두라스":"Honduras","코모로":"Comoros","시에라리온":"Sierra Leone","투발루":"Tuvalu","스위스":"Switzerland","아일랜드":"Ireland","에스토니아":"Estonia","라트비아":"Latvia","리투아니아":"Lithuania","조지아":"Georgia","이스라엘":"Israel","몰디브":"Maldives","브루나이":"Brunei","파푸아뉴기니":"Papua New Guinea","솔로몬제도":"Solomon Islands","통가":"Tonga","사모아":"Samoa","나우루":"Nauru","미크로네시아":"Micronesia","몽골":"Mongolia","모잠비크":"Mozambique","마다가스카르":"Madagascar","모리셔스":"Mauritius","세이셸":"Seychelles","가나":"Ghana","코트디부아르":"Côte d'Ivoire","앙골라":"Angola","나미비아":"Namibia","모리타니":"Mauritania","알제리":"Algeria","튀니지":"Tunisia","리비아":"Libya","루마니아":"Romania","불가리아":"Bulgaria","그린란드":"Greenland","카자흐스탄":"Kazakhstan","콩고민주공화국":"DR Congo","남극":"Antarctica","수단":"Sudan","에티오피아":"Ethiopia","말리":"Mali","차드":"Chad","니제르":"Niger","볼리비아":"Bolivia","이라크":"Iraq","아프가니스탄":"Afghanistan","우즈베키스탄":"Uzbekistan","투르크메니스탄":"Turkmenistan","예멘":"Yemen","소말리아":"Somalia","잠비아":"Zambia","보츠와나":"Botswana","짐바브웨":"Zimbabwe","가봉":"Gabon","콩고":"Republic of the Congo","중앙아프리카공화국":"Central African Republic","남수단":"South Sudan","파라과이":"Paraguay","네팔":"Nepal","시리아":"Syria","요르단":"Jordan","벨라루스":"Belarus","키르기스스탄":"Kyrgyzstan","타지키스탄":"Tajikistan","라오스":"Laos","동티모르":"Timor-Leste","오스트리아":"Austria","체코":"Czechia","헝가리":"Hungary","세르비아":"Serbia","레바논":"Lebanon","바레인":"Bahrain","기니":"Guinea","부르키나파소":"Burkina Faso","우간다":"Uganda","에리트레아":"Eritrea","과테말라":"Guatemala","니카라과":"Nicaragua","코스타리카":"Costa Rica","도미니카공화국":"Dominican Republic","아이티":"Haiti","자메이카":"Jamaica","가이아나":"Guyana","수리남":"Suriname","아제르바이잔":"Azerbaijan","아르메니아":"Armenia","몰도바":"Moldova","슬로바키아":"Slovakia","부탄":"Bhutan","말라위":"Malawi","르완다":"Rwanda","베냉":"Benin","태평양":"Pacific Ocean","대서양":"Atlantic Ocean","인도양":"Indian Ocean","남극해":"Southern Ocean","북극해":"Arctic Ocean","동해":"East Sea","서해":"Yellow Sea","동중국해":"East China Sea","남중국해":"South China Sea","필리핀해":"Philippine Sea","지중해":"Mediterranean Sea","아라비아해":"Arabian Sea","벵골만":"Bay of Bengal","카리브해":"Caribbean Sea","멕시코만":"Gulf of Mexico","북해":"North Sea","오호츠크해":"Sea of Okhotsk","베링해":"Bering Sea","산호해":"Coral Sea","태즈먼해":"Tasman Sea","홍해":"Red Sea","흑해":"Black Sea","발트해":"Baltic Sea","페르시아만":"Persian Gulf"};
  var k; for (k in UI) MAP[k] = UI[k]; for (k in CC) MAP[k] = CC[k];
  var CCK = Object.keys(CC).sort(function (a, b) { return b.length - a.length; });
  var CCRE = new RegExp('(' + CCK.map(function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'g');
  var MO = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var R = [
    [/(\d{1,2})\. (\d{1,2})\. (오전|오후) (\d{1,2}):(\d{2})/g, function (m, mo, d, ap, h, mi) { return mo + '/' + d + ' ' + h + ':' + mi + (ap === '오전' ? ' AM' : ' PM'); }],
    [/(\d{3,4})년 (\d{1,2})월 ?(\d{1,2})일/g, function (m, y, mo, d) { return MO[+mo - 1] + ' ' + d + ', ' + y; }],
    [/(\d{3,4})년 (\d{1,2})월/g, function (m, y, mo) { return MO[+mo - 1] + ' ' + y; }],
    [/\(한국 시간\)/g, '(KST)'], [/배: Global Fishing Watch, AISStream · 비행기: adsb\.lol/g, 'Ships: Global Fishing Watch, AISStream · Aircraft: adsb.lol'], [/지도: 지도·위성: /g, 'Map: imagery: '],
    [/^(\d+)\/(\d+) 단계 · /, 'Step $1/$2 · '], [/ · (\d+)단계$/, ' · $1 steps'], [/ · (\d+)개 장면$/, ' · $1 scenes'], [/^(\d+)단계$/, 'Step $1'],
    [/^더 보기 자료: /, 'More layers data: '], [/ · 한국 주변 바다만/, ' · seas around Korea only'],
    [/^실시간 배 \(연안 수신 기준\): ([\d,]+)척/, 'Live ships (coastal reception): $1'], [/^실시간 배 \(연안 수신 기준\) (\d+)척/, 'Live ships (coastal reception): $1'],
    [/^배: (.+) 하루 기록이에요\. Global Fishing Watch 자료라 며칠 늦게 들어와요\./, 'Ships: daily record for $1. Global Fishing Watch data arrives a few days late.'],
    [/^비행기 (.+) 기준 \(KST\) · 10분마다 새로 받아요/, 'Aircraft as of $1 (KST) · refreshed every 10 minutes'],
    [/ 기준 \(KST\) · 10분마다 새로 받아요/, ' (KST) · refreshed every 10 minutes'],
    [/^지금 화면에 ([\d,]+)대가 있어서 (\d+)대 중 1대만 그려요\. 확대하면 다 보여요\./, '$1 aircraft in view, so 1 in every $2 is drawn. Zoom in to see all.'],
    [/^GPS 전파 방해 구역 \(추정\) · 비행기 (\d+)대 중 (\d+)대/, 'GPS interference area (estimated) · $2 of $1 aircraft'],
    [/^비행기 (\d+)대 중 (\d+)대가 위치 정확도가 낮게 보고됐어요\./, '$2 of $1 aircraft reported low position accuracy.'],
    [/^위치: 위도 ([-\d.]+), 경도 ([-\d.]+) 근처/, 'Location: near latitude $1, longitude $2'],
    [/^원인은 알 수 없어요 · 출처: /, 'Source of interference unknown · Data: '],
    [/^위성 화재 · 열점 ([\d,]+)곳/, 'Satellite fire · $1 hotspots'], [/열점 ([\d,]+)곳 \(1도 칸, 최근 24시간\)/, '$1 hotspots (1-degree cell, last 24 hours)'],
    [/^자료 시간: /, 'Data time: '], [/^시간: /, 'Time: '], [/^수신: (.+) 무렵/, 'Received: around $1'],
    [/^분쟁 사건 기사 ([\d,]+)건/, 'Conflict event articles: $1'], [/^최근 24시간 기사 ([\d,]+)건 \(1도 칸\)/, 'Articles in the last 24 hours: $1 (1-degree cell)'],
    [/^종류: 공격 (\d+) · 무력 충돌 (\d+) · 대량 폭력 (\d+)/, 'Type: attacks $1 · armed clashes $2 · mass violence $3'], [/^종류: /, 'Type: '],
    [/^마지막 기사: /, 'Latest article: '], [/^기사에 나온 장소 기준이에요 · 출처: GDELT/, 'Location as named in articles · Source: GDELT'],
    [/^장소: /, 'Place: '], [/위도 ([-\d.]+), 경도 ([-\d.]+)/g, 'latitude $1, longitude $2'], [/^깊이 ([\d.]+)km/, 'Depth $1 km'],
    [/^(폭발|지진) 규모 ([\d.]+)/, function (m, t, v) { return (t === '폭발' ? 'Explosion' : 'Earthquake') + ' magnitude ' + v; }],
    [/^배 ([\d,]+)척 기록$/, '$1 ships recorded'], [/^이 칸 배 ([\d,]+)척 중 (\d+)척만 칸 안에 흩어 그렸어요\. 실제 위치가 아니에요\./, 'Only $2 of $1 ships in this cell are scattered inside it. These are not actual positions.'],
    [/^칸: 위도 ([-\d.]+)~([-\d.]+)도, 경도 ([-\d.]+)~([-\d.]+)도/, 'Cell: latitude $1 to $2, longitude $3 to $4'],
    [/^날짜: (.+) \(하루\) · 색은 가장 많은 나라/, 'Date: $1 (one day) · color shows the most common country'], [/^날짜: (.+) · 출처: Global Fishing Watch/, 'Date: $1 · Source: Global Fishing Watch'],
    [/^등록 나라: /, 'Country of registration: '], [/^나라: /, 'Country: '], [/^고도: /, 'Altitude: '], [/^속도: /, 'Speed: '], [/ · 방향 (\d+)도/, ' · heading $1°'], [/^기체: /, 'Aircraft type: '], [/ · 고유 번호 /, ' · ICAO address '],
    [/^출처: AISStream 실시간 배/, 'Source: AISStream live ships'], [/^출처: /, 'Source: '], [/ · 군용기 표시/, ' · military flag'],
    [/^비행 회피 구역 안내: /, 'Flight avoidance bulletins: '], [/, ([\d-]+)까지/g, ', valid until $1'], [/ · ([\d-]+)까지/g, ' · valid until $1'], [/^비행 회피 구역 · /, 'Flight avoidance zone · '],
    [/^배: Global Fishing Watch (\S*) 하루 기록 · 비행기: adsb\.lol /, 'Ships: Global Fishing Watch daily record $1 · Aircraft: adsb.lol '],
    [/^분쟁 사건·위성 화재: 최근 24시간 · 지진·폭발: 최근 7일 \(USGS\)/, 'Conflict events and fires: last 24 hours · Earthquakes and explosions: last 7 days (USGS)'],
    [/^나라 경계: 바다 위 기록은 나라 숫자에 안 들어가요\./, 'Borders: records over the sea are not counted in country numbers.'],
    [/^피해: /, 'Toll: '], [/^· (.+) 사진: /, '· $1 photo: '], [/ \(위키미디어 공용/, ' (Wikimedia Commons'],
    [/^([\d,]+)(대|척)$/, '$1'], [/나라 기록 없음/g, 'No country on record'], [/기타 나라/g, 'Other countries'], [/정보 없음/g, 'no data'], [/없음/g, 'none'], [/([\d,]+)척\b/g, '$1 ships'], [/([\d,]+)척/g, '$1 ships'], [/([\d,]+)대/g, '$1 aircraft'], [/([\d,]+)건/g, '$1'], [/([\d,]+)곳/g, '$1']
  ];
  var HAN = /[\uac00-\ud7a3]/;
  var tr = function (s) {
    if (!s || !HAN.test(s)) return s;
    var t = s.trim(), lead = s.slice(0, s.indexOf(t)), tail = s.slice(s.indexOf(t) + t.length);
    if (MAP[t] != null) return lead + MAP[t] + tail;
    var o = t; for (var i = 0; i < R.length; i++) o = o.replace(R[i][0], R[i][1]);
    if (MAP[o.trim()] != null) o = MAP[o.trim()];
    if (HAN.test(o)) { var o2 = o.replace(CCRE, function (m) { return CC[m]; }); if (!HAN.test(o2)) o = o2; }
    return lead + o + tail;
  };
  window.mtT = tr;
  var ATTR = ['placeholder', 'aria-label', 'title', 'alt'];
  var walk = function (root) {
    if (root.nodeType === 3) { var v = tr(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; return; }
    if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE' || root.getAttribute('data-noi18n')) return;
    for (var a = 0; a < ATTR.length; a++) { var x = root.getAttribute(ATTR[a]); if (x && HAN.test(x)) root.setAttribute(ATTR[a], tr(x)); }
    if (root.tagName === 'INPUT' && root.type !== 'checkbox' && root.value && HAN.test(root.value)) root.value = tr(root.value);
    for (var c = root.firstChild; c; c = c.nextSibling) walk(c);
  };
  /* 자료 파일 영어로: 표시 문구만 바꾸고 코드가 비교하는 값(reg, tag, id)은 그대로 */
  var KEEP = { reg: 1, tag: 1, id: 1, cc: 1, img: 1, url: 1, sec: 1 };
  var deep = function (x, key) {
    if (typeof x === 'string') return KEEP[key] ? x : tr(x);
    if (Array.isArray(x)) return x.map(function (v) { return deep(v, key); });
    if (x && typeof x === 'object') { var o = {}; for (var kk in x) o[kk] = deep(x[kk], kk); return o; }
    return x;
  };
  var of = window.fetch.bind(window);
  var dictP = of('data/i18n/skysea_en.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) { for (var kk in j) if (MAP[kk] == null) MAP[kk] = j[kk]; }).catch(function () {});
  var DATA = /data\/(worldhist\/[^?]+|scenarios\/[^?]+|usregime\.json|histphotos\.json)/;
  window.fetch = function (u, o) {
    var s = typeof u === 'string' ? u : (u && u.url) || '';
    if (!DATA.test(s)) return of(u, o);
    return Promise.all([of(u, o), dictP]).then(function (a) { var r = a[0]; if (!r.ok) return r;
      return r.json().then(function (j) { return new Response(JSON.stringify(deep(j, '')), { status: 200, headers: { 'Content-Type': 'application/json' } }); }); });
  };
  var start = function () {
    setBtn(); walk(document.body);
    new MutationObserver(function (ms) { ms.forEach(function (m) {
      if (m.type === 'characterData') { var v = tr(m.target.nodeValue); if (v !== m.target.nodeValue) m.target.nodeValue = v; }
      else if (m.type === 'attributes') { if (m.target.getAttribute('data-noi18n')) return; var x = m.target.getAttribute(m.attributeName); if (x && HAN.test(x)) m.target.setAttribute(m.attributeName, tr(x)); }
      else m.addedNodes.forEach(walk);
    }); }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
    document.addEventListener('click', function () { setTimeout(function () { var q = document.getElementById('q'); if (q && HAN.test(q.value)) q.value = tr(q.value); }, 0); }, true);
    dictP.then(function () { walk(document.body); });
    if (window.mtMap && window.mtMap.attributionControl) setTimeout(function () { walk(document.querySelector('.leaflet-control-attribution') || document.body); }, 500);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
