"""Deterministic, user-authorized branding; never redraw or overwrite accepted sources.
Run with Pillow. Committed derivatives make release builds independent of this runtime.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops
from hashlib import sha256
import json
ROOT=Path(__file__).resolve().parent.parent
DEST=ROOT/'artifacts/art-protection-v1'
FONT=ROOT/'assets/fonts/atkinson/AtkinsonHyperlegibleNext.ttf'
EXEMPT={'assets/mission-illustrations/m25/jumvi-logo.webp'}
entries=[]
ALLOWED=set(json.loads((DEST/'allowlist.json').read_text()))
for p in sorted((ROOT/'assets/mission-illustrations').rglob('*.webp')):
    path=p.relative_to(ROOT).as_posix()
    if path in EXEMPT or path not in ALLOWED: continue
    src=p.read_bytes(); im=Image.open(p).convert('RGBA'); w,h=im.size
    # Two small perimeter imprints avoid the central teaching action. No resizing,
    # rotation, mirroring, cropping or modification outside these exact boxes.
    font=ImageFont.truetype(str(FONT),max(9,round(w*0.023)))
    layer=Image.new('RGBA',im.size); d=ImageDraw.Draw(layer)
    label='JUMVI'; bbox=d.textbbox((0,0),label,font=font,stroke_width=1)
    tw,th=bbox[2]-bbox[0],bbox[3]-bbox[1]; pad=max(3,round(min(w,h)*.016))
    boxes=[]
    for x,y in [(pad,pad),(max(pad,w-tw-pad-4),max(pad,h-th-pad-4))]:
        # A fine light outline makes the imprint legible on both alpha and dark art.
        d.text((x-bbox[0],y-bbox[1]),label,font=font,fill=(16,46,67,120),stroke_width=1,stroke_fill=(255,255,255,150))
        boxes.append([x,y,x+tw+1,y+th+1])
    result=Image.alpha_composite(im,layer)
    out=DEST/path;out.parent.mkdir(parents=True,exist_ok=True)
    xmp=('<?xpacket begin=""?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"><dc:creator><rdf:Seq><rdf:li>JUMVI</rdf:li></rdf:Seq></dc:creator><dc:rights><rdf:Alt><rdf:li xml:lang="x-default">JUMVI branded mission artwork. Contact support@jumvi.co for reuse requests.</rdf:li></rdf:Alt></dc:rights><xmpRights:WebStatement>https://jumvi.co</xmpRights:WebStatement></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>').encode()
    result.save(out,'WEBP',lossless=True,quality=100,method=6,exact=True,xmp=xmp)
    # Check every decoded pixel outside the watermark mask, including alpha.
    decoded=Image.open(out).convert('RGBA'); assert decoded.size==im.size
    outside=layer.getchannel('A').point(lambda n: 255 if n==0 else 0)
    for channel in ImageChops.difference(im,decoded).split():
        assert ImageChops.multiply(channel,outside).getextrema()==(0,0),path
    raw=out.read_bytes()
    entries.append({'path':path,'sourceSHA256':sha256(src).hexdigest(),'sha256':sha256(raw).hexdigest(),'bytes':len(raw),'width':w,'height':h,'watermarkBoxes':boxes,'outsideMaskPixelsExact':True})
manifest={'version':1,'method':'Two translucent perimeter JUMVI imprints + XMP attribution; lossless decoded pixels outside imprint mask','exempt':sorted(EXEMPT),'fontSHA256':sha256(FONT.read_bytes()).hexdigest(),'assets':entries}
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'watermarked':len(entries),'bytes':sum(x['bytes'] for x in entries),'maxBytes':max(x['bytes'] for x in entries),'originalsUntouched':True,'pixelInvariantVerified':True}))
