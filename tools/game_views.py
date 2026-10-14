"""Crop Ubisoft's blueprints around each building and map every callout onto them.

Usage: python3 -I tools/game_views.py <blueprints-dir> src/ [map ids...]

Reads src/alignment.json (from tools/align.py) and src/callouts.json, writes
src/game/<map>_<floor>.webp and adds `game` views plus gx/gy callout positions
to callouts.json. All floors of one map share the same crop so switching floors
keeps the building in place, as it does in game.

Each callout is placed with the floor's fit, then nudged: the call sheet's walls
around it are matched against Ubisoft's walls around it, within a few percent of
the building's size. That fixes places where the call sheet is drawn a little
differently from the game (Lair 1F's north end sits ~4% low on the sheet).
"""
import json, os, sys, glob
import cv2
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from masks import IGNORE, blueprint_walls, plan_masks

BP, SRC = sys.argv[1], sys.argv[2]
only = sys.argv[3:]
data = json.load(open(os.path.join(SRC, 'callouts.json')))
reg = json.load(open(os.path.join(SRC, 'alignment.json')))
os.makedirs(os.path.join(SRC, 'game'), exist_ok=True)
BPDIR = {'nighthaven': 'nighthavenlabs'}


def xform(r, x, y):
    """Plan pixel -> blueprint pixel (see tools/align.py)."""
    return r['x'] + x * r['sx'], r['y'] + y * r['sy']


def nudges(r, f, key, bp_path):
    """Per-callout (dx, dy) in blueprint pixels from matching walls locally.

    Around each callout, the call sheet's walls (placed by the floor's fit) are
    compared with Ubisoft's by normalized cross-correlation, with both blurred so
    a 2-3 px miss still counts. A shift is kept only when it is clearly better:
    real drawing differences gain 0.3 or more, chance matches on repeating walls
    gain under 0.1. A real difference also moves a whole area, so a shift is kept
    only when at least two other callouts nearby found about the same shift; a lone
    shift is more likely a chance match (Clubhouse 2F "R long" jumped into the
    garage roof box).
    """
    W, _ = plan_masks(os.path.join(SRC, f['image']), IGNORE.get(key, ()))
    w, h = int(round(W.shape[1] * r['sx'])), int(round(W.shape[0] * r['sy']))
    wt = cv2.resize(W, (w, h), interpolation=cv2.INTER_AREA)
    wt = cv2.GaussianBlur((wt > 0.15).astype(np.float32), (0, 0), 2.5)
    ox, oy, P = int(round(r['x'])), int(round(r['y'])), 200
    tw = np.zeros((900 + 2 * P, 1600 + 2 * P), np.float32)
    tw[oy + P:oy + P + h, ox + P:ox + P + w] = wt
    U = cv2.GaussianBlur(blueprint_walls(bp_path), (0, 0), 2.5)
    U = cv2.copyMakeBorder(U, P, P, P, P, cv2.BORDER_CONSTANT, value=0)
    size = max(w, h)
    R, D = max(24, int(0.10 * size)), max(5, int(0.045 * size))
    raw, pts = [], []
    for c in f['callouts']:
        bx, by = xform(r, c['x'] * r['dw'], c['y'] * r['dh'])
        pts.append((bx, by))
        cx, cy = int(round(bx)) + P, int(round(by)) + P
        win = tw[cy - R:cy + R + 1, cx - R:cx + R + 1]
        if win.sum() < 2 * R:  # too few walls nearby to say anything
            raw.append((0, 0)); continue
        area = U[cy - R - D:cy + R + D + 1, cx - R - D:cx + R + D + 1]
        res = cv2.matchTemplate(area, win, cv2.TM_CCORR_NORMED)
        h0 = res[D, D]
        _, h1, _, (x1, y1) = cv2.minMaxLoc(res)
        raw.append((x1 - D, y1 - D) if h1 - h0 >= 0.2 and h1 >= 0.6 else (0, 0))
    out = []
    for i, (n, p) in enumerate(zip(raw, pts)):
        if n == (0, 0):
            out.append(n); continue
        tol = max(3, 0.35 * np.hypot(*n))
        agree = sum(1 for j, (m, q) in enumerate(zip(raw, pts)) if j != i and m != (0, 0)
                    and np.hypot(q[0] - p[0], q[1] - p[1]) <= 2.5 * R
                    and np.hypot(m[0] - n[0], m[1] - n[1]) <= tol)
        out.append(n if agree >= 2 else (0, 0))
    return out


def wall_box(r, plan_path):
    """Blueprint-space box around the plan's walls, ignoring stray outlier pixels."""
    g = np.asarray(Image.open(plan_path).convert('L'))
    ys, xs = np.nonzero(g < 90)
    x0, x1 = np.percentile(xs, [1.5, 98.5]); y0, y1 = np.percentile(ys, [1.5, 98.5])
    pts = [xform(r, x, y) for x, y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1))]
    return min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts)


for m in data['maps']:
    if only and m['id'] not in only:
        continue
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
        key = f"{m['id']}|{f['name']}"
        path = glob.glob(f"{BP}/{BPDIR.get(m['id'], m['id'])}/**/{r['bp']}", recursive=True)[0]
        img = Image.open(path).convert('RGB').crop(crop)
        # Some maps are shot from far out; upscale small crops with Lanczos plus
        # a light sharpen, which holds up better than the browser's own scaling.
        k = min(3.0, 1000 / max(cw, ch))
        if k > 1.2:
            img = img.resize((round(cw * k), round(ch * k)), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2, 60, 2))
        fn = f"game/{m['id']}_{f['name'].lower()}.webp"
        img.save(os.path.join(SRC, fn), 'WEBP', quality=86, method=6)
        f['game'] = dict(image=fn, w=img.width, h=img.height, crop=list(crop))  # crop: blueprint pixels
        for c, (dx, dy) in zip(f['callouts'], nudges(r, f, key, path)):
            gx, gy = xform(r, c['x'] * r['dw'], c['y'] * r['dh'])
            if dx or dy:
                print(f"    nudged {key} {c['name']!r} by ({dx:+d}, {dy:+d}) px")
            c['gx'] = round((gx + dx - crop[0]) / cw, 4)
            c['gy'] = round((gy + dy - crop[1]) / ch, 4)
    print(f"{m['id']:11s} crop {cw}x{ch}  in-game floors: {', '.join(f['name'] for f, _ in floors)}")

json.dump(data, open(os.path.join(SRC, 'callouts.json'), 'w'), indent=1)
