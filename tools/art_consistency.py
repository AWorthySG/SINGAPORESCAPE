# Bring painted art into the house style without redrawing it (see the style
# rules in tests/artstyle.test.mjs and the art-consistency PR):
#   ink   recolour near-black ink lines to painted navy ink: the outline
#         band fully, and inside the picture only the near-neutral, very dark
#         ink (so painted black cloth or fur keeps its colour)
#   rim   give an icon without a white die-cut border the shared sticker rim
#         (a navy ink line where its own edge has none, then white), shrinking
#         it just enough that the rim fits the canvas
#   line  draw a thin navy ink line round a picture that has no outline
#   grade the creature tool's gentle saturation / brightness pull, for pictures
#         clearly outside their set's range
# Usage: python3 -I tools/art_consistency.py <op>[,<op>...] <file.webp>...   (in place)
#   e.g. python3 -I tools/art_consistency.py ink,rim assets/icons/item-coal.webp
# Ops can take a value: grade=0.36 (target saturation), rim=0.035 (rim share of size).
import sys
import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage as ndi

NAVY = np.array([34, 48, 74], float)
# The core of a painted navy line: the median of the ~500 navy-lined pictures'
# outlines. Painted ink sits a little darker than the flat #22304A the code draws,
# and black lines recoloured to this keep their weight.
PAINT = np.array([24, 37, 62], float)


def _lum(rgb):
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def ink(A):
    """Near-black ink to navy: the outline band whatever its hue, the rest only if near-neutral."""
    A = A.astype(float)
    m = A[..., 3] > 40
    d = ndi.distance_transform_edt(m)
    size = max(m.shape)
    rgb = A[..., :3]
    L = _lum(rgb)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    band = m & (d <= max(3.0, size * 0.03))
    w_band = np.clip((95 - L) / 50, 0, 1) * band
    w_in = np.clip((50 - L) / 30, 0, 1) * (chroma < 26) * m
    w = np.maximum(w_band, w_in)[..., None]
    A[..., :3] = rgb * (1 - w) + PAINT * w
    return np.clip(A, 0, 255).astype(np.uint8)


def _ring(alpha, r):
    """A soft-edged ring r px wide round the opaque shape (alpha 0..1 in, 0..1 out)."""
    if r <= 0:
        return np.zeros_like(alpha)
    dist = ndi.distance_transform_edt(alpha < 0.5)
    return np.clip(r + 0.5 - dist, 0, 1)


def _fit(A, pad):
    """Shrink (never grow) the picture about its centre so `pad` px of rim fits round it."""
    H, W = A.shape[:2]
    m = A[..., 3] > 8
    ys, xs = np.nonzero(m)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    bw, bh = x1 - x0, y1 - y0
    k = min(1.0, (W - 2 * pad - 2) / bw, (H - 2 * pad - 2) / bh)
    crop = Image.fromarray(A[y0:y1, x0:x1])
    if k < 1:
        crop = crop.resize((max(1, round(bw * k)), max(1, round(bh * k))), Image.LANCZOS)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    px = int(round(min(max(cx - crop.width / 2, pad + 1), W - pad - 1 - crop.width)))
    py = int(round(min(max(cy - crop.height / 2, pad + 1), H - pad - 1 - crop.height)))
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out.paste(crop, (px, py))
    return np.array(out)


def _has_dark_edge(A):
    m = A[..., 3] > 40
    d = ndi.distance_transform_edt(m)
    band = m & (d <= max(2.0, max(m.shape) * 0.015))
    return band.any() and (_lum(A[..., :3].astype(float))[band] < 95).mean() > 0.4


def rim(A, share=0.035):
    """The shared icon sticker: navy ink line (if the edge has none) inside a white die-cut rim."""
    ys, xs = np.nonzero(A[..., 3] > 8)
    size = max(xs.max() - xs.min(), ys.max() - ys.min()) + 1
    ink_w = 0 if _has_dark_edge(A) else max(1.5, size * 0.014)
    rim_w = max(2.0, size * share)
    A = _fit(A, int(np.ceil(ink_w + rim_w)))
    a = A[..., 3] / 255.0
    # Sparkles and loose bits sit inside one rim with the body, as on the hand-made stickers.
    k = int(round(rim_w * 1.5))
    shape = np.maximum(a, ndi.binary_closing(np.pad(a > 0.5, k), iterations=k)[k:-k, k:-k])
    # The ink line follows the body, not every loose sparkle (those just sit on the white).
    lab, n = ndi.label(a > 0.5)
    body = a
    if n > 1:
        sizes = ndi.sum(a > 0.5, lab, range(1, n + 1))
        body = a * np.isin(lab, [i + 1 for i, v in enumerate(sizes) if v >= sizes.max() * 0.02])
    navy = _ring(body, ink_w) * (1 - a)
    white = _ring(shape, ink_w + rim_w)
    base = np.zeros(A.shape, float)
    base[..., :3] = 255
    base[..., 3] = white
    # navy ink line over the white
    base[..., :3] = base[..., :3] * (1 - navy[..., None]) + NAVY * navy[..., None]
    base[..., 3] = np.maximum(base[..., 3], navy)
    # the art over both
    fa = a[..., None]
    out = np.empty(A.shape, float)
    oa = fa[..., 0] + base[..., 3] * (1 - fa[..., 0])
    out[..., :3] = (A[..., :3] * fa + base[..., :3] * base[..., 3:4] * (1 - fa)) / np.maximum(oa[..., None], 1e-6)
    out[..., 3] = oa * 255
    return np.clip(out, 0, 255).astype(np.uint8)


def line(A):
    """A thin navy ink line round a picture with no outline (no white rim: world characters)."""
    ys, xs = np.nonzero(A[..., 3] > 8)
    size = max(xs.max() - xs.min(), ys.max() - ys.min()) + 1
    w = max(2.0, size * 0.012)
    H, W = A.shape[:2]
    p = int(np.ceil(w)) + 1
    big = np.zeros((H + 2 * p, W + 2 * p, 4), np.uint8)
    big[p:p + H, p:p + W] = A
    a = big[..., 3] / 255.0
    navy = _ring(a, w)
    out = big.astype(float)
    fa = a[..., None]
    oa = a + navy * (1 - a)
    out[..., :3] = (big[..., :3] * fa + NAVY * navy[..., None] * (1 - fa)) / np.maximum(oa[..., None], 1e-6)
    out[..., 3] = oa * 255
    return np.clip(out, 0, 255).astype(np.uint8)


def grade(A, tgt_sat=0.52, tgt_val=0.66):
    """tools/unify_creatures.py's gentle pull toward the set's saturation and brightness."""
    img = Image.fromarray(A)
    rgb = img.convert('RGB')
    hsv = np.asarray(rgb.convert('HSV')).astype(float) / 255
    al = A[..., 3] > 0
    s = hsv[..., 1][al].mean()
    v = hsv[..., 2][al].mean()
    k_s = np.clip(tgt_sat / max(s, 0.05), 0.85, 1.2)
    k_v = np.clip(tgt_val / max(v, 0.05), 0.95, 1.08)
    out = ImageEnhance.Color(rgb).enhance(k_s)
    out = ImageEnhance.Brightness(out).enhance(k_v)
    o = out.convert('RGBA')
    o.putalpha(img.getchannel('A'))
    return np.array(o)


OPS = {'ink': ink, 'rim': rim, 'line': line, 'grade': grade}

if __name__ == '__main__':
    ops = [o.split('=') for o in sys.argv[1].split(',')]
    for f in sys.argv[2:]:
        A = np.array(Image.open(f).convert('RGBA'))
        for o in ops:
            A = OPS[o[0]](A, *[float(x) for x in o[1:]])
        Image.fromarray(A).save(f, 'WEBP', quality=90, method=6)
        print('ok', f)
