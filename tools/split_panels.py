"""Split a 2x2 screenshot of a map's floors into one image per floor.

Usage: python3 tools/split_panels.py <screenshot> <out-dir> <floor> <floor> <floor> <floor>

Floors are named in reading order (top-left, top-right, bottom-left, bottom-right);
use "-" for a panel to skip, such as the roof. Writes <out-dir>/floor-<name>.png
plus floor-<name>.ignore.json, which tells the wall matcher to skip the legend
and floor-name labels along each panel's left edge.

Panels are found from the bright separator lines, padded to one size and shifted
so every floor lines up with the first (the panels can be cut a pixel apart),
which keeps the building still when switching floors in the app.
"""
import json, os, sys
import cv2
import numpy as np

LEFT_UI = 135  # legend and floor label width, in screenshot pixels


def separator(bright_share, length):
    """(first, last) index of the bright separator line nearest the middle, or None.
    A line counts when most of it is near-white; the legend box can cover part of it."""
    idx = np.nonzero(bright_share > 0.75)[0]
    idx = idx[(idx > length * 0.3) & (idx < length * 0.7)]
    if not len(idx):
        return None
    runs = np.split(idx, np.nonzero(np.diff(idx) > 1)[0] + 1)
    run = min(runs, key=lambda r: abs(r.mean() - length / 2))
    return int(run[0]), int(run[-1])


def main(shot, out_dir, *floors):
    assert len(floors) == 4, 'name four panels in reading order ("-" to skip one)'
    im = cv2.imread(shot)
    H, W = im.shape[:2]
    bright = im.min(axis=2) > 200
    xs = separator(bright.mean(axis=0), W) or (W // 2, W // 2 - 1)
    ys = separator(bright.mean(axis=1), H) or (H // 2, H // 2 - 1)
    boxes = [(0, 0, xs[0], ys[0]), (xs[1] + 1, 0, W, ys[0]),
             (0, ys[1] + 1, xs[0], H), (xs[1] + 1, ys[1] + 1, W, H)]
    print(f'separators at x {xs}, y {ys}')
    pw = max(b[2] - b[0] for b in boxes); ph = max(b[3] - b[1] for b in boxes)
    panels = []
    for x0, y0, x1, y1 in boxes:
        p = im[y0:y1, x0:x1]
        panels.append(cv2.copyMakeBorder(p, 0, ph - p.shape[0], 0, pw - p.shape[1], cv2.BORDER_REPLICATE))
    ref = cv2.cvtColor(panels[0], cv2.COLOR_BGR2GRAY).astype(np.float32)[:, LEFT_UI:]
    os.makedirs(out_dir, exist_ok=True)
    for name, p in zip(floors, panels):
        if name == '-':
            continue
        gp = cv2.cvtColor(p, cv2.COLOR_BGR2GRAY).astype(np.float32)[:, LEFT_UI:]
        (dx, dy), _ = cv2.phaseCorrelate(ref, gp)
        sx, sy = -int(round(dx)), -int(round(dy))
        if sx or sy:  # move this floor onto the first one's frame
            p = cv2.warpAffine(p, np.float32([[1, 0, sx], [0, 1, sy]]), (pw, ph), borderMode=cv2.BORDER_REPLICATE)
        path = os.path.join(out_dir, f'floor-{name.lower()}.png')
        cv2.imwrite(path, p)
        json.dump([[0, 0, LEFT_UI, ph]], open(path[:-4] + '.ignore.json', 'w'))
        print(f'{path}  {pw}x{ph}  shifted ({sx:+d}, {sy:+d})')


if __name__ == '__main__':
    main(*sys.argv[1:])
