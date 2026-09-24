// Separate allowlisted compatibility artifact; no root UI, content or data access.
export async function handle(request,env,originFetch=fetch){
 const u=new URL(request.url);if(u.hostname!=='qr.jumvi.co')return new Response('Compatibility route only',{status:403});
 if(u.pathname!=='/service-worker.js')return originFetch(request);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const response=await env.ASSETS.fetch(new Request(new URL('/service-worker.js',u),{method:request.method}));
 const headers=new Headers(response.headers);headers.set('Content-Type','text/javascript; charset=utf-8');headers.set('Cache-Control','no-store');headers.set('Service-Worker-Allowed','/');headers.set('X-Content-Type-Options','nosniff');
 return new Response(response.body,{status:response.status,headers});
}
export default {fetch(request,env){return handle(request,env);}};
