"""Align each call-sheet floor plan onto Ubisoft's in-game blueprint for that floor.

Usage: python3 -I tools/align.py <blueprints-dir> src/ [map ids or map|floor keys...]

<blueprints-dir> holds one folder per map (border/, chalet/, ..., nighthavenlabs/)
with Ubisoft's r6-maps-<map>-blueprint-N.jpg files, or floor-<floor>.png
screenshots from tools/split_panels.py, which are used instead when present. The fit is
    blueprint_x = x + sx * plan_x,   blueprint_y = y + sy * plan_y
with separate horizontal and vertical scales: the deck's plan images are not
always stretched evenly (Border 1F is ~10% taller than the game). The score
rewards the plan's dark walls landing on the blueprint's white walls and
penalises room interiors that do. The search first finds the best even-scale
fit, then refines each scale separately within +-10% of it; a free search over
stretch finds false matches (Clubhouse 1F).
Writes src/alignment.json (keeping entries for maps not re-run, and any
hand-set "rejected" flags).
"""
import cv2, numpy as np, json, glob, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from masks import IGNORE, blueprint_mask, plan_masks, scaled_template

BP, SRC = sys.argv[1], sys.argv[2]
only = sys.argv[3:]
OUT = os.path.join(SRC, 'alignment.json')
BPDIR = {'nighthaven': 'nighthavenlabs'}
# Ubisoft image number for each floor when it isn't simply lowest floor first
# (Villa's #2 is an empty level; Bank's images go 1F, 2F, Basement, Roof).
ASSIGN = {'villa': {'Basement': 1, '1F': 3, '2F': 4},
          'bank': {'Basement': 3, '1F': 1, '2F': 2}}


def floor_image(map_id, floor, index):
    """The floor's in-game image: a screenshot from split_panels.py if there is
    one, else Ubisoft's blueprint for that floor."""
    d = f"{BP}/{BPDIR.get(map_id, map_id)}"
    shots = glob.glob(f"{d}/**/floor-{floor.lower()}.png", recursive=True)
    if shots:
        return shots[0]
    n = ASSIGN.get(map_id, {}).get(floor, index + 1)
    return next(p for p in glob.glob(f"{d}/**/*-{n}.jpg", recursive=True) if 'MACOSX' not in p)


def score_grid(W, F, um, H, pairs):
    """Best placement for each (sx, sy) pair; returns [(score, sx, sy, x, y)]."""
    out = []
    for sx, sy in pairs:
        w, h = int(W.shape[1] * sx * H), int(W.shape[0] * sy * H)
        if w < 50 or h < 50 or w >= um.shape[1] - 2 or h >= um.shape[0] - 2:
            continue
        wt, interior = scaled_template(W, F, w, h)
        t = (wt - interior.astype(np.float32) * (wt.sum() / max(1, interior.sum()))).astype(np.float32)
        r = cv2.matchTemplate(um, t, cv2.TM_CCORR)
        _, v, _, loc = cv2.minMaxLoc(r)
        out.append((v / np.sqrt(wt.sum()), sx, sy, loc[0] / H, loc[1] / H))
    return out


out = json.load(open(OUT)) if os.path.exists(OUT) else {}
data = json.load(open(os.path.join(SRC, 'callouts.json')))
for m in data['maps']:
    for i, f in enumerate(m['floors']):
        key = f"{m['id']}|{f['name']}"
        if only and m['id'] not in only and key not in only:
            continue
        path = floor_image(m['id'], f['name'], i)
        if out.get(key, {}).get('rejected'):
            print(f"{key:20s} kept as rejected", flush=True)
            continue
        W, F = plan_masks(os.path.join(SRC, f['image']), IGNORE.get(key, ()))
        # 1. even scale, coarse, half resolution
        coarse = score_grid(W, F, blueprint_mask(path, 0.5), 0.5, [(s_, s_) for s_ in np.geomspace(0.08, 3.0, 75)])
        coarse.sort(key=lambda c: -c[0])
        picks = []
        for c in coarse:  # a few distinct candidate scales
            if all(abs(c[1] / p[1] - 1) > 0.06 for p in picks):
                picks.append(c)
            if len(picks) == 3:
                break
        # 2. even scale, fine, full resolution
        um = blueprint_mask(path, 1.0)
        even = []
        for _, s0, _, _, _ in picks:
            even += score_grid(W, F, um, 1.0, [(s0 * a, s0 * a) for a in np.linspace(0.97, 1.03, 7)])
        even.sort(key=lambda c: -c[0])
        s0 = even[0][1]
        # 3. separate x/y scales within +-10% of the best even fit, then finer
        fine = score_grid(W, F, um, 1.0, [(s0 * a, s0 * b) for a in np.linspace(0.9, 1.1, 11) for b in np.linspace(0.9, 1.1, 11)])
        fine.sort(key=lambda c: -c[0])
        _, sx1, sy1, _, _ = fine[0]
        fine += score_grid(W, F, um, 1.0, [(sx1 * a, sy1 * b) for a in np.linspace(0.98, 1.02, 9) for b in np.linspace(0.98, 1.02, 9)])
        fine.sort(key=lambda c: -c[0])
        v, sx, sy, x, y = fine[0]
        prev = out.get(key, {})
        out[key] = dict(score=round(float(v), 2), bp=os.path.basename(path), sx=float(sx), sy=float(sy),
                        x=float(x), y=float(y), dw=W.shape[1], dh=W.shape[0])
        if prev.get('rejected'):
            out[key]['rejected'] = True
        print(f"{key:20s} {os.path.basename(path):34s} score {v:6.2f} sx {sx:.3f} sy {sy:.3f} (sy/sx {sy / sx:.3f})", flush=True)
        json.dump(out, open(OUT, 'w'), indent=1)
