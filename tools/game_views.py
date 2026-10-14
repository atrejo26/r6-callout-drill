"""Crop Ubisoft's blueprints around each building and map every callout onto them.

Usage: python3 -I tools/game_views.py <blueprints-dir> src/

Reads src/alignment.json (from tools/align.py) and src/callouts.json, writes
src/game/<map>_<floor>.webp and adds `game` views plus gx/gy callout positions
to callouts.json. All floors of one map share the same crop so switching floors
keeps the building in place, as it does in game.
"""
import json, os, sys, glob
import numpy as np
from PIL import Image, ImageFilter

BP, SRC = sys.argv[1], sys.argv[2]
data = json.load(open(os.path.join(SRC, 'callouts.json')))
reg = json.load(open(os.path.join(SRC, 'alignment.json')))
os.makedirs(os.path.join(SRC, 'game'), exist_ok=True)
BPDIR = {'nighthaven': 'nighthavenlabs'}


def xform(r, x, y):
    w, h = r['dw'], r['dh']
    if r['flip']:
        x = w - 1 - x
    for _ in range(r['k']):
        x, y, w, h = y, w - 1 - x, h, w
    return r['x'] + x * r['s'], r['y'] + y * r['s']


def wall_box(r, plan_path):
    """Blueprint-space box around the plan's walls, ignoring stray outlier pixels."""
    g = np.asarray(Image.open(plan_path).convert('L'))
    ys, xs = np.nonzero(g < 90)
    x0, x1 = np.percentile(xs, [1.5, 98.5]); y0, y1 = np.percentile(ys, [1.5, 98.5])
    pts = [xform(r, x, y) for x, y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1))]
    return min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts)


for m in data['maps']:
    floors = [(f, reg.get(f"{m['id']}|{f['name']}")) for f in m['floors']]
    floors = [(f, r) for f, r in floors if r and not r.get('rejected')]
    if not floors:
        continue
    boxes = [wall_box(r, os.path.join(SRC, f['image'])) for f, r in floors]
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
    x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
    pad = 0.06 * max(x1 - x0, y1 - y0)
    crop = tuple(int(round(v)) for v in (max(0, x0 - pad), max(0, y0 - pad), min(1600, x1 + pad), min(900, y1 + pad)))
    cw, ch = crop[2] - crop[0], crop[3] - crop[1]
    for f, r in floors:
        path = glob.glob(f"{BP}/{BPDIR.get(m['id'], m['id'])}/**/{r['bp']}", recursive=True)[0]
        img = Image.open(path).convert('RGB').crop(crop)
        # Some maps are shot from far out; upscale small crops with Lanczos plus
        # a light sharpen, which holds up better than the browser's own scaling.
        k = min(3.0, 1000 / max(cw, ch))
        if k > 1.2:
            img = img.resize((round(cw * k), round(ch * k)), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2, 60, 2))
        fn = f"game/{m['id']}_{f['name'].lower()}.webp"
        img.save(os.path.join(SRC, fn), 'WEBP', quality=86, method=6)
        f['game'] = dict(image=fn, w=img.width, h=img.height)
        for c in f['callouts']:
            gx, gy = xform(r, c['x'] * r['dw'], c['y'] * r['dh'])
            c['gx'] = round((gx - crop[0]) / cw, 4)
            c['gy'] = round((gy - crop[1]) / ch, 4)
    print(f"{m['id']:11s} crop {cw}x{ch}  in-game floors: {', '.join(f['name'] for f, _ in floors)}")

json.dump(data, open(os.path.join(SRC, 'callouts.json'), 'w'), indent=1)
