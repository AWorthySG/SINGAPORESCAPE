# Measure each creature picture's painted area and write a portrait framing table.
import sys, os, json
from PIL import Image
root = sys.argv[1]
out = {}
HEAD_RIGHT = {'wild_arowana', 'dugong'}   # long, low pictures with the head on the right
for sub in ('species', 'bosses'):
    d = os.path.join(root, 'assets/creatures', sub)
    for f in sorted(os.listdir(d)):
        if not f.endswith('.webp'): continue
        im = Image.open(os.path.join(d, f)).convert('RGBA'); W, H = im.size
        a = im.getchannel('A').point(lambda v: 255 if v > 40 else 0)
        x0, y0, x1, y1 = a.getbbox()
        bw, bh = x1 - x0, y1 - y0
        # A square that frames the creature: a little tighter than the whole sticker,
        # so the circle is filled; tall creatures are framed from the top (the head),
        # wide or round ones from the middle.
        side = max(bw, bh) * 0.82
        cx = (x0 + x1) / 2
        if f[:-5] in HEAD_RIGHT:
            # A long, low creature would be a thin line if all of it were
            # fitted in: frame its head end instead. Named by hand, as a wide
            # shape can also be a bat with its wings out (head in the middle).
            side = max(bh * 1.5, bw * 0.55)
            cx = x1 - side / 2 + side * 0.04
        cy = y0 + side / 2 - side * 0.04 if bh >= bw * 1.1 else (y0 + y1) / 2 - bh * 0.06
        out[f'{sub}/{f[:-5]}'] = [round(cx / W, 3), round(cy / H, 3), round(side / W, 3), round(side / H, 3)]
lines = ',\n'.join(f"  '{k}': {json.dumps(v)}" for k, v in out.items())
print(f"""// Portrait framing for the creature pictures, measured from each picture's
// painted area (made by tools/portrait_crops.py; re-run it when art changes).
// Each entry: [centre x, centre y, square width, square height], all as
// fractions of the picture, so a round portrait shows the creature rather than
// a guessed corner of its canvas.
export const PORTRAIT_CROPS = {{
{lines},
}};""")
