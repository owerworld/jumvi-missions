// Dedicated fixed-release Worker. No production services, datasets, secrets or forwarding.
export const isV2Path = path => path === '/v2' || path.startsWith('/v2/');
const headers = {'X-Jumvi-Environment':'v2-review','X-Jumvi-Analytics':'disabled','X-Robots-Tag':'noindex, nofollow, noarchive','Cache-Control':'no-store','Vary':'*'};
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(!isV2Path(url.pathname))return new Response('Outside review scope',{status:404});
  if(request.headers.has('Authorization'))return new Response('Authenticated requests are not review assets',{status:403,headers});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers});
  if(url.pathname==='/v2'){url.pathname='/v2/';return new Response(null,{status:308,headers:{...headers,Location:url.href}});}
  if(/^\/v2\/(?:api|panel|analiz|data|src|tools|compat)(?:\/|$)/.test(url.pathname))return new Response('Unavailable',{status:404,headers});
  const path=url.pathname==='/v2/'?'/v2/index.html':['/v2/tr','/v2/tr/'].includes(url.pathname)?'/v2/tr/index.html':url.pathname;
  // Only exact shell, public manifest/SW and immutable release paths. No SPA fallback.
  if(!['/v2/index.html','/v2/tr/index.html','/v2/manifest.json','/v2/tr/manifest.json','/v2/service-worker.js','/v2/sw-release.json','/v2/release-manifest.json'].includes(path)&&!/^\/v2\/releases\/[a-f0-9]{16}\/(?:client|content|assets)\//.test(path))return new Response('Not found',{status:404,headers});
  const assetURL=new URL(path,url); // Query does not select content; credentials are not forwarded.
  const response=await env.ASSETS.fetch(new Request(assetURL,{method:request.method}));
  const result=new Response(response.body,response);
  for(const [key,value] of Object.entries(headers))result.headers.set(key,value);
  if(path==='/v2/service-worker.js')result.headers.set('Service-Worker-Allowed','/v2/');
  // Old v254 root SW unconditionally cache.put()s navigation under /index.html.
  // Cache API refuses Vary: *, preserving the old shell on an uncontrolled first visit.
  // Covers legacy runtime asset writes too. V2 SW strips this only AFTER hash/MIME verification.
  return result;
 }
};
