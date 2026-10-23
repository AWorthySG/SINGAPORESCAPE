# Standardise a painted creature sticker:
#  1. peel off its own white die-cut rim (the game adds one uniform border to every creature)
#  2. tight-crop, bottom-align and scale to a common "visual mass"
#  3. gently pull saturation / brightness / contrast toward shared targets
import sys, numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage as ndi
def peel(A):
    a = A[..., :3].astype(int); m = A[..., 3] > 20
    light = m & (a.min(axis=2) >= 200) & ((a.max(axis=2) - a.min(axis=2)) < 45)
    grow = ndi.binary_dilation(~m) & light
    for _ in range(60):
        nxt = ndi.binary_dilation(grow) & light
        if (nxt == grow).all(): break
        grow = nxt
    m2 = m & ~grow
    m2 = ndi.binary_opening(m2, iterations=1)
    l, k = ndi.label(m2)
    if k:
        s = ndi.sum(m2, l, range(1, k + 1)); keep = [i + 1 for i, v in enumerate(s) if v > s.max() * 0.02]
        m2 = np.isin(l, keep)
    A = A.copy(); A[..., 3] = np.where(m2, A[..., 3], 0)
    return A
def grade(img, tgt_sat=0.52, tgt_val=0.62):
    rgb = img.convert('RGB'); hsv = np.asarray(rgb.convert('HSV')).astype(float) / 255
    al = np.asarray(img)[..., 3] > 0
    if not al.any(): return img
    s = hsv[..., 1][al].mean(); v = hsv[..., 2][al].mean()
    k_s = np.clip(tgt_sat / max(s, 0.05), 0.8, 1.25); k_v = np.clip(tgt_val / max(v, 0.05), 0.9, 1.12)
    out = ImageEnhance.Color(rgb).enhance(k_s); out = ImageEnhance.Brightness(out).enhance(k_v); out = ImageEnhance.Contrast(out).enhance(1.05)
    o = out.convert('RGBA'); o.putalpha(img.getchannel('A')); return o
def standardise(src, box=256, mass=0.66):
    A = np.array(Image.open(src).convert('RGBA'))
    A = peel(A)
    ys, xs = np.nonzero(A[..., 3]); A = A[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    img = grade(Image.fromarray(A))
    area = (np.asarray(img)[..., 3] > 0).sum()
    s = mass * box / np.sqrt(area)                         # same opaque area for every creature
    s = min(s, (box * 0.96) / img.width, (box * 0.96) / img.height)
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    c = Image.new('RGBA', (box, box), (0, 0, 0, 0))
    c.paste(img, ((box - img.width) // 2, box - img.height - 4), img)   # feet on the bottom edge
    return c
if __name__ == '__main__':
    standardise(sys.argv[1], int(sys.argv[3]) if len(sys.argv) > 3 else 256).save(sys.argv[2])
