// 계약명 속 지번·건물번호를 가린다(동·리 이름은 남김). 모든 data/*.json 응답에 적용.
(()=>{const M=s=>typeof s!=='string'?s:s
 .replace(/\s?(산\s?)?\d+(-\d+)?\s?번지\s?(선|일원|일대|외)?/g,m=>/외$/.test(m)?' 외':/일원|일대/.test(m)?' 일원':' ')
 .replace(/(^|[\s(가-힣])(산\s?)?\d+(-\d+)?\s?(일원|일대)/g,'$1 일원')
 .replace(/([가-힣](?:동|리))\s?(산\s?)?\d+(-\d+)?(?=[\s,()·\]]|외|일원|주변|$)/g,'$1')
 .replace(/([로길])\s?\d+(-\d+)?(?=[\s,()·]|$)/g,'$1')
 .replace(/(^|[\s(])(산\s?)?\d{1,5}-\d{1,5}(?=[\s,()·]|$)/g,'$1')
 .replace(/\s{2,}/g,' ').replace(/\s+([,)\]])/g,'$1').trim();
window.maskT=M;const K=new Set(['title','t','detail']);
const walk=o=>{if(Array.isArray(o))o.forEach(walk);else if(o&&typeof o==='object')for(const k in o){if(K.has(k)&&typeof o[k]==='string')o[k]=window.maskT(o[k]);else if(typeof o[k]==='object')walk(o[k]);}return o;};
const J=Response.prototype.json;Response.prototype.json=function(){const u=this.url||'';return J.call(this).then(d=>/\/data\//.test(u)?walk(d):d);};})();
// 인명은 아주 좁게만 가린다. 2~4글자 이름이 공백 하나 뒤의 종목·꿈나무·선수·장학 말 바로 앞에 있을 때만.
// 예: 최경주 골프꿈나무 → ○○○ 골프꿈나무
// 꿈나무도서관, 송파꿈나무, 서희꿈나무어린이집, 식품안전 꿈나무 교실처럼 꿈나무가 일반 말이면 그대로 둔다.
(()=>{const SUR='김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예봉경사피',END='시군구읍면동리로길천산호도교관장실회식제물품판기등용소당단팀대원부상전극쇼곡축의을를은는이가에와과로한운는던른적형별간내외중층측권역급획업컴텍즈팩룸홀점차량비료금액세표판함',S2=['남궁','황보','제갈','선우','독고','사공','서문'];
const SPORT=['스포츠클라이밍','댄스스포츠','파크골프','배드민턴','쇼트트랙','리듬체조','게이트볼','트라이애슬론','소프트볼','스케이트','클라이밍','핸드볼','태권도','이스포츠','라크로스','인라인','킥복싱','주짓수','합기도','마라톤','사이클','테니스','레슬링','배구','농구','축구','야구','탁구','정구','수영','유도','검도','택견','체조','육상','복싱','권투','펜싱','씨름','역도','승마','요트','조정','카누','사격','양궁','국궁','궁도','궁술','빙상','피겨','스키','컬링','볼링','당구','우슈','다이빙','서핑','하키','럭비','족구','스쿼시','롤러','골프'];
const SP=new Set(SPORT),PH=new RegExp('^(?:'+SPORT.join('|')+')?(?:꿈나무|선수|장학(?:생|금)?)(?![가-힣])'),SPH=new RegExp('^(?:'+SPORT.join('|')+')(?:꿈나무|선수|장학(?:생|금)?)(?![가-힣])');
const isName=w=>{if(!w||w.length<2||w.length>4||SP.has(w)||END.includes(w[w.length-1]))return false;const two=S2.includes(w.slice(0,2));if(two)return w.length>=3;return SUR.includes(w[0]);};
const phraseOk=(w,ph)=>SPH.test(ph)||(w.length>=3&&PH.test(ph));
const N=s=>{if(typeof s!=='string'||!/꿈나무|선수|장학/.test(s))return s;const re=/[가-힣]+/g,words=[];let m;while((m=re.exec(s)))words.push({w:m[0],i:m.index});let out='',p=0,n=0;for(let i=0;i<words.length-1;i++){const a=words[i],b=words[i+1];if(s.slice(a.i+a.w.length,b.i)!==' '||!isName(a.w)||!phraseOk(a.w,b.w))continue;out+=s.slice(p,a.i)+'○'.repeat(a.w.length);p=a.i+a.w.length;n++;}if(!n)return s;window.__nmN=(window.__nmN||0)+n;return out+s.slice(p);};
window.maskN=N;const M0=window.maskT;window.maskT=s=>N(M0(s));})();
