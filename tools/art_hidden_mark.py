"""Reference-assisted keyed DCT ownership signal; NOT DRM or legal proof.

The key and verification evidence stay outside the repository. Detection needs
the original, matching asset path, key and aligned image dimensions. A failed
detection is inconclusive, not proof that an image is unrelated to JUMVI.
"""
import hashlib, hmac, math
import numpy as np
from PIL import Image

BLOCK = 16
STRENGTH = 14.0
u = np.arange(BLOCK)[:, None]
x = np.arange(BLOCK)[None, :]
C = np.cos(math.pi * (2*x+1)*u/(2*BLOCK)) * math.sqrt(2/BLOCK)
C[0] /= math.sqrt(2)
BASIS = np.outer(C[2], C[3]) - np.outer(C[3], C[2])

def layout(reference, key, asset):
    rgba = np.asarray(reference.convert('RGBA'), dtype=np.float64)
    h,w = rgba.shape[:2]; rows,cols = h//BLOCK,w//BLOCK
    rgb = rgba[:rows*BLOCK,:cols*BLOCK,:3]
    y = rgb @ np.array([.299,.587,.114])
    blocks = y.reshape(rows,BLOCK,cols,BLOCK).transpose(0,2,1,3)
    alpha = rgba[:rows*BLOCK,:cols*BLOCK,3].reshape(rows,BLOCK,cols,BLOCK).transpose(0,2,1,3)
    # Avoid transparent/translucent edges, flat backgrounds and corner stamps.
    eligible = (alpha.min(axis=(2,3)) >= 230) & (blocks.std(axis=(2,3)) > 5)
    eligible[:3,:8]=False; eligible[-3:,-8:]=False
    yy,xx = np.nonzero(eligible)
    seed = hmac.new(key,('JUMVI hidden art v2\0'+asset).encode(),hashlib.sha256).digest()
    bits = hashlib.shake_256(seed).digest(len(yy))
    signs = np.array([1 if b & 1 else -1 for b in bits], dtype=np.float64)
    return rgba, yy,xx,signs

def embed(reference,key,asset):
    rgba,yy,xx,signs=layout(reference,key,asset)
    assert len(yy)>=128, 'Insufficient textured opaque blocks: '+asset
    out=rgba.copy()
    for by,bx,s in zip(yy,xx,signs):
        out[by*BLOCK:(by+1)*BLOCK,bx*BLOCK:(bx+1)*BLOCK,:3] += s*STRENGTH*BASIS[:,:,None]
    out=np.clip(np.rint(out),0,255).astype(np.uint8)
    delta=out[:,:,:3].astype(float)-rgba[:,:,:3]
    mse=float(np.mean(delta**2)); psnr=10*math.log10(255**2/mse)
    assert np.array_equal(out[:,:,3],rgba[:,:,3]), 'Alpha changed'
    assert np.max(np.abs(delta))<=4 and psnr>=42, 'Perceptual change budget exceeded'
    return Image.fromarray(out),{'scheme':'JUMVI-reference-dct-v2','keyId':hashlib.sha256(key).hexdigest()[:16], 'blocks':len(yy),'maxRGBDelta':int(np.max(np.abs(delta))), 'psnrDB':round(psnr,3),'alphaExact':True,'dimensionsExact':True}

def detect(reference,candidate,key,asset):
    rgba,yy,xx,signs=layout(reference,key,asset)
    image=candidate.convert('RGBA')
    # Known whole-image resizes can be aligned. Unknown crops/warps cannot.
    if image.size!=reference.size:image=image.resize(reference.size,Image.Resampling.LANCZOS)
    y=(np.asarray(image,dtype=float)[:,:,:3]-rgba[:,:,:3]) @ np.array([.299,.587,.114])
    residual=np.array([np.sum(y[by*BLOCK:(by+1)*BLOCK,bx*BLOCK:(bx+1)*BLOCK]*BASIS)/2 for by,bx in zip(yy,xx)])
    gain=float(np.mean(residual*signs)); rms=float(np.sqrt(np.mean(residual**2)))
    correlation=gain/rms if rms else 0
    return {'detected':len(signs)>=128 and gain>=3.5 and correlation>=.15,'gain':round(gain,4),'correlation':round(correlation,4),'blocks':len(signs)}
