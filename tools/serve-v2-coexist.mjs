import http from 'node:http';import {readFileSync,existsSync,statSync} from 'node:fs';import {resolve,extname} from 'node:path';import {pathToFileURL} from 'node:url';import worker,{isV2Path} from '../src/v2-review-worker.mjs';
const mime={'.txt':'text/plain','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf','.svg':'image/svg+xml'};
export async function serveCoexist(port=8950,{legacySW='original',v2=true,offline=false}={}){
 const state={legacySW,v2,offline};
 const bytes=(root,p)=>{const f=resolve(root,'.'+p);if(!f.startsWith(resolve(root)+'/')||!existsSync(f)||!statSync(f).isFile())return new Response('Not found',{status:404});return new Response(readFileSync(f),{headers:{'Content-Type':mime[extname(f)]||'application/octet-stream','Cache-Control':'no-store'}});};
 const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1');let response;
  if(state.offline){req.socket.destroy();return;}
  if(isV2Path(u.pathname)){response=state.v2?await worker.fetch(new Request(u,{method:req.method,headers:req.headers}),{ASSETS:{fetch:r=>bytes('dist-v2',new URL(r.url).pathname)}}):new Response('Review withdrawn',{status:410,headers:{'Cache-Control':'no-store','Vary':'*'}});}
  else if(u.pathname==='/__qa.html')response=new Response('<!doctype html><title>Disposable same-origin QA</title>',{headers:{'Content-Type':'text/html','Cache-Control':'no-store'}});
  else if(u.pathname==='/service-worker.js')response=bytes(state.legacySW==='compat'?'artifacts/v2-legacy-compat':'compat/v254','/service-worker.js');
  else {const path=u.pathname==='/'?'/index.html':['/tr','/tr/'].includes(u.pathname)?'/tr/index.html':u.pathname;response=['/index.html','/tr/index.html'].includes(path)?bytes('compat/v254',path):bytes('dist',path);}
  if(u.searchParams.get('__qa_text')==='200'&&(response.headers.get('Content-Type')||'').includes('text/html')){const html=await response.text();response=new Response(html.replace('</head>','<style>html{font-size:200%}</style></head>'),{status:response.status,headers:response.headers});}
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('QA server error');}});await new Promise(ok=>server.listen(port,'127.0.0.1',ok));return {server,state,origin:`http://127.0.0.1:${server.address().port}`};
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){console.log((await serveCoexist(Number(process.env.PORT||8950))).origin);}
