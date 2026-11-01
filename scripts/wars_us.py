"""미국의 큰 전쟁. 날짜·숫자는 각 장면 src(공식·백과사전) 기준."""
WP = 'https://en.wikipedia.org/wiki/'
COL13 = [[45.0, -67.0], [45.0, -71.5], [45.0, -74.7], [43.6, -76.5], [42.0, -79.8], [41.7, -83.4], [45.8, -84.0], [47.0, -88.5], [49.0, -95.0], [47.0, -95.2], [43.0, -91.2], [37.0, -89.2], [31.0, -91.6], [31.0, -85.0], [30.7, -81.5], [32.0, -80.8], [34.7, -76.6], [35.2, -75.5], [37.0, -76.0], [38.9, -75.0], [40.5, -74.0], [41.2, -71.9], [41.6, -70.0], [43.5, -70.2]]
CSA = [[36.5, -75.9], [36.6, -81.7], [36.6, -88.0], [36.5, -89.5], [36.5, -94.6], [33.6, -94.5], [34.0, -100.0], [32.0, -103.0], [32.0, -106.6], [29.5, -104.5], [26.0, -97.2], [29.5, -94.5], [29.2, -89.2], [30.3, -88.0], [29.7, -85.0], [25.2, -80.5], [30.7, -81.4], [32.0, -80.8], [34.7, -76.5]]
CSA_E = [[36.5, -75.9], [36.6, -81.7], [36.6, -88.0], [35.0, -90.1], [32.3, -90.9], [31.0, -91.6], [29.2, -89.2], [30.3, -88.0], [29.7, -85.0], [25.2, -80.5], [30.7, -81.4], [32.0, -80.8], [34.7, -76.5]]
CSA_W = [[36.5, -90.0], [36.5, -94.6], [33.6, -94.5], [34.0, -100.0], [32.0, -103.0], [32.0, -106.6], [29.5, -104.5], [26.0, -97.2], [29.5, -94.5], [29.5, -91.4], [31.0, -91.6], [32.3, -90.9], [35.0, -90.1]]
CSA_E2 = [[36.5, -75.9], [36.6, -81.7], [35.0, -84.3], [34.0, -85.2], [32.1, -81.1], [32.0, -80.8], [34.7, -76.5]]
JP42 = [[53, 121], [45, 135], [42, 142], [50, 155], [30, 160], [20, 167], [0, 170], [-10, 160], [-9, 147], [-8, 130], [-10, 120], [-5, 95], [5, 95], [20, 93], [25, 97], [23, 105], [28, 115], [40, 117], [42, 120]]
JP44 = [[53, 121], [45, 135], [42, 142], [46, 152], [30, 142], [15, 140], [5, 128], [-8, 128], [-10, 120], [-5, 95], [5, 95], [20, 93], [25, 97], [23, 105], [28, 115], [40, 117], [42, 120]]
JP45 = [[53, 121], [45, 135], [42, 142], [46, 152], [31, 140], [26, 127], [22, 121], [10, 115], [-8, 125], [-10, 115], [-5, 95], [5, 95], [16, 96], [23, 103], [28, 115], [40, 117], [42, 120]]
NVN = [[23.3, 105.3], [22.5, 106.7], [21.5, 108.0], [19.0, 105.8], [17.0, 107.1], [17.0, 106.5], [17.5, 105.6], [19.0, 104.0], [20.5, 104.5], [21.5, 102.5], [22.8, 102.3]]
SVN = [[17.0, 107.1], [16.0, 108.3], [13.0, 109.3], [11.5, 109.2], [10.3, 107.0], [8.6, 104.8], [10.4, 104.4], [11.0, 105.8], [12.0, 106.4], [14.5, 107.5], [16.0, 107.4], [17.0, 106.5]]
KW = [[30.1, 47.7], [29.4, 46.5], [29.1, 46.5], [28.5, 48.4], [29.9, 48.4]]
IQ = [[37.3, 42.4], [37.1, 44.8], [35.6, 46.0], [33.0, 46.1], [31.0, 47.7], [30.0, 48.6], [29.1, 46.5], [31.0, 42.0], [32.0, 39.0], [33.4, 38.8], [34.6, 41.0]]
IQS = [[31.0, 47.7], [30.0, 48.6], [29.1, 46.5], [30.5, 44.5], [32.5, 44.4], [33.3, 44.4], [33.0, 46.1]]

def wars(T):
    def F(d, ko, en, src, **k):
        k.update(d=d, t=T(ko, en), src=[T(src[0], src[1]) if len(src) == 3 else src[0], src[-1]])
        for key in ('bt', 'nc'):
            for x in k.get(key, []):
                x[-1] = T(*x[-1]) if isinstance(x[-1], tuple) else x[-1]
        return k
    S = lambda n, u: [n, u]
    out = []
    # 1 독립전쟁
    a = WP + 'American_Revolutionary_War'
    out.append(dict(id='war_us_rev', title=T('미국 독립전쟁', 'American Revolutionary War'), period=T('1775~1783', '1775–1783'),
        view=[[30, -86], [47, -64]], sides={'a': [T('대륙군(미국)', 'Continental Army (US)'), '#4ea1ff'], 'b': [T('영국군', 'British forces'), '#ff6b6b'], 'f': [T('프랑스군', 'French forces'), '#ffd23f']},
        toll=T('미국 측 전투 사망 약 6,800명 (출처: Wikipedia)', 'About 6,800 American battle deaths (source: Wikipedia)'),
        sources=[S('Wikipedia: American Revolutionary War', a), S('미국 국립문서보관소: 독립선언문', 'https://www.archives.gov/founding-docs/declaration'), S('미국 국무부 역사실: 파리 조약 1783', 'https://history.state.gov/milestones/1776-1783/treaty'), S('미국 국립공원청: 요크타운', 'https://www.nps.gov/york/index.htm')],
        frames=[
         F('1775-04-19', '렉싱턴·콩코드에서 첫 전투가 벌어져요', 'The first battles are fought at Lexington and Concord', ('Wikipedia: Battles of Lexington and Concord', WP + 'Battles_of_Lexington_and_Concord'),
           bt=[[42.45, -71.3, ('렉싱턴·콩코드', 'Lexington and Concord')]], ar=[[42.36, -71.06, 42.46, -71.33, 'b']], fx=[[42.45, -71.3]], v=[[41.5, -73.5], [43.3, -69.5]]),
         F('1776-07-04', '대륙회의가 독립선언문을 채택해요', 'The Continental Congress adopts the Declaration of Independence', ('미국 국립문서보관소: 독립선언문', 'US National Archives: Declaration of Independence', 'https://www.archives.gov/founding-docs/declaration'),
           bt=[[39.95, -75.15, ('필라델피아', 'Philadelphia')]], zn=[['a', COL13]], v=[[30, -86], [47, -64]]),
         F('1776-08-27', '롱아일랜드 전투에서 영국군이 이기고 뉴욕을 차지해요', 'British forces win the Battle of Long Island and take New York', ('Wikipedia: Battle of Long Island', WP + 'Battle_of_Long_Island'),
           bt=[[40.65, -73.95, ('롱아일랜드', 'Long Island')]], ar=[[40.2, -73.3, 40.62, -73.98, 'b']], fx=[[40.65, -73.95]], zn=[['a', COL13], ['b', [[41.1, -74.3], [41.1, -73.4], [40.5, -73.4], [40.5, -74.3]]]], v=[[38.5, -77.5], [43.0, -70.5]]),
         F('1777-10-17', '새러토가에서 영국 버고인 장군의 부대가 항복해요', 'British General Burgoyne\'s army surrenders at Saratoga', ('Wikipedia: Battles of Saratoga', WP + 'Battles_of_Saratoga'),
           bt=[[43.0, -73.64, ('새러토가', 'Saratoga')]], ar=[[45.0, -73.4, 43.1, -73.6, 'b'], [42.4, -73.7, 42.95, -73.65, 'a']], fx=[[43.0, -73.64]], zn=[['a', COL13], ['b', [[41.1, -74.3], [41.1, -73.4], [40.5, -73.4], [40.5, -74.3]]]], v=[[39.5, -77.5], [46.0, -70.0]]),
         F('1778-02-06', '프랑스가 미국과 동맹 조약을 맺어요', 'France signs a treaty of alliance with the United States', ('Wikipedia: Treaty of Alliance (1778)', WP + 'Treaty_of_Alliance_(1778)'),
           ar=[[46.0, -40.0, 39.5, -70.5, 'f']], zn=[['a', COL13]], v=[[28, -90], [52, -30]]),
         F('1781-10-19', '요크타운에서 영국 콘월리스 장군이 미국·프랑스군에 항복해요', 'British General Cornwallis surrenders to US and French forces at Yorktown', ('미국 국립공원청: 요크타운', 'US National Park Service: Yorktown', 'https://www.nps.gov/york/index.htm'),
           bt=[[37.24, -76.51, ('요크타운', 'Yorktown')]], ar=[[39.3, -76.6, 37.35, -76.6, 'a'], [38.9, -77.6, 37.3, -76.7, 'f'], [36.85, -75.6, 37.1, -76.25, 'f']], fx=[[37.24, -76.51]],
           nc=[[37.24, -76.51, 7500, ('영국군 약 7,400~7,700명 포로', 'About 7,400–7,700 British troops captured')]], zn=[['a', COL13]], v=[[35.5, -79.5], [39.8, -74.0]]),
         F('1783-09-03', '파리 조약으로 영국이 미국 독립을 인정해요', 'In the Treaty of Paris, Britain recognizes US independence', ('미국 국무부 역사실: 파리 조약 1783', 'Office of the Historian: Treaty of Paris, 1783', 'https://history.state.gov/milestones/1776-1783/treaty'),
           zn=[['a', COL13]], v=[[28, -96], [50, -64]]),
        ]))
    # 2 남북전쟁
    out.append(dict(id='war_us_civil', title=T('남북전쟁', 'American Civil War'), period=T('1861~1865', '1861–1865'),
        view=[[24, -106], [45, -70]], sides={'u': [T('북부(연방)', 'Union'), '#4ea1ff'], 'c': [T('남부(연합)', 'Confederacy'), '#ff6b6b']},
        toll=T('사망자 약 62만~75만 명 (군인 기준, 연구마다 다름 · 출처: Wikipedia, NPS)', 'About 620,000–750,000 deaths (soldiers; estimates vary · sources: Wikipedia, NPS)'),
        sources=[S('Wikipedia: American Civil War', WP + 'American_Civil_War'), S('미국 국립공원청 (NPS) Civil War', 'https://www.nps.gov/subjects/civilwar/index.htm')],
        frames=[
         F('1861-04-12', '남부군이 섬터 요새를 포격하며 전쟁이 시작돼요', 'Confederate forces bombard Fort Sumter and the war begins', ('미국 국립공원청: 섬터 요새', 'NPS: Fort Sumter', 'https://www.nps.gov/fosu/index.htm'),
           bt=[[32.75, -79.87, ('섬터 요새', 'Fort Sumter')]], ar=[[33.3, -80.6, 32.78, -79.9, 'c']], fx=[[32.75, -79.87]], zn=[['c', CSA]]),
         F('1861-07-21', '첫 큰 전투인 1차 불런 전투에서 남부군이 이겨요', 'The Confederacy wins the First Battle of Bull Run, the first major battle', ('미국 국립공원청: 매너서스', 'NPS: Manassas', 'https://www.nps.gov/mana/index.htm'),
           bt=[[38.81, -77.52, ('불런', 'Bull Run')]], ar=[[38.9, -77.05, 38.82, -77.45, 'u'], [38.6, -78.3, 38.8, -77.6, 'c']], fx=[[38.81, -77.52]], zn=[['c', CSA]], v=[[36.5, -80.5], [40.5, -75.0]]),
         F('1862-09-17', '앤티텀 전투, 하루 동안 양측 사상자 약 2만 3천 명', 'Battle of Antietam: about 23,000 casualties on both sides in one day', ('미국 국립공원청: 앤티텀', 'NPS: Antietam', 'https://www.nps.gov/anti/index.htm'),
           bt=[[39.47, -77.74, ('앤티텀', 'Antietam')]], ar=[[38.9, -78.0, 39.4, -77.78, 'c'], [39.6, -77.3, 39.48, -77.7, 'u']], fx=[[39.47, -77.74]], nc=[[39.47, -77.74, 23000, ('사상자 약 2만 3천 명', 'About 23,000 casualties')]], zn=[['c', CSA]]),
         F('1863-07-03', '게티즈버그 전투에서 남부군의 북진이 막혀요', 'The Confederate advance north is stopped at Gettysburg', ('미국 국립공원청: 게티즈버그', 'NPS: Gettysburg', 'https://www.nps.gov/gett/index.htm'),
           bt=[[39.82, -77.23, ('게티즈버그', 'Gettysburg')]], ar=[[38.4, -78.4, 39.75, -77.3, 'c'], [39.95, -76.6, 39.84, -77.18, 'u']], fx=[[39.82, -77.23]], nc=[[39.82, -77.23, 51000, ('사상자 약 5만 1천 명 (양측)', 'About 51,000 casualties (both sides)')]], zn=[['c', CSA]]),
         F('1863-07-04', '빅스버그가 함락돼 북부가 미시시피강을 차지해요', 'Vicksburg falls and the Union controls the Mississippi River', ('미국 국립공원청: 빅스버그', 'NPS: Vicksburg', 'https://www.nps.gov/vick/index.htm'),
           bt=[[32.35, -90.88, ('빅스버그', 'Vicksburg')]], ar=[[35.1, -90.1, 32.45, -90.9, 'u']], fx=[[32.35, -90.88]], zn=[['c', CSA_E], ['c', CSA_W]], ln=[[[37.0, -89.2], [35.0, -90.1], [32.3, -90.9], [31.0, -91.6], [29.2, -89.2]]]),
         F('1864-09-02', '셔먼 장군의 북부군이 애틀랜타를 점령해요', 'General Sherman\'s Union army captures Atlanta', ('Wikipedia: Atlanta campaign', WP + 'Atlanta_campaign'),
           bt=[[33.75, -84.39, ('애틀랜타', 'Atlanta')]], ar=[[35.05, -85.3, 33.8, -84.4, 'u']], fx=[[33.75, -84.39]], zn=[['c', CSA_E], ['c', CSA_W]]),
         F('1864-12-21', '바다로의 행군 끝에 사바나를 차지해요', 'After the March to the Sea, the Union takes Savannah', ('Wikipedia: Sherman\'s March to the Sea', WP + "Sherman's_March_to_the_Sea"),
           bt=[[32.08, -81.09, ('사바나', 'Savannah')]], ar=[[33.75, -84.39, 32.1, -81.15, 'u']], fx=[[32.08, -81.09]], zn=[['c', CSA_E2], ['c', CSA_W]], v=[[29.5, -88.0], [38.5, -74.5]]),
         F('1865-04-09', '애퍼매톡스에서 리 장군이 항복해요', 'General Lee surrenders at Appomattox', ('미국 국립공원청: 애퍼매톡스', 'NPS: Appomattox Court House', 'https://www.nps.gov/apco/index.htm'),
           bt=[[37.38, -78.8, ('애퍼매톡스', 'Appomattox')]], ar=[[37.2, -77.4, 37.37, -78.75, 'u']], zn=[['u', CSA]], v=[[24, -106], [45, -70]]),
        ]))
    # 3 태평양전쟁
    out.append(dict(id='war_us_pacific', title=T('태평양 전쟁', 'Pacific War'), period=T('1941~1945', '1941–1945'),
        view=[[-15, 95], [55, 180]], sides={'a': [T('미국·연합국', 'US and Allies'), '#4ea1ff'], 'j': [T('일본', 'Japan'), '#ff6b6b']},
        toll=T('진주만 미국인 사망 2,403명 · 일본 군인 사망 213만 명 이상 (1937~1945 · 출처: Wikipedia)', '2,403 Americans killed at Pearl Harbor · over 2.13 million Japanese military deaths (1937–1945 · source: Wikipedia)'),
        sources=[S('Wikipedia: Pacific War', WP + 'Pacific_War'), S('미국 국립문서보관소: 일본 항복 문서', 'https://www.archives.gov/milestone-documents/surrender-of-japan')],
        frames=[
         F('1941-12-07', '일본이 진주만을 공습해요. 미국인 약 2,400명이 숨져요', 'Japan attacks Pearl Harbor. About 2,400 Americans are killed', ('미국 국립공원청: 진주만', 'NPS: Pearl Harbor National Memorial', 'https://www.nps.gov/perl/index.htm'),
           bt=[[21.36, -157.95, ('진주만', 'Pearl Harbor')]], ar=[[29.0, -162.0, 21.5, -158.0, 'j']], fx=[[21.36, -157.95]], v=[[12, -170], [33, -150]], nc=[[21.36, -157.95, 2400, ('사망 약 2,400명', 'About 2,400 killed')]], zn=[['j', JP42]]),
         F('1942-06-04', '미드웨이 해전에서 일본 항공모함 4척이 가라앉아요', 'Four Japanese aircraft carriers are sunk at the Battle of Midway', ('Wikipedia: Battle of Midway', WP + 'Battle_of_Midway'),
           bt=[[28.2, -177.37, ('미드웨이', 'Midway')]], ar=[[34.0, -176.0, 29.0, -177.0, 'j'], [21.4, -158.0, 28.0, -174.0, 'a']], fx=[[30.0, -176.5]], v=[[15, -180], [38, -152]], zn=[['j', JP42]]),
         F('1942-08-07', '미군이 과달카날에 상륙해 반격을 시작해요', 'US forces land on Guadalcanal and begin a counteroffensive', ('Wikipedia: Guadalcanal campaign', WP + 'Guadalcanal_campaign'),
           bt=[[-9.43, 160.0, ('과달카날', 'Guadalcanal')]], ar=[[-18.0, 168.0, -9.6, 160.2, 'a']], fx=[[-9.43, 160.0]], zn=[['j', JP42]], v=[[-22, 135], [5, 178]]),
         F('1944-06-15', '미군이 사이판에 상륙해요', 'US forces land on Saipan', ('Wikipedia: Battle of Saipan', WP + 'Battle_of_Saipan'),
           bt=[[15.18, 145.75, ('사이판', 'Saipan')]], ar=[[8.0, 168.0, 15.1, 146.0, 'a']], fx=[[15.18, 145.75]], zn=[['j', JP44]], v=[[-15, 95], [55, 180]]),
         F('1944-10-20', '미군이 필리핀 레이테섬에 상륙해요', 'US forces land on Leyte in the Philippines', ('Wikipedia: Battle of Leyte', WP + 'Battle_of_Leyte'),
           bt=[[11.0, 125.0, ('레이테', 'Leyte')]], ar=[[8.0, 140.0, 11.0, 125.4, 'a']], fx=[[11.0, 125.0]], zn=[['j', JP44]]),
         F('1945-02-19', '미군이 이오지마에 상륙해요', 'US forces land on Iwo Jima', ('Wikipedia: Battle of Iwo Jima', WP + 'Battle_of_Iwo_Jima'),
           bt=[[24.78, 141.32, ('이오지마', 'Iwo Jima')]], ar=[[15.2, 145.8, 24.6, 141.5, 'a']], fx=[[24.78, 141.32]], zn=[['j', JP45]]),
         F('1945-04-01', '미군이 오키나와에 상륙해요', 'US forces land on Okinawa', ('Wikipedia: Battle of Okinawa', WP + 'Battle_of_Okinawa'),
           bt=[[26.33, 127.8, ('오키나와', 'Okinawa')]], ar=[[18.0, 132.0, 26.2, 127.9, 'a']], fx=[[26.33, 127.8]], zn=[['j', JP45]]),
         F('1945-08-06', '히로시마(6일)와 나가사키(9일)에 원자폭탄이 떨어져요', 'Atomic bombs are dropped on Hiroshima (6th) and Nagasaki (9th)', ('Wikipedia: Atomic bombings of Hiroshima and Nagasaki', WP + 'Atomic_bombings_of_Hiroshima_and_Nagasaki'),
           bt=[[34.39, 132.45, ('히로시마', 'Hiroshima')], [32.75, 129.87, ('나가사키', 'Nagasaki')]], ar=[[15.0, 145.6, 34.2, 132.6, 'a'], [15.0, 145.6, 32.6, 130.0, 'a']], fx=[[34.39, 132.45], [32.75, 129.87]], zn=[['j', JP45]], v=[[12, 120], [40, 150]]),
         F('1945-09-02', '도쿄만 미주리함에서 일본이 항복 문서에 서명해요', 'Japan signs the instrument of surrender aboard USS Missouri in Tokyo Bay', ('미국 국립문서보관소: 일본 항복 문서', 'US National Archives: Surrender of Japan', 'https://www.archives.gov/milestone-documents/surrender-of-japan'),
           bt=[[35.35, 139.75, ('도쿄만', 'Tokyo Bay')]], zn=[['a', JP45]], v=[[-15, 95], [55, 180]]),
        ]))
    # 4 베트남전쟁
    out.append(dict(id='war_us_vietnam', title=T('베트남 전쟁', 'Vietnam War'), period=T('1964~1975 (미군 참전 기준)', '1964–1975 (US involvement)'),
        view=[[8, 100], [24, 112]], sides={'a': [T('미국·남베트남', 'US and South Vietnam'), '#4ea1ff'], 'n': [T('북베트남·베트콩', 'North Vietnam and Viet Cong'), '#ff6b6b']},
        toll=T('미군 사망 58,220명 (출처: 미국 국립문서보관소)', '58,220 US military deaths (source: US National Archives)'),
        sources=[S('Wikipedia: Vietnam War', WP + 'Vietnam_War'), S('미국 국립문서보관소: 베트남전 미군 사망 통계', 'https://www.archives.gov/research/military/vietnam-war/casualty-statistics'), S('미국 국무부 역사실: 통킹만 사건', 'https://history.state.gov/milestones/1961-1968/gulf-of-tonkin')],
        frames=[
         F('1964-08-02', '통킹만에서 북베트남 함정과 미 구축함이 충돌해요', 'North Vietnamese boats and a US destroyer clash in the Gulf of Tonkin', ('미국 국무부 역사실: 통킹만 사건', 'Office of the Historian: Gulf of Tonkin', 'https://history.state.gov/milestones/1961-1968/gulf-of-tonkin'),
           bt=[[19.7, 106.8, ('통킹만', 'Gulf of Tonkin')]], ar=[[20.6, 106.9, 19.8, 106.85, 'n']], fx=[[19.7, 106.8]], zn=[['n', NVN], ['a', SVN]]),
         F('1965-03-08', '미 해병대가 다낭에 상륙해요', 'US Marines land at Da Nang', ('Wikipedia: Vietnam War', WP + 'Vietnam_War'),
           bt=[[16.05, 108.2, ('다낭', 'Da Nang')]], ar=[[15.5, 111.0, 16.05, 108.35, 'a']], zn=[['n', NVN], ['a', SVN]]),
         F('1968-01-30', '북베트남·베트콩이 남베트남 곳곳에서 구정 공세를 벌여요', 'North Vietnam and the Viet Cong launch the Tet Offensive across South Vietnam', ('Wikipedia: Tet Offensive', WP + 'Tet_Offensive'),
           bt=[[10.78, 106.7, ('사이공', 'Saigon')], [16.46, 107.59, ('후에', 'Hue')]], ar=[[17.3, 106.7, 16.5, 107.5, 'n'], [11.6, 106.2, 10.85, 106.65, 'n'], [14.0, 107.6, 13.8, 108.7, 'n']], fx=[[10.78, 106.7], [16.46, 107.59], [13.8, 108.9]],
           nc=[[12.0, 104.5, 536000, ('미군 약 53만 6천 명 주둔 (1968년)', 'About 536,000 US troops in Vietnam (1968)')]], zn=[['n', NVN], ['a', SVN]]),
         F('1973-01-27', '파리 평화협정이 서명돼요', 'The Paris Peace Accords are signed', ('Wikipedia: Paris Peace Accords', WP + 'Paris_Peace_Accords'),
           zn=[['n', NVN], ['a', SVN]]),
         F('1973-03-29', '마지막 미군 전투부대가 베트남을 떠나요', 'The last US combat troops leave Vietnam', ('Wikipedia: Vietnam War', WP + 'Vietnam_War'),
           ar=[[10.8, 106.7, 12.0, 112.0, 'a']], zn=[['n', NVN], ['a', SVN]]),
         F('1975-04-30', '사이공이 함락되며 전쟁이 끝나요', 'Saigon falls and the war ends', ('Wikipedia: Fall of Saigon', WP + 'Fall_of_Saigon'),
           bt=[[10.78, 106.7, ('사이공', 'Saigon')]], ar=[[16.4, 107.6, 11.0, 106.8, 'n'], [12.7, 108.0, 11.0, 106.9, 'n']], fx=[[10.78, 106.7]], zn=[['n', NVN], ['n', SVN]]),
        ]))
    # 5 걸프전쟁
    out.append(dict(id='war_us_gulf', title=T('걸프 전쟁', 'Gulf War'), period=T('1990~1991', '1990–1991'),
        view=[[22, 38], [37, 52]], sides={'a': [T('미국·다국적군', 'US-led coalition'), '#4ea1ff'], 'i': [T('이라크', 'Iraq'), '#ff6b6b']},
        toll=T('미군 사망 292명 (적 공격 147명 · 출처: Wikipedia)', '292 US deaths (147 from enemy action · source: Wikipedia)'),
        sources=[S('Wikipedia: Gulf War', WP + 'Gulf_War'), S('Britannica: Persian Gulf War', 'https://www.britannica.com/event/Persian-Gulf-War')],
        frames=[
         F('1990-08-02', '이라크군이 쿠웨이트를 침공해요', 'Iraqi forces invade Kuwait', ('Wikipedia: Iraqi invasion of Kuwait', WP + 'Iraqi_invasion_of_Kuwait'),
           bt=[[29.37, 47.98, ('쿠웨이트시티', 'Kuwait City')]], ar=[[30.5, 47.6, 29.45, 47.95, 'i']], fx=[[29.37, 47.98]], zn=[['i', IQ], ['i', KW]]),
         F('1990-08-07', '사막의 방패 작전: 미군이 사우디아라비아로 가요', 'Operation Desert Shield: US forces deploy to Saudi Arabia', ('Wikipedia: Gulf War', WP + 'Gulf_War'),
           ar=[[24.0, 40.0, 27.0, 49.4, 'a'], [20.0, 58.0, 26.5, 50.0, 'a']], zn=[['i', IQ], ['i', KW]]),
         F('1991-01-17', '사막의 폭풍 작전: 다국적군이 이라크를 공습해요', 'Operation Desert Storm: the coalition begins air strikes on Iraq', ('Britannica: Persian Gulf War', 'https://www.britannica.com/event/Persian-Gulf-War'),
           bt=[[33.31, 44.36, ('바그다드', 'Baghdad')]], ar=[[26.5, 45.0, 33.2, 44.4, 'a'], [26.0, 50.5, 30.4, 47.8, 'a']], fx=[[33.31, 44.36], [30.5, 47.8], [32.0, 45.0]],
           nc=[[25.0, 45.0, 540000, ('미군 약 54만 명', 'About 540,000 US troops')]], zn=[['i', IQ], ['i', KW]]),
         F('1991-02-24', '지상전이 시작돼요', 'The ground offensive begins', ('Wikipedia: Gulf War', WP + 'Gulf_War'),
           ar=[[28.4, 48.3, 29.3, 47.9, 'a'], [28.9, 46.0, 30.6, 46.6, 'a'], [29.2, 44.5, 31.0, 46.0, 'a']], fx=[[29.3, 47.7]], zn=[['i', IQ], ['i', KW]]),
         F('1991-02-28', '쿠웨이트에서 이라크군이 밀려나고 휴전해요', 'Iraqi forces are driven out of Kuwait and a ceasefire takes effect', ('Britannica: Persian Gulf War', 'https://www.britannica.com/event/Persian-Gulf-War'),
           bt=[[29.37, 47.98, ('쿠웨이트시티', 'Kuwait City')]], zn=[['i', IQ], ['a', KW]]),
        ]))
    # 6 이라크전쟁
    out.append(dict(id='war_us_iraq', title=T('이라크 전쟁', 'Iraq War'), period=T('2003~2011', '2003–2011'),
        view=[[28, 37], [38.5, 50]], sides={'a': [T('미국·연합군', 'US-led coalition'), '#4ea1ff'], 'i': [T('이라크 정부군', 'Iraqi government forces'), '#ff6b6b']},
        toll=T('미군 사망 약 4,400명 (출처: Wikipedia)', 'About 4,400 US military deaths (source: Wikipedia)'),
        sources=[S('Wikipedia: Iraq War', WP + 'Iraq_War'), S('Britannica: Iraq War', 'https://www.britannica.com/event/Iraq-War')],
        frames=[
         F('2003-03-20', '미국 주도 연합군이 이라크를 공격해요', 'A US-led coalition attacks Iraq', ('Wikipedia: 2003 invasion of Iraq', WP + '2003_invasion_of_Iraq'),
           bt=[[33.31, 44.36, ('바그다드', 'Baghdad')]], ar=[[29.4, 47.3, 30.6, 46.7, 'a'], [29.5, 48.2, 30.5, 47.8, 'a']], fx=[[33.31, 44.36]], zn=[['i', IQ]]),
         F('2003-04-09', '바그다드가 연합군에 점령돼요', 'Baghdad falls to coalition forces', ('Britannica: Iraq War', 'https://www.britannica.com/event/Iraq-War'),
           bt=[[33.31, 44.36, ('바그다드', 'Baghdad')]], ar=[[31.0, 46.0, 33.2, 44.4, 'a'], [32.0, 45.0, 33.25, 44.3, 'a']], fx=[[33.31, 44.36]], zn=[['i', IQ], ['a', IQS]]),
         F('2003-12-13', '티크리트 근처에서 사담 후세인이 붙잡혀요', 'Saddam Hussein is captured near Tikrit', ('Wikipedia: Operation Red Dawn', WP + 'Operation_Red_Dawn'),
           bt=[[34.6, 43.68, ('티크리트', 'Tikrit')]], ar=[[33.4, 44.3, 34.5, 43.7, 'a']], zn=[['a', IQ]]),
         F('2007-01-10', '미군 증원이 발표돼 미군이 약 17만 명까지 늘어요', 'A US troop surge is announced, raising US forces to about 170,000', ('Wikipedia: Iraq War troop surge of 2007', WP + 'Iraq_War_troop_surge_of_2007'),
           nc=[[33.0, 43.5, 170000, ('미군 약 17만 명', 'About 170,000 US troops')]], zn=[['a', IQ]]),
         F('2011-12-18', '마지막 미군이 이라크를 떠나요', 'The last US troops leave Iraq', ('Wikipedia: Withdrawal of United States troops from Iraq (2007–2011)', WP + 'Withdrawal_of_United_States_troops_from_Iraq_(2007%E2%80%932011)'),
           ar=[[31.0, 46.5, 29.4, 47.6, 'a']]),
        ]))
    return out
