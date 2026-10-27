// MONEY TRACKER private administrator OAuth gateway — Cloudflare Worker
// Required secrets: GITHUB_CLIENT_SECRET, SESSION_SECRET
// Required variables: GITHUB_CLIENT_ID, ADMIN_GITHUB_LOGIN
const ORIGIN = 'https://red-meadow-fcc6.leecheolhan91.workers.dev';
const encoder = new TextEncoder();
const cookie = (name,value,maxAge) => name+'='+encodeURIComponent(value)+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+maxAge;
function parseCookie(req,name){return (req.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||''}
function b64url(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}
function unbase(s){const normalized=s.replaceAll('-','+').replaceAll('_','/');const padded=normalized.padEnd(Math.ceil(normalized.length/4)*4,'=');return Uint8Array.from(atob(padded),ch=>ch.charCodeAt(0))}
async function signature(data,secret){const k=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(new Uint8Array(await crypto.subtle.sign('HMAC',k,encoder.encode(data))))}
async function seal(payload,secret){const p=b64url(encoder.encode(JSON.stringify(payload)));return p+'.'+await signature(p,secret)}
async function unseal(value,secret){const [p,s]=value.split('.');if(!p||!s)return null;const expected=await signature(p,secret);if(s.length!==expected.length)return null;let diff=0;for(let i=0;i<s.length;i++)diff|=s.charCodeAt(i)^expected.charCodeAt(i);if(diff)return null;try{const v=JSON.parse(new TextDecoder().decode(unbase(p)));return v.exp>Date.now()?v:null}catch{return null}}
function redirect(url,headers={}){return new Response(null,{status:302,headers:{Location:url,'Cache-Control':'no-store',...headers}})}
function json(obj,status=200){return new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
const ADMIN_HTML = "<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow\"><title>MONEY TRACKER | ADMIN CARD STUDIO</title><style>\n*{box-sizing:border-box}body{margin:0;background:#050b12;color:#dceaf4;font:15px system-ui,Arial}header{padding:19px 24px;border-bottom:1px solid #244050;background:#09141f;display:flex;align-items:center;justify-content:space-between;gap:12px}header strong{letter-spacing:2px;color:#79e7ff}a{color:#89dffa}.layout{display:grid;grid-template-columns:minmax(280px,380px) minmax(300px,1fr);gap:22px;max-width:1400px;margin:auto;padding:24px}.panel{background:#0c1825;border:1px solid #264458;border-radius:18px;padding:22px}h1{font-size:22px;margin:0 0 8px}h2{font-size:17px;margin:0 0 20px}p,small{color:#8daabb}label{display:block;margin:13px 0 5px;color:#9bc4d5;font-size:13px}input,select,textarea{width:100%;padding:11px 12px;background:#07111c;border:1px solid #315268;border-radius:9px;color:white;font:inherit}textarea{min-height:75px;resize:vertical}button{border:0;border-radius:10px;background:#58d6f4;color:#04101b;padding:13px 18px;font-weight:800;cursor:pointer}.secondary{background:#203749;color:#d7ecf6}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.preview{text-align:center}canvas{display:block;width:min(100%,540px);height:auto;margin:16px auto;background:#07101a;border:1px solid #315268;border-radius:12px}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.notice{font-size:12px;color:#9aafbd;margin-top:12px}@media(max-width:850px){.layout{grid-template-columns:1fr;padding:12px}.panel{padding:16px}}</style></head>\n<body><header><strong>MONEY TRACKER / ADMIN</strong><a href=\"/auth/logout\">로그아웃</a></header><main class=\"layout\"><section class=\"panel\"><h1>INVESTMENT CARD STUDIO</h1><p>미국 의회 거래 데이터를 카드로 시각화합니다. 입력값은 직접 확인한 공개 자료를 사용하세요.</p>\n<label for=\"member\">의원 이름</label><input id=\"member\" list=\"members\" value=\"Nancy Pelosi\"><datalist id=\"members\"><option>Nancy Pelosi</option><option>Dan Crenshaw</option><option>Tommy Tuberville</option><option>Marjorie Taylor Greene</option><option>Ro Khanna</option><option>Josh Gottheimer</option></datalist>\n<div class=\"row\"><div><label for=\"party\">정당</label><select id=\"party\"><option>Democratic</option><option>Republican</option><option>Independent</option></select></div><div><label for=\"ticker\">종목 티커</label><input id=\"ticker\" value=\"NVDA\" maxlength=\"12\"></div></div>\n<label for=\"company\">기업 이름</label><input id=\"company\" value=\"NVIDIA\"><div class=\"row\"><div><label for=\"trade\">거래 유형</label><select id=\"trade\"><option value=\"BUY\">매수 BUY</option><option value=\"SELL\">매도 SELL</option></select></div><div><label for=\"date\">거래 날짜</label><input id=\"date\" type=\"date\"></div></div>\n<div class=\"row\"><div><label for=\"entry\">기준 가격 ($)</label><input id=\"entry\" type=\"number\" min=\"0\" step=\"any\" value=\"100\"></div><div><label for=\"current\">비교 가격 ($)</label><input id=\"current\" type=\"number\" min=\"0\" step=\"any\" value=\"125\"></div></div>\n<label for=\"range\">공시 거래금액 범위 (선택)</label><input id=\"range\" placeholder=\"예: $1,001–$15,000\"><label for=\"source\">출처 URL (선택)</label><input id=\"source\" type=\"url\" placeholder=\"https://...\"><label for=\"note\">설명</label><textarea id=\"note\">공개 거래 신고 자료를 바탕으로 작성한 분석 카드입니다.</textarea>\n<div class=\"actions\"><button id=\"render\">카드 새로고침</button><button id=\"download\" class=\"secondary\">PNG 다운로드</button></div><p class=\"notice\">주의: 가격 변화는 가정한 두 시점의 단순 비교이며 의원의 실제 수익률을 의미하지 않습니다. 거래 신고일과 거래일은 다를 수 있습니다.</p></section>\n<section class=\"panel preview\"><h2>공유 카드 미리보기 · 1080 × 1350</h2><canvas id=\"card\" width=\"1080\" height=\"1350\"></canvas><small>관리자 전용 · 브라우저에서 생성 · 외부 업로드 없음</small></section></main>\n<script>\nconst ids=['member','party','ticker','company','trade','date','entry','current','range','source','note'];const el=id=>document.getElementById(id);const cv=el('card'),ctx=cv.getContext('2d');\nel('date').value=new Date().toISOString().slice(0,10);\nfunction draw(){const v=Object.fromEntries(ids.map(id=>[id,el(id).value]));const a=Number(v.entry),b=Number(v.current);const pct=a>0&&Number.isFinite(a)&&Number.isFinite(b)?(b-a)/a*100:null;const positive=pct!==null&&pct>=0;\nctx.fillStyle='#06101b';ctx.fillRect(0,0,1080,1350);const grd=ctx.createLinearGradient(0,0,1080,1350);grd.addColorStop(0,'#10324a');grd.addColorStop(1,'#050c15');ctx.fillStyle=grd;ctx.fillRect(0,0,1080,1350);\nctx.strokeStyle='#193c4e';ctx.lineWidth=1;for(let i=0;i<1080;i+=65){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,1350);ctx.stroke()}for(let i=0;i<1350;i+=65){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(1080,i);ctx.stroke()}\nfunction txt(t,x,y,size,color='#e9f6ff',weight=700){ctx.fillStyle=color;ctx.font=weight+' '+size+'px system-ui,Arial';ctx.fillText(String(t),x,y)}\nfunction fitted(t,x,y,maxWidth,size,color='#e9f6ff'){ctx.font='700 '+size+'px system-ui,Arial';while(ctx.measureText(String(t)).width>maxWidth&&size>22){size-=2;ctx.font='700 '+size+'px system-ui,Arial'}txt(t,x,y,size,color)}\nctx.fillStyle='#69dfff';ctx.fillRect(70,76,7,55);txt('MONEY TRACKER',99,118,43,'#85e8ff',900);txt('U.S. CONGRESSIONAL TRADE INTELLIGENCE',72,170,21,'#7fa9bb',600);\nctx.fillStyle='#0a2234';ctx.fillRect(70,226,940,340);txt(v.party.toUpperCase()+'  /  U.S. CONGRESS',105,285,25,'#75c7df',700);fitted(v.member||'UNKNOWN MEMBER',105,378,840,65);txt((v.trade==='SELL'?'SELL':'BUY')+'  •  '+(v.ticker||'—').toUpperCase(),105,463,48,'#83e4ff',900);fitted(v.company||'',105,519,840,29,'#a2c4d3');\ntxt('PRICE CHANGE · HYPOTHETICAL',75,660,29,'#8eb2c4');txt(pct===null?'N/A':(positive?'+':'')+pct.toFixed(2)+'%',75,790,106,pct===null?'#9eb5c3':positive?'#49e2bd':'#ff7d8a',900);\nctx.fillStyle='#122c3c';ctx.fillRect(70,848,940,148);txt('REFERENCE PRICE',104,905,23,'#8bb3c4');txt('COMPARISON PRICE',570,905,23,'#8bb3c4');txt(a>0?'
 const u=new URL(request.url), path=u.pathname;
 if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET||!env.SESSION_SECRET||!env.ADMIN_GITHUB_LOGIN)return json({error:'Missing server configuration'},503);
 if(path==='/auth/login'){
  const state=b64url(crypto.getRandomValues(new Uint8Array(32)));
  const signed=await seal({state,exp:Date.now()+600000},env.SESSION_SECRET);
  const auth=new URL('https://github.com/login/oauth/authorize');auth.searchParams.set('client_id',env.GITHUB_CLIENT_ID);auth.searchParams.set('redirect_uri',ORIGIN+'/auth/callback');auth.searchParams.set('state',state);return redirect(auth.toString(),{'Set-Cookie':cookie('mt_oauth',signed,600)});
 }
 if(path==='/auth/callback'){
  const state=u.searchParams.get('state'),code=u.searchParams.get('code');
  const saved=await unseal(decodeURIComponent(parseCookie(request,'mt_oauth')),env.SESSION_SECRET);
  const clear=cookie('mt_oauth','',0);
  if(!state||!code||!saved||state!==saved.state)return new Response('Invalid OAuth state',{status:403,headers:{'Set-Cookie':clear}});
  const tokenResponse=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:ORIGIN+'/auth/callback'}).toString()});
  if(!tokenResponse.ok)return json({error:'OAuth exchange failed'},502);
  const token=await tokenResponse.json();if(!token.access_token){const allowed=['incorrect_client_credentials','bad_verification_code','redirect_uri_mismatch','unverified_user_email','application_suspended'];return json({error:'OAuth exchange rejected',github_error:allowed.includes(token.error)?token.error:'other',hint:token.error==='incorrect_client_credentials'?'Check Client ID and Client Secret in Cloudflare':token.error==='bad_verification_code'?'Restart login from /auth/login':'Check GitHub OAuth app callback URL'},403)}
  const userResponse=await fetch('https://api.github.com/user',{headers:{Authorization:'Bearer '+token.access_token,Accept:'application/vnd.github+json','User-Agent':'money-tracker-admin'}});
  if(!userResponse.ok)return json({error:'GitHub identity verification failed'},403);
  const user=await userResponse.json();
  if(user.login?.toLowerCase()!==env.ADMIN_GITHUB_LOGIN.toLowerCase())return new Response('Access denied',{status:403,headers:{'Set-Cookie':clear}});
  const session=await seal({id:user.id,login:user.login,exp:Date.now()+8*3600000},env.SESSION_SECRET);
  const headers=new Headers({Location:ORIGIN+'/admin','Cache-Control':'no-store'});headers.append('Set-Cookie',clear);headers.append('Set-Cookie',cookie('mt_session',session,8*3600));return new Response(null,{status:302,headers});
 }
 if(path==='/auth/logout')return redirect('/',{'Set-Cookie':cookie('mt_session','',0)});
 const session=await unseal(decodeURIComponent(parseCookie(request,'mt_session')),env.SESSION_SECRET);
 if(path==='/auth/me')return json({authenticated:!!session&&session.login.toLowerCase()===env.ADMIN_GITHUB_LOGIN.toLowerCase()});
 if(path==='/admin'||path==='/admin/'){
  if(!session||session.login.toLowerCase()!==env.ADMIN_GITHUB_LOGIN.toLowerCase())return redirect('/auth/login');
  return new Response(ADMIN_HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY'}});
 }
 return new Response('MONEY TRACKER gateway active. Go to /admin',{headers:{'Content-Type':'text/plain; charset=utf-8'}});
}};+a.toLocaleString('en-US'):'—',104,962,39);txt(b>=0?'
 const u=new URL(request.url), path=u.pathname;
 if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET||!env.SESSION_SECRET||!env.ADMIN_GITHUB_LOGIN)return json({error:'Missing server configuration'},503);
 if(path==='/auth/login'){
  const state=b64url(crypto.getRandomValues(new Uint8Array(32)));
  const signed=await seal({state,exp:Date.now()+600000},env.SESSION_SECRET);
  const auth=new URL('https://github.com/login/oauth/authorize');auth.searchParams.set('client_id',env.GITHUB_CLIENT_ID);auth.searchParams.set('redirect_uri',ORIGIN+'/auth/callback');auth.searchParams.set('state',state);return redirect(auth.toString(),{'Set-Cookie':cookie('mt_oauth',signed,600)});
 }
 if(path==='/auth/callback'){
  const state=u.searchParams.get('state'),code=u.searchParams.get('code');
  const saved=await unseal(decodeURIComponent(parseCookie(request,'mt_oauth')),env.SESSION_SECRET);
  const clear=cookie('mt_oauth','',0);
  if(!state||!code||!saved||state!==saved.state)return new Response('Invalid OAuth state',{status:403,headers:{'Set-Cookie':clear}});
  const tokenResponse=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:ORIGIN+'/auth/callback'}).toString()});
  if(!tokenResponse.ok)return json({error:'OAuth exchange failed'},502);
  const token=await tokenResponse.json();if(!token.access_token){const allowed=['incorrect_client_credentials','bad_verification_code','redirect_uri_mismatch','unverified_user_email','application_suspended'];return json({error:'OAuth exchange rejected',github_error:allowed.includes(token.error)?token.error:'other',hint:token.error==='incorrect_client_credentials'?'Check Client ID and Client Secret in Cloudflare':token.error==='bad_verification_code'?'Restart login from /auth/login':'Check GitHub OAuth app callback URL'},403)}
  const userResponse=await fetch('https://api.github.com/user',{headers:{Authorization:'Bearer '+token.access_token,Accept:'application/vnd.github+json','User-Agent':'money-tracker-admin'}});
  if(!userResponse.ok)return json({error:'GitHub identity verification failed'},403);
  const user=await userResponse.json();
  if(user.login?.toLowerCase()!==env.ADMIN_GITHUB_LOGIN.toLowerCase())return new Response('Access denied',{status:403,headers:{'Set-Cookie':clear}});
  const session=await seal({id:user.id,login:user.login,exp:Date.now()+8*3600000},env.SESSION_SECRET);
  const headers=new Headers({Location:ORIGIN+'/admin','Cache-Control':'no-store'});headers.append('Set-Cookie',clear);headers.append('Set-Cookie',cookie('mt_session',session,8*3600));return new Response(null,{status:302,headers});
 }
 if(path==='/auth/logout')return redirect('/',{'Set-Cookie':cookie('mt_session','',0)});
 const session=await unseal(decodeURIComponent(parseCookie(request,'mt_session')),env.SESSION_SECRET);
 if(path==='/auth/me')return json({authenticated:!!session&&session.login.toLowerCase()===env.ADMIN_GITHUB_LOGIN.toLowerCase()});
 if(path==='/admin'||path==='/admin/'){
  if(!session||session.login.toLowerCase()!==env.ADMIN_GITHUB_LOGIN.toLowerCase())return redirect('/auth/login');
  return new Response(ADMIN_HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY'}});
 }
 return new Response('MONEY TRACKER gateway active. Go to /admin',{headers:{'Content-Type':'text/plain; charset=utf-8'}});
}};+b.toLocaleString('en-US'):'—',570,962,39);\ntxt('TRADE DATE  '+(v.date||'—'),74,1059,27,'#c8e4ee');fitted('REPORTED RANGE  '+(v.range||'NOT ENTERED'),74,1110,910,24,'#9dc5d3');\nconst note=(v.note||'').slice(0,110);fitted(note,74,1175,930,22,'#b3d0dc');txt('SOURCE: '+(v.source?new URL(v.source).hostname:'NOT PROVIDED'),74,1220,20,'#8cb1c1');\nctx.fillStyle='#14384a';ctx.fillRect(0,1270,1080,80);txt('PUBLIC FILINGS  •  NOT INVESTMENT ADVICE',72,1321,22,'#9dd6e7',700);\n}\nel('render').onclick=()=>{try{draw()}catch(e){alert('입력값을 확인하세요: '+e.message)}};el('download').onclick=()=>{try{draw();const a=document.createElement('a');a.download='money-tracker-'+(el('ticker').value||'card').replace(/[^a-z0-9-]/gi,'')+'.png';a.href=cv.toDataURL('image/png');a.click()}catch(e){alert('PNG 생성 실패: '+e.message)}};ids.forEach(id=>el(id).addEventListener('input',()=>{try{draw()}catch{}}));draw();\n</script></body></html>";
export default {async fetch(request,env){
 const u=new URL(request.url), path=u.pathname;
 if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET||!env.SESSION_SECRET||!env.ADMIN_GITHUB_LOGIN)return json({error:'Missing server configuration'},503);
 if(path==='/auth/login'){
  const state=b64url(crypto.getRandomValues(new Uint8Array(32)));
  const signed=await seal({state,exp:Date.now()+600000},env.SESSION_SECRET);
  const auth=new URL('https://github.com/login/oauth/authorize');auth.searchParams.set('client_id',env.GITHUB_CLIENT_ID);auth.searchParams.set('redirect_uri',ORIGIN+'/auth/callback');auth.searchParams.set('state',state);return redirect(auth.toString(),{'Set-Cookie':cookie('mt_oauth',signed,600)});
 }
 if(path==='/auth/callback'){
  const state=u.searchParams.get('state'),code=u.searchParams.get('code');
  const saved=await unseal(decodeURIComponent(parseCookie(request,'mt_oauth')),env.SESSION_SECRET);
  const clear=cookie('mt_oauth','',0);
  if(!state||!code||!saved||state!==saved.state)return new Response('Invalid OAuth state',{status:403,headers:{'Set-Cookie':clear}});
  const tokenResponse=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:ORIGIN+'/auth/callback'}).toString()});
  if(!tokenResponse.ok)return json({error:'OAuth exchange failed'},502);
  const token=await tokenResponse.json();if(!token.access_token){const allowed=['incorrect_client_credentials','bad_verification_code','redirect_uri_mismatch','unverified_user_email','application_suspended'];return json({error:'OAuth exchange rejected',github_error:allowed.includes(token.error)?token.error:'other',hint:token.error==='incorrect_client_credentials'?'Check Client ID and Client Secret in Cloudflare':token.error==='bad_verification_code'?'Restart login from /auth/login':'Check GitHub OAuth app callback URL'},403)}
  const userResponse=await fetch('https://api.github.com/user',{headers:{Authorization:'Bearer '+token.access_token,Accept:'application/vnd.github+json','User-Agent':'money-tracker-admin'}});
  if(!userResponse.ok)return json({error:'GitHub identity verification failed'},403);
  const user=await userResponse.json();
  if(user.login?.toLowerCase()!==env.ADMIN_GITHUB_LOGIN.toLowerCase())return new Response('Access denied',{status:403,headers:{'Set-Cookie':clear}});
  const session=await seal({id:user.id,login:user.login,exp:Date.now()+8*3600000},env.SESSION_SECRET);
  const headers=new Headers({Location:ORIGIN+'/admin','Cache-Control':'no-store'});headers.append('Set-Cookie',clear);headers.append('Set-Cookie',cookie('mt_session',session,8*3600));return new Response(null,{status:302,headers});
 }
 if(path==='/auth/logout')return redirect('/',{'Set-Cookie':cookie('mt_session','',0)});
 const session=await unseal(decodeURIComponent(parseCookie(request,'mt_session')),env.SESSION_SECRET);
 if(path==='/auth/me')return json({authenticated:!!session&&session.login.toLowerCase()===env.ADMIN_GITHUB_LOGIN.toLowerCase()});
 if(path==='/admin'||path==='/admin/'){
  if(!session||session.login.toLowerCase()!==env.ADMIN_GITHUB_LOGIN.toLowerCase())return redirect('/auth/login');
  return new Response(ADMIN_HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY'}});
 }
 return new Response('MONEY TRACKER gateway active. Go to /admin',{headers:{'Content-Type':'text/plain; charset=utf-8'}});
}};