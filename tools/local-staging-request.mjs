// Test-only loopback reverse proxy. Preserve foreign origins so hotlink tests
// exercise the real policy; never add a loopback bypass to a deployed Worker.
export function localStagingRequest(req,port){
 const url=new URL(req.url,'https://jumvi-missions-staging.saykirtasiye.workers.dev');
 const headers=new Headers(req.headers),ref=headers.get('Referer');
 if(ref){try{const local=new URL(ref);if(local.origin==='http://127.0.0.1:'+port)headers.set('Referer',url.origin+local.pathname+local.search);}catch{}}
 return new Request(url,{method:req.method,headers});
}
