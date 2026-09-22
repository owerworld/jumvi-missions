"""Rebuild approved full-frame derivatives; usage: python tools/build-m25-assets.py LOCK_PACKAGE_ROOT.
Requires Pillow (created with 12.3); never downloads masters or changes approved source files.
"""
from pathlib import Path
import hashlib,json,sys
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]).resolve()
manifest_path=root/'content/asset-manifest.json'
manifest=json.loads(manifest_path.read_text())
for entry in manifest['assets']:
    master=source/entry['source']
    if hashlib.sha256(master.read_bytes()).hexdigest()!=entry['sourceSha256']:
        raise ValueError('Approved master mismatch: '+entry['source'])
    image=Image.open(master).convert('RGBA')
    if image.size!=(1536,1024):raise ValueError('Unexpected master geometry')
    image=image.resize((720,480),Image.Resampling.LANCZOS)
    output=root/entry['path']
    image.save(output,'WEBP',lossless=True,exact=True,method=6)
    if Image.open(output).convert('RGBA').tobytes()!=image.tobytes():raise ValueError('Encoding changed pixels')
    entry.update(sha256=hashlib.sha256(output.read_bytes()).hexdigest(),bytes=output.stat().st_size,width=720,height=480)
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
