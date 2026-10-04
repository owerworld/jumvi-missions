import {readFileSync,writeFileSync,cpSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {criticalPaths} from '../src/client/catalog.js';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
export function packageProtectedArt(root,releaseDir){
 const directory=join(root,'artifacts/art-protection-v2');
 const manifest=JSON.parse(readFileSync(join(directory,'manifest.json')));
 if(manifest.version!==2)throw Error('Reviewed ownership signal manifest required');
 const catalog=JSON.parse(readFileSync(join(root,'content/catalog.json'))),presentation=JSON.parse(readFileSync(join(root,'content/customer-presentation-v1.json')));
 const required=new Set(catalog.missions.flatMap(m=>criticalPaths(JSON.parse(readFileSync(join(root,'content/missions/'+m.id+'.json'))),presentation)));
 const protectedPaths=new Map(manifest.assets.map(a=>[a.path,a]));
 // The accepted source catalogue remains unchanged. Only the shipped manifest
 // points at the verified, same-dimension watermarked delivery copies.
 for(const path of required)if(!protectedPaths.has(path))throw Error('Missing protected active artwork: '+path);
 const file=join(releaseDir,'content/asset-manifest.json'),source=JSON.parse(readFileSync(file));
 for(const a of manifest.assets){
  if(a.hidden?.scheme!=='JUMVI-reference-dct-v2'||!a.hidden.alphaExact||!a.hidden.dimensionsExact||a.hidden.maxRGBDelta>4||a.hidden.psnrDB<42)throw Error('Unverified ownership signal: '+a.path);
  if(!a.path.startsWith('assets/mission-illustrations/')||a.path.includes('..'))throw Error('Unexpected derivative path');
  if(hash(readFileSync(join(root,a.path)))!==a.sourceSHA256)throw Error('Artwork changed; re-review derivative: '+a.path);
  const bytes=readFileSync(join(directory,a.path));if(hash(bytes)!==a.sha256||bytes.length!==a.bytes)throw Error('Derivative integrity failed: '+a.path);
  mkdirSync(dirname(join(releaseDir,a.path)),{recursive:true});
  cpSync(join(directory,a.path),join(releaseDir,a.path));
 }
 for(const path of manifest.exempt){mkdirSync(dirname(join(releaseDir,path)),{recursive:true});cpSync(join(root,path),join(releaseDir,path));}
 const assets=source.assets.filter(a=>protectedPaths.has(a.path)||manifest.exempt.includes(a.path)).map(a=>{const p=protectedPaths.get(a.path);if(!p&&!manifest.exempt.includes(a.path))throw Error('Unprotected published artwork: '+a.path);if(p&&(p.width!==a.width||p.height!==a.height))throw Error('Derivative dimensions changed');return {path:a.path,width:a.width,height:a.height,bytes:p?.bytes??a.bytes,sha256:p?.sha256??a.sha256};});
 writeFileSync(file,JSON.stringify({scope:'JUMVI branded delivery copies. Original masters and private ownership verification material are not distributed in this release. Copying is not technically prevented.',assets},null,2));
}
