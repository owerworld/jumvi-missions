import {criticalPaths} from '../src/client/catalog.js';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,rmSync,cpSync,existsSync} from 'node:fs';import {join,dirname} from 'node:path';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url).pathname, base=process.env.JUMVI_BASE_PATH||'/';
if(!['/','/v2/'].includes(base))throw Error('Unsupported application base');
const v2=base==='/v2/', output=join(root,v2?'dist-v2':'dist'),out=v2?join(output,'v2'):output;
const publicPath=p=>v2?'/v2'+p:p;
const tokens=JSON.parse(readFileSync(join(root,'content/component-tokens.json'))),vars=[];
for(const [k,v] of Object.entries(tokens.colors))vars.push(`--${k}:${v}`);
for(const [k,v] of Object.entries(tokens.targetMin))vars.push(`--target-${k}:${v/16}rem`);
for(const [k,v] of Object.entries(tokens.type))if(Array.isArray(v)&&typeof v[0]==='number'){vars.push(`--${k}-size:${v[0]/16}rem`,`--${k}-line:${v[1]/16}rem`);}
writeFileSync(join(root,'src/client/styles/tokens.css'),`:root{${vars.join(';')}}\n`);
function files(p){return readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(join(p,d.name)):[join(p,d.name)]).sort();}
const inputs=[join(root,'tools/build-app.mjs'),join(root,'index.html'),...files(join(root,'src/client')),...files(join(root,'content')),...files(join(root,'src/offline'))];
if(existsSync(join(root,'assets/mission-illustrations')))inputs.push(...files(join(root,'assets/mission-illustrations')));
if(existsSync(join(root,'assets/fonts/atkinson')))inputs.push(...files(join(root,'assets/fonts/atkinson')));
const hash=createHash('sha256').update(base);for(const f of inputs)hash.update(f.slice(root.length)).update(readFileSync(f));const release=hash.digest('hex').slice(0,16);
rmSync(output,{recursive:true,force:true});const releaseDir=join(out,'releases',release);mkdirSync(releaseDir,{recursive:true});
cpSync(join(root,'src/client'),join(releaseDir,'client'),{recursive:true});cpSync(join(root,'content'),join(releaseDir,'content'),{recursive:true});
for(const p of ['assets/mission-illustrations','assets/fonts/atkinson'])if(existsSync(join(root,p)))cpSync(join(root,p),join(releaseDir,p),{recursive:true});
const template=readFileSync(join(root,'index.html'),'utf8');
for(const locale of ['en-US','tr']){const tr=locale==='tr',dest=join(out,tr?'tr/index.html':'index.html');mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,template.replaceAll('{{LOCALE}}',locale).replaceAll('{{RELEASE}}',`${base}releases/${release}`).replaceAll('{{SKIP}}',tr?'İçeriğe geç':'Skip to content').replaceAll('{{LOADING}}',tr?'Görev yükleniyor…':'Loading mission…').replaceAll('{{NOSCRIPT}}',tr?'Oyun rehberliği için JavaScript gerekiyor.':'JavaScript is needed for these game instructions.'));}
const mime=p=>p.endsWith('.html')?'text/html':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.json')?'application/json':p.endsWith('.webp')?'image/webp':p.endsWith('.ttf')?'font/ttf':p.endsWith('.txt')?'text/plain':'application/octet-stream';
if(v2)for(const locale of ['en-US','tr']){const tr=locale==='tr',start=base+(tr?'tr/':'');writeFileSync(join(out,tr?'tr/manifest.json':'manifest.json'),JSON.stringify({id:base,name:'JUMVI Review',short_name:'JUMVI',lang:locale,start_url:start,scope:base,display:'standalone'}));const f=join(out,tr?'tr/index.html':'index.html');writeFileSync(f,readFileSync(f,'utf8').replace('</head>',`<link rel="manifest" href="${start}manifest.json"></head>`));}
const publicFiles=files(out).map(f=>({path:publicPath(f.slice(out.length)),sha256:createHash('sha256').update(readFileSync(f)).digest('hex'),bytes:readFileSync(f).length,mime:mime(f)}));
const presentation=JSON.parse(readFileSync(join(root,'content/customer-presentation-v1.json')));
const catalogue=JSON.parse(readFileSync(join(root,'content/catalog.json'))),missions={};
for(const [id,pilot] of Object.entries(presentation.missions))if(pilot.canonicalSHA256!==catalogue.missions.find(m=>m.id===id)?.sha256)throw Error('Presentation canonical binding changed: '+id);
for(const {id} of catalogue.missions){const m=JSON.parse(readFileSync(join(root,`content/missions/${id}.json`)));missions[id]=[`${base}releases/${release}/content/missions/${id}.json`,...criticalPaths(m,presentation).map(p=>`${base}releases/${release}/${p}`)];}
const precache=publicFiles.filter(f=>f.path.endsWith('.html')||(f.path.includes('/client/')&&/\.(js|css)$/.test(f.path))||(f.path.includes('/assets/fonts/')&&/\.(ttf|woff2)$/.test(f.path))||['/content/customer-presentation-v1.json','/content/catalog.json','/content/asset-manifest.json','/content/ui/tr.json','/content/ui/en-US.json'].some(p=>f.path.endsWith(p))).map(f=>f.path);
precache.push(...missions.m25);
const swManifest={release,base,files:publicFiles,precache,missions};
writeFileSync(join(out,'service-worker.js'),readFileSync(join(root,'src/offline/service-worker.js'),'utf8').replace('__MANIFEST__',JSON.stringify(swManifest)));
writeFileSync(join(out,'sw-release.json'),JSON.stringify({release,precache,missions},null,2));
// Compatibility resources are not imported by the new document or added to its SW cache.
const compatibility=JSON.parse(readFileSync(join(root,'compat/v254-public-manifest.json')));
for(const {path,sha256} of (v2?[]:compatibility.files)){const source=join(root,path);if(createHash('sha256').update(readFileSync(source)).digest('hex')!==sha256)throw Error('Legacy compatibility source changed: '+path);const dest=join(out,path);if(!existsSync(dest)){mkdirSync(dirname(dest),{recursive:true});cpSync(source,dest);}}
// Preserve the reviewed previous release for still-open tabs; reject altered archived bytes.
for(const name of readdirSync(join(root,'compat/previous')).filter(n=>n.endsWith('-manifest.json'))){
 const previous=JSON.parse(readFileSync(join(root,'compat/previous',name)));
 for(const file of previous.files){const source=join(root,'compat/previous',file.path);if(createHash('sha256').update(readFileSync(source)).digest('hex')!==file.sha256)throw Error('Previous release changed: '+file.path);}
}
if(!v2)cpSync(join(root,'compat/previous/releases'),join(out,'releases'),{recursive:true});
const manifest={release,base,compatibilitySource:compatibility.sourceSHA,files:files(out).map(f=>({path:publicPath(f.slice(out.length)),sha256:createHash('sha256').update(readFileSync(f)).digest('hex'),bytes:readFileSync(f).length}))};writeFileSync(join(out,'release-manifest.json'),JSON.stringify(manifest,null,2));console.log(`Built ${release}: ${manifest.files.length} public files`);
