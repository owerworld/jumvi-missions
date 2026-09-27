from pathlib import Path
import json,xml.etree.ElementTree as E,hashlib,base64,os,re
R=Path.cwd();out=R/'artifacts/presentation-upright-v1';out.mkdir(exist_ok=True);ns='{http://www.w3.org/2000/svg}';E.register_namespace('',ns[1:-1])
p=R/'content/customer-presentation-v1.json';data=json.loads(p.read_text());assets=json.load(open('content/asset-manifest.json'))['assets'];by={a['path']:a for a in assets};front='de37dd358e82ea4eae7cde1b74eef45eb75d1b25c1fc5521256526f48e3c4014';replacements={};records=[]
def paths(v):
 if isinstance(v,dict):
  for x in v.values():yield from paths(x)
 elif isinstance(v,list):
  for x in v:yield from paths(x)
 elif isinstance(v,str) and v.startswith('assets/'):yield v
for mid,m in data['missions'].items():
 for path in set(paths(m)):
  if path in replacements:continue
  if mid in ['m04','m08']:continue # Hand transfer and deliberately horizontal landing mechanic.
  src=None
  if '/catalog-v3/' in path:src=R/'artifacts/presentation-catalog-v3/masters'/Path(path).with_suffix('.svg').name
  elif '/pilot-v2/' in path:src=R/'artifacts/presentation-pilot-v2'/Path(path).with_suffix('.svg').name
  elif '/pilot-v1/' in path:src=R/'../../work/m6-pilot-20260924/native-derivatives'/Path(path).with_suffix('.svg').name
  elif '/final/' in path:
   stem=Path(path).stem;bits=stem.split('-');name=f'{mid}-{int(bits[0]):02}'+('-'+'-'.join(bits[1:]) if len(bits)>1 else '')+'.svg';src=R/'../../outputs/M4_R4_FINAL_ACCEPTANCE_SWEEP'/name
  if not src or not src.exists():continue
  tree=E.parse(src);root=tree.getroot();changed=[]
  for el in root.iter(ns+'image'):
   href=el.get('href','');b=None
   if href.startswith('data:'):b=base64.b64decode(href.split(',')[1])
   elif href:b=(src.parent/href).read_bytes()
   if b is None:continue
   digest=hashlib.sha256(b).hexdigest()
   if digest==front:
    w=float(el.get('width'));h=float(el.get('height'))
    if .9<=w/h<=1.1:
     cx=float(el.get('x'))+w/2;cy=float(el.get('y'))+h/2
     old=el.get('transform','');el.set('transform',(old+f' rotate(-90 {cx:g} {cy:g})').strip());changed.append({'center':[cx,cy],'turn':-90,'originalTransform':old})
   if not href.startswith('data:'):el.set('href',os.path.relpath((src.parent/href).resolve(),out))
  if not changed:continue
  name=mid+'-'+Path(path).stem+'-upright-v1';dest=out/(name+'.svg');tree.write(dest,encoding='utf-8',xml_declaration=True)
  new='assets/mission-illustrations/upright-v1/'+name+'.webp';replacements[path]=new
  records.append({'path':new,'original':path,'source':str(dest.relative_to(R)),'originalSource':os.path.relpath(src,R),'productImageSHA256':front,'edits':changed,'invariants':'Native product-layer rotation only; player/hand/ball/trajectory/role nodes unchanged. No mirror, shape stretch or body edit.'})
def replace(v):
 if isinstance(v,dict):return {k:replace(x) for k,x in v.items()}
 if isinstance(v,list):return [replace(x) for x in v]
 return replacements.get(v,v) if isinstance(v,str) else v
p.write_text(json.dumps(replace(data),ensure_ascii=False,indent=2)+'\n');(out/'provenance.json').write_text(json.dumps(records,indent=2)+'\n');print('Native candidate derivatives',len(records))
