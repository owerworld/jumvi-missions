import {readFileSync,writeFileSync,readdirSync,mkdirSync,rmSync,cpSync,existsSync} from 'node:fs';import {join,dirname} from 'node:path';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url).pathname, out=join(root,'dist');
const tokens=JSON.parse(readFileSync(join(root,'content/component-tokens.json'))),vars=[];
for(const [k,v] of Object.entries(tokens.colors))vars.push(`--${k}:${v}`);
for(const [k,v] of Object.entries(tokens.targetMin))vars.push(`--target-${k}:${v/16}rem`);
for(const [k,v] of Object.entries(tokens.type))if(Array.isArray(v)&&typeof v[0]==='number'){vars.push(`--${k}-size:${v[0]/16}rem`,`--${k}-line:${v[1]/16}rem`);}
writeFileSync(join(root,'src/client/styles/tokens.css'),`:root{${vars.join(';')}}\n`);
function files(p){return readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(join(p,d.name)):[join(p,d.name)]).sort();}
const inputs=[join(root,'index.html'),...files(join(root,'src/client')),...files(join(root,'content'))];
if(existsSync(join(root,'assets/mission-illustrations')))inputs.push(...files(join(root,'assets/mission-illustrations')));
if(existsSync(join(root,'assets/fonts/atkinson')))inputs.push(...files(join(root,'assets/fonts/atkinson')));
const hash=createHash('sha256');for(const f of inputs)hash.update(f.slice(root.length)).update(readFileSync(f));const release=hash.digest('hex').slice(0,16);
rmSync(out,{recursive:true,force:true});const releaseDir=join(out,'releases',release);mkdirSync(releaseDir,{recursive:true});
cpSync(join(root,'src/client'),join(releaseDir,'client'),{recursive:true});cpSync(join(root,'content'),join(releaseDir,'content'),{recursive:true});
for(const p of ['assets/mission-illustrations','assets/fonts/atkinson'])if(existsSync(join(root,p)))cpSync(join(root,p),join(releaseDir,p),{recursive:true});
const template=readFileSync(join(root,'index.html'),'utf8');
for(const locale of ['en-US','tr']){const tr=locale==='tr',dest=join(out,tr?'tr/index.html':'index.html');mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,template.replaceAll('{{LOCALE}}',locale).replaceAll('{{RELEASE}}',`/releases/${release}`).replaceAll('{{SKIP}}',tr?'İçeriğe geç':'Skip to content').replaceAll('{{LOADING}}',tr?'Görev yükleniyor…':'Loading mission…').replaceAll('{{NOSCRIPT}}',tr?'Oyun rehberliği için JavaScript gerekiyor.':'JavaScript is needed for these game instructions.'));}
const manifest={release,files:files(out).map(f=>({path:f.slice(out.length),sha256:createHash('sha256').update(readFileSync(f)).digest('hex'),bytes:readFileSync(f).length}))};writeFileSync(join(out,'release-manifest.json'),JSON.stringify(manifest,null,2));console.log(`Built ${release}: ${manifest.files.length} public files`);
