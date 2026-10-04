"""Check a suspected copy locally. Never uploads an image, key or result."""
from pathlib import Path
from PIL import Image
import argparse,json
from art_hidden_mark import detect
ROOT=Path(__file__).resolve().parent.parent
ap=argparse.ArgumentParser();ap.add_argument('--key-file',required=True);ap.add_argument('--asset',required=True);ap.add_argument('--candidate',required=True)
args=ap.parse_args();manifest=json.loads((ROOT/'artifacts/art-protection-v2/manifest.json').read_text())
assert args.asset in {a['path'] for a in manifest['assets']},'Use an exact published asset path'
keyfile=Path(args.key_file).resolve();assert ROOT not in keyfile.parents,'Key must remain outside checkout'
result=detect(Image.open(ROOT/'artifacts/art-protection-v1'/args.asset),Image.open(args.candidate),keyfile.read_bytes(),args.asset)
print(json.dumps({'asset':args.asset,'result':result,'interpretation':'Matching signal found; supporting evidence only, not a legal authorship finding.' if result['detected'] else 'Inconclusive. Cropping, repainting, warping and aggressive compression can remove the signal.'},indent=2))
