"""Generate/verify delivery copies. Use --key-file OUTSIDE the Git checkout.
Dependencies: Pillow and NumPy. CI consumes pinned derivatives, never the key.
"""
from pathlib import Path
from PIL import Image
from hashlib import sha256
import argparse,json,io
from art_hidden_mark import embed,detect

ROOT=Path(__file__).resolve().parent.parent
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--key-file',required=True);ap.add_argument('--evidence-dir',required=True);ap.add_argument('--only');args=ap.parse_args()
    keyfile=Path(args.key_file).resolve();evidence=Path(args.evidence_dir).resolve()
    assert ROOT not in keyfile.parents and ROOT not in evidence.parents,'Private material must be outside checkout'
    key=keyfile.read_bytes();assert len(key)==32
    old=json.loads((ROOT/'artifacts/art-protection-v1/manifest.json').read_text())
    dest=ROOT/'artifacts/art-protection-v2';dest.mkdir(parents=True,exist_ok=True)
    entries=[];audit=[]
    for a in old['assets']:
        if args.only and args.only not in a['path']:continue
        path=a['path']
        visible=Image.open(ROOT/'artifacts/art-protection-v1'/path)
        # Embed into the already reviewed visible-branded copy. Pose and geometry
        # are untouched; only bounded luminance changes are introduced.
        marked,hidden=embed(visible,key,path)
        output=dest/path;output.parent.mkdir(parents=True,exist_ok=True)
        marked.save(output,'WEBP',lossless=True,quality=100,method=6,exact=True,xmp=visible.info.get('xmp',b''))
        decoded=Image.open(output).convert('RGBA');test={}
        test['lossless']=detect(visible,decoded,key,path)
        clean=io.BytesIO();decoded.save(clean,'PNG');clean.seek(0)
        test['metadata_removed']=detect(visible,Image.open(clean),key,path)
        rgb=Image.new('RGB',decoded.size,'white');rgb.paste(decoded,mask=decoded.getchannel('A'))
        for q in [90,75]:
            buf=io.BytesIO();rgb.save(buf,'JPEG',quality=q);buf.seek(0);test['jpeg'+str(q)]=detect(visible,Image.open(buf),key,path)
        for scale in [.75,.5]:test['resize'+str(scale)]=detect(visible,rgb.resize((round(rgb.width*scale),round(rgb.height*scale)),Image.Resampling.LANCZOS),key,path)
        crop=decoded.copy();crop.paste((255,255,255,255),(0,0,crop.width,round(crop.height*.08)));crop.paste((255,255,255,255),(0,round(crop.height*.92),crop.width,crop.height))
        test['perimeter_8percent_removed_same_canvas']=detect(visible,crop,key,path)
        test['unmarked_control']=detect(visible,visible,key,path)
        test['wrong_key_control']=detect(visible,decoded,sha256(key+b'negative control').digest(),path)
        unmarked=Image.new('RGB',visible.size,'white');v=visible.convert('RGBA');unmarked.paste(v,mask=v.getchannel('A'))
        buf=io.BytesIO();unmarked.save(buf,'JPEG',quality=75);buf.seek(0)
        test['unmarked_jpeg75_control']=detect(visible,Image.open(buf),key,path)
        test['unmarked_resize50_control']=detect(visible,unmarked.resize((round(unmarked.width*.5),round(unmarked.height*.5)),Image.Resampling.LANCZOS),key,path)
        assert all(test[k]['detected'] for k in ['lossless','metadata_removed','jpeg90','jpeg75','resize0.75']),path+json.dumps(test)
        assert not any(v['detected'] for k,v in test.items() if k.endswith('_control')),path
        raw=output.read_bytes()
        entry={k:a[k] for k in ['path','sourceSHA256','width','height','watermarkBoxes']}
        entry.update({'sha256':sha256(raw).hexdigest(),'bytes':len(raw),'visibleSourceSHA256':a['sha256'],'hidden':hidden})
        entries.append(entry);audit.append({'path':path,'hidden':hidden,'tests':test})
        print(json.dumps({'path':path,'hidden':hidden,'checks':{k:v['detected'] for k,v in test.items()}}),flush=True)
    evidence.mkdir(parents=True,exist_ok=True)
    (evidence/'robustness.json').write_text(json.dumps(audit,indent=2)+'\n')
    if not args.only:
        manifest={'version':2,'method':'Visible corner branding + reference-assisted keyed DCT signal + XMP. Not DRM.','exempt':old['exempt'],'fontSHA256':old['fontSHA256'],'assets':entries}
        (dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        (dest/'allowlist.json').write_text(json.dumps([x['path'] for x in entries],indent=2)+'\n')
    print(json.dumps({'count':len(entries),'bytes':sum(x['bytes'] for x in entries),'maxBytes':max(x['bytes'] for x in entries)}))
if __name__=='__main__':main()
