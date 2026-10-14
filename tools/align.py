"""Align each call-sheet floor plan onto Ubisoft's in-game blueprint for that floor.

Usage: python3 -I tools/align.py <blueprints-dir> src/ [map ids...]

<blueprints-dir> holds one folder per map (border/, chalet/, ..., nighthavenlabs/)
with Ubisoft's r6-maps-<map>-blueprint-N.jpg files. The search matches the
plan's dark walls against the blueprint's white walls over scale and position,
rewarding walls that land on white lines and penalising room interiors that do.
Writes src/alignment.json (merging with any existing entries).
"""
import cv2, numpy as np, json, glob, sys, os
BP = sys.argv[1]; SRC = sys.argv[2]; only = sys.argv[3:]
data = json.load(open(SRC + '/callouts.json'))
BPDIR = {'nighthaven': 'nighthavenlabs'}
H = 1.0

def umask(path):
    im = cv2.imread(path)
    m = (im.min(axis=2) > 205).astype(np.float32)
    m[690:, 1270:] = 0
    m = cv2.resize(m, None, fx=H, fy=H, interpolation=cv2.INTER_AREA)
    return cv2.GaussianBlur(m, (0, 0), 1.2).astype(np.float32)

def dmasks(path):
    g = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    walls = (g < 90).astype(np.uint8)
    # footprint: everything not reachable from the border through non-wall pixels
    closed = cv2.dilate(walls, np.ones((9, 9), np.uint8))
    ff = (1 - closed).astype(np.uint8) * 255
    pad = cv2.copyMakeBorder(ff, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=255)
    mask = np.zeros((pad.shape[0] + 2, pad.shape[1] + 2), np.uint8)
    cv2.floodFill(pad, mask, (0, 0), 128)
    outside = (pad[1:-1, 1:-1] == 128)
    foot = (~outside).astype(np.float32)
    return walls.astype(np.float32), foot

def orient(m, k, flip):
    if flip: m = m[:, ::-1]
    return np.ascontiguousarray(np.rot90(m, k))

OUT = SRC + '/alignment.json'
out = json.load(open(OUT)) if os.path.exists(OUT) else {}
# Ubisoft image number for each deck floor (images go lowest floor first; Villa's #2 is an empty level).
# Optional per-floor scale search ranges, e.g. {'bank|2F': (0.6, 0.8)}.
# Bank 2F has no good match (Ubisoft's 2F differs from the call sheet), so it is
# marked "rejected": true in alignment.json and keeps the call-sheet plan.
SCALES = {}
ASSIGN = {'villa': {'Basement': 1, '1F': 3, '2F': 4}}
for m in data['maps']:
    if only and m['id'] not in only: continue
    bps = sorted(f for f in glob.glob(f"{BP}/{BPDIR.get(m['id'], m['id'])}/**/*.jpg", recursive=True) if 'MACOSX' not in f)
    U = [(p, umask(p)) for p in bps]
    for f in m['floors']:
        W, F = dmasks(SRC + '/' + f['image'])
        cands = []
        n = ASSIGN.get(m['id'], {}).get(f['name'], m['floors'].index(f) + 1)
        Uf = [u for u in U if u[0].endswith(f'-{n}.jpg')]
        for k in (0,):
            for flip in (0,):
                Wo, Fo = orient(W, k, flip), orient(F, k, flip)
                for s in np.geomspace(*SCALES.get(f"{m['id']}|{f['name']}", (0.08, 1.0)), 60):
                    w, h = int(Wo.shape[1] * s * H), int(Wo.shape[0] * s * H)
                    if w < 60 or h < 60 or w >= 1590 or h >= 890: continue
                    wt = cv2.resize(Wo, (w, h), interpolation=cv2.INTER_AREA)
                    wt = cv2.GaussianBlur((wt > 0.15).astype(np.float32), (0, 0), 1.2)
                    ft = cv2.resize(Fo, (w, h), interpolation=cv2.INTER_AREA) > 0.5
                    interior = ft & (cv2.dilate(wt, np.ones((5, 5), np.uint8)) < 0.05)
                    t = (wt - interior.astype(np.float32) * (wt.sum() / max(1, interior.sum()))).astype(np.float32)
                    for ui, (p, um) in enumerate(Uf):
                        r = cv2.matchTemplate(um, t, cv2.TM_CCORR)
                        _, v, _, loc = cv2.minMaxLoc(r)
                        cands.append((v / wt.sum() * np.sqrt(wt.sum()), ui, k, flip, float(s), loc, v / wt.sum()))
        cands.sort(key=lambda c: -c[0])
        v, ui, k, flip, s, loc, prec = cands[0]
        key = f"{m['id']}|{f['name']}"
        out[key] = dict(score=round(float(v), 2), prec=round(float(prec), 3), bp=os.path.basename(Uf[ui][0]), k=k, flip=flip, s=s,
                        x=loc[0] / H, y=loc[1] / H, dw=W.shape[1], dh=W.shape[0],
                        runner=[(round(float(c[0]), 1), os.path.basename(Uf[c[1]][0])[-5], c[2] * 90, c[3], round(c[4], 2)) for c in cands[1:4]])
        print(key, out[key]['bp'][-5], 'score', out[key]['score'], 'prec', out[key]['prec'], 'rot', k * 90, 'flip', flip, 'scale', round(s, 3), out[key]['runner'], flush=True)
json.dump(out, open(OUT, 'w'), indent=1)
