import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {exampleRows} from './fixture.mjs';
import {summarize} from './contract.mjs';
import {evidenceReport,reportCSV} from './report.mjs';
const port=8962,host='127.0.0.1';
const assets={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/missions.json':'missions.json'};
const types={html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',json:'application/json'};
http.createServer(async(req,res)=>{
 // This server is a loopback-only synthetic preview. No ingestion, auth bypass or demo switch exists in the deployed Worker.
 const h={'Cache-Control':'no-store','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff'};
 if(req.headers.host!==`${host}:${port}`||!['GET','HEAD'].includes(req.method)){res.writeHead(403,h);return res.end();}
 const url=new URL(req.url,`http://${host}:${port}`);
 if(['/api/summary','/api/report'].includes(url.pathname)){
  const days=Number(url.searchParams.get('days')||28),locale=url.searchParams.get('locale')||'all';
  if(![7,28,90].includes(days)||!['all','en-US','tr'].includes(locale)){res.writeHead(400,h);return res.end();}
  if(url.pathname==='/api/report'){const format=url.searchParams.get('format')||'json';if(!['json','csv'].includes(format)){res.writeHead(400,h);return res.end();}const r=evidenceReport(exampleRows(),days,locale,'demo');res.writeHead(200,{...h,'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/json','Content-Disposition':`attachment; filename="jumvi-DEMO-${r.period.start}-${r.period.end}-${locale}.${format}"`});return res.end(format==='csv'?reportCSV(r):JSON.stringify(r,null,2));}
  res.writeHead(200,{...h,'Content-Type':'application/json'});return res.end(JSON.stringify({...summarize(exampleRows(),days,locale),mode:'demo'}));
 }
 const file=assets[url.pathname];if(!file){res.writeHead(404,h);return res.end();}
 try{const body=await readFile(new URL('public/'+file,import.meta.url));res.writeHead(200,{...h,'Content-Type':types[file.split('.').at(-1)]});res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(500,h);res.end('Preview unavailable');}
}).listen(port,host,()=>process.stdout.write(`Synthetic preview: http://${host}:${port}\n`));
