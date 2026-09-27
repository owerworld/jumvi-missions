from pathlib import Path
import json,xml.etree.ElementTree as E,hashlib,base64
R=Path.cwd();records=json.load(open('artifacts/presentation-upright-v1/provenance.json'));ns='{http://www.w3.org/2000/svg}';front=records[0]['productImageSHA256'];results=[]
def norm(path,apply=False):
 root=E.parse(path).getroot()
 for e in root.iter(ns+'image'):
  href=e.get('href','');b=base64.b64decode(href.split(',')[1]) if href.startswith('data:') else (path.parent/href).read_bytes();sha=hashlib.sha256(b).hexdigest();e.set('href',sha)
  if apply and sha==front:
   w=float(e.get('width'));h=float(e.get('height'))
   if .9<=w/h<=1.1:
    cx=float(e.get('x'))+w/2;cy=float(e.get('y'))+h/2;e.set('transform',(e.get('transform','')+f' rotate(-90 {cx:g} {cy:g})').strip())
 return [(e.tag,sorted(e.attrib.items()),e.text or '') for e in root.iter()]
for r in records:
 assert norm(R/r['originalSource'],True)==norm(R/r['source']),r['path']
 results.append({'asset':r['path'],'productLayersRotated':len(r['edits']),'otherNodesUnchanged':True})
Path('review-assets/2026-09-28/product-layer-audit.json').write_text(json.dumps({'count':len(results),'result':'PASS','limits':'Layer/continuity invariants, not new child/field validation. m04 transfer and m08 horizontal landing artwork unchanged. Raster lifestyle assets were not regenerated.','assets':results},indent=2)+'\n')
print(len(results),'native derivatives: only the product rotation changed.')
