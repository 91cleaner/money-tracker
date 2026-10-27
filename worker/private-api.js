// Cloudflare Worker module. Deploy separately from public GitHub Pages.
// Required secrets: ACCESS_TEAM_DOMAIN, ACCESS_AUD; bind PRIVATE_DATA (D1) only to this Worker.
// Access policy must independently restrict who can obtain a valid token.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, {status: 405});
    if (url.pathname === '/health') return Response.json({status:'ok', privateData:false});
    if (!url.pathname.startsWith('/private/')) return new Response('Not found', {status:404});
    if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.PRIVATE_DATA)
      return new Response('Service unavailable', {status:503});
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token) return new Response('Unauthorized', {status:401});
    try {
      const issuer = 'https://' + env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//,'').replace(/\/$/,'');
      const jwksResponse = await fetch(issuer + '/cdn-cgi/access/certs');
      if (!jwksResponse.ok) throw Error('JWKS unavailable');
      const {keys} = await jwksResponse.json();
      const parts = token.split('.');
      if (parts.length !== 3) throw Error('Invalid JWT');
      const decode = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')), c=>c.charCodeAt(0));
      const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
      const payload = JSON.parse(new TextDecoder().decode(decode(parts[1])));
      if (header.alg !== 'RS256' || !header.kid) throw Error('Invalid algorithm');
      const jwk = keys.find(k=>k.kid===header.kid && k.kty==='RSA');
      if (!jwk) throw Error('Unknown signing key');
      const key = await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
      const signed = new TextEncoder().encode(parts[0]+'.'+parts[1]);
      if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),signed)) throw Error('Bad signature');
      const now=Math.floor(Date.now()/1000);
      if (payload.iss!==issuer || !(Array.isArray(payload.aud)?payload.aud.includes(env.ACCESS_AUD):payload.aud===env.ACCESS_AUD) || !Number.isFinite(payload.exp) || payload.exp<=now || !Number.isFinite(payload.iat) || payload.iat>now+60) throw Error('Invalid claims');
    } catch {
      return new Response('Unauthorized', {status:401});
    }
    // No private records are exposed until explicit allowlisted handlers are implemented.
    return new Response('Not implemented', {status:501});
  }
};
