// Exact public entry aliases only. Admin/API and original static assets retain origin behavior.
import review,{isV2Path} from './v2-review-worker.mjs';
const shells=new Map([['/','/index.html'],['/index.html','/index.html'],['/tr','/tr/index.html'],['/tr/','/tr/index.html'],['/tr/index.html','/tr/index.html'],['/v1/','/v1/index.html'],['/v1/index.html','/v1/index.html'],['/v1/tr','/v1/tr/index.html'],['/v1/tr/','/v1/tr/index.html'],['/v1/tr/index.html','/v1/tr/index.html']]);
const files=new Set(['/manifest.json','/tr/manifest.json','/service-worker.js','/v1/service-worker.js','/v1/manifest.json','/v1/tr/manifest.json','/promotion-manifest.json']);
export async function handle(request,env,originFetch=fetch,{staging=false}={}){
 const u=new URL(request.url);
 if(u.hostname!==(staging?'jumvi-missions-staging.saykirtasiye.workers.dev':'qr.jumvi.co'))return new Response('Unsupported host',{status:403});
 if(isV2Path(u.pathname))return review.fetch(request,env);
 if(u.pathname==='/v1'){u.pathname='/v1/';return new Response(null,{status:308,headers:{Location:u.href,'Cache-Control':'no-store'}});}
 const path=shells.get(u.pathname)||u.pathname;
 if(!shells.has(u.pathname)&&!files.has(path))return u.pathname.startsWith('/v1/')?new Response('Not found',{status:404}):originFetch(request);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(request.headers.has('Authorization'))return new Response('Public app only',{status:403});
 const r=await env.ASSETS.fetch(new Request(new URL(path,u),{method:request.method}));
 const h=new Headers(r.headers);h.set('Cache-Control','no-store');h.set('Vary','*');h.set('X-Content-Type-Options','nosniff');h.set('X-Robots-Tag','noindex, nofollow, noarchive');h.set('X-Jumvi-Environment',path.startsWith('/v1/')?'legacy-v1':'promoted-v2');
 if(!path.startsWith('/v1/'))h.set('X-Jumvi-Analytics','disabled');
 if(path.endsWith('.html'))h.set('Content-Security-Policy',"frame-ancestors 'self' https://jumvi.co https://www.jumvi.co");
 if(path.endsWith('service-worker.js')){h.set('Content-Type','text/javascript; charset=utf-8');h.set('Service-Worker-Allowed',path.startsWith('/v1/')?'/v1/':'/');}
 return new Response(r.body,{status:r.status,headers:h});
}
export default {fetch:(r,e)=>handle(r,e)};
