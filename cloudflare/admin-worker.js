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
  const tokenResponse=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:ORIGIN+'/auth/callback'})});
  if(!tokenResponse.ok)return json({error:'OAuth exchange failed'},502);
  const token=await tokenResponse.json();if(!token.access_token)return json({error:'OAuth exchange rejected'},403);
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
  return new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MONEY TRACKER ADMIN</title><style>body{background:#050e1a;color:#d8f5ff;font:16px system-ui;padding:40px}a{color:#75e5ff}</style><h1>MONEY TRACKER · ADMIN</h1><p>GitHub 관리자 인증 완료</p><p>카드 제작실은 다음 배포에서 연결됩니다.</p><a href="/auth/logout">로그아웃</a></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY'}});
 }
 return new Response('MONEY TRACKER gateway active. Go to /admin',{headers:{'Content-Type':'text/plain; charset=utf-8'}});
}};