from pathlib import Path
import json,base64,hashlib,os,re
out=Path('artifacts/presentation-upright-v1');source=out/'source-images';source.mkdir(exist_ok=True);known={x.stem:x for x in Path('artifacts/presentation-catalog-v3/source-images').iterdir()}
for f in out.glob('*.svg'):
 def deembed(m):
  mime,b64=m.groups();b=base64.b64decode(b64);h=hashlib.sha256(b).hexdigest();p=known.get(h,source/(h+('.jpg' if mime=='jpeg' else '.png')))
  if not p.exists():p.write_bytes(b)
  return 'href="'+os.path.relpath(p,out)+'"'
 f.write_text(re.sub(r'href="data:image/(png|jpeg);base64,([^"]+)"',deembed,f.read_text()))
manifest=json.load(open('content/asset-manifest.json'))
for a in manifest['assets']:
 if a['path'].startswith('assets/mission-illustrations/upright-v1/'):a['sourceSha256']=hashlib.sha256(Path(a['source']).read_bytes()).hexdigest()
Path('content/asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
