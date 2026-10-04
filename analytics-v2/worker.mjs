import {createRemoteJWKSet,jwtVerify} from 'jose';
import {validEvent,dayUTC,firstDay,summarize} from './contract.mjs';
const jwks=new Map();
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const reply=(body,status=200,more={})=>new Response(body,{status,headers:{...headers,...more}});
export async function authorized(request,env,verify=jwtVerify){
  if(!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD||!env.ADMIN_EMAIL)return false;
  if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN))return false;
  const token=request.headers.get('Cf-Access-Jwt-Assertion');if(!token)return false;
  const issuer='https://'+env.ACCESS_TEAM_DOMAIN;
  try{
    if(!jwks.has(issuer))jwks.set(issuer,createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'),{timeoutDuration:3000}));
    const {payload}=await verify(token,jwks.get(issuer),{issuer,audience:env.ACCESS_AUD,algorithms:['RS256'],requiredClaims:['exp','iat','email']});
    return typeof payload.email==='string'&&payload.email.toLowerCase()===env.ADMIN_EMAIL.toLowerCase();
  }catch{return false;}
}
async function readSmallJSON(request){
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return null;
  if(Number(request.headers.get('content-length'))>256)return null;
  const reader=request.body?.getReader();if(!reader)return null;
  let length=0,chunks=[];
  try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>256){await reader.cancel();return null;}chunks.push(value);}
    const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));
  }catch{return null;}
}
export async function collect(request,env,now=new Date()){
  if(request.method!=='POST')return reply(null,405,{'Allow':'POST'});
  // Only the platform-populated request.cf value is used; no client country header is accepted.
  if(env.COLLECTION_ENABLED!=='true'||request.cf?.country!=='US')return reply(null,204);
  if(request.headers.get('Origin')!==env.PUBLIC_ORIGIN||request.headers.get('Sec-Fetch-Site')!=='same-origin')return reply(null,403);
  if(request.headers.get('Sec-GPC')==='1'||request.headers.get('DNT')==='1')return reply(null,204);
  const data=await readSmallJSON(request);if(!validEvent(data))return reply(null,400);
  if(!env.DB)return reply(null,503);
  try{await env.DB.prepare('INSERT INTO daily_counts(day,locale,mission,event,count) VALUES(?,?,?,?,1) ON CONFLICT(day,locale,mission,event) DO UPDATE SET count=count+1').bind(dayUTC(now),data.locale,data.mission,data.event).run();return reply(null,204);}catch{return reply(null,503);}
}
export function createWorker(auth=authorized){return {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.origin===env.PUBLIC_ORIGIN&&url.pathname==='/v2/metrics'&&!url.search)return collect(request,env);
    // Host restriction plus JWT verification on every dashboard/API/asset request.
    if(url.origin!==env.DASHBOARD_ORIGIN)return reply('Not found',404);
    if(!await auth(request,env))return reply('Administrator sign-in required.',401);
    if(!['GET','HEAD'].includes(request.method))return reply(null,405,{'Allow':'GET, HEAD'});
    if(url.pathname==='/api/summary'){
      const days=Number(url.searchParams.get('days')||28),locale=url.searchParams.get('locale')||'all';
      if(![7,28,90].includes(days)||!['all','en-US','tr'].includes(locale)||[...url.searchParams.keys()].some(k=>!['days','locale'].includes(k)))return reply('Invalid filter',400);
      try{const {results}=await env.DB.prepare('SELECT day,locale,mission,event,count FROM daily_counts WHERE day>=? AND day<=?').bind(firstDay(days),dayUTC()).all();
        return reply(request.method==='HEAD'?null:JSON.stringify({...summarize(results,days,locale),mode:env.COLLECTION_ENABLED==='true'?'live':'disabled'}),200,{'Content-Type':'application/json'});
      }catch{return reply('Summary unavailable',503);}
    }
    if(!['/','/index.html','/app.js','/style.css','/missions.json'].includes(url.pathname)||url.search)return reply('Not found',404);
    const asset=await env.ASSETS.fetch(request),h=new Headers(asset.headers);for(const [k,v]of Object.entries(headers))h.set(k,v);
    h.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    return new Response(request.method==='HEAD'?null:asset.body,{status:asset.status,headers:h});
  },
  async scheduled(_event,env){await env.DB.prepare('DELETE FROM daily_counts WHERE day<?').bind(firstDay(90)).run();}
};}
export default createWorker();
