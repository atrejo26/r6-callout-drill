"""Wall masks shared by align.py (whole-floor fit) and game_views.py (per-label nudge)."""
import json, os
import cv2
import numpy as np

# Titles baked into a few plan images, as fractions (x0, y0, x1, y1) of the image.
# They are black like walls, so the matcher would otherwise try to fit them.
IGNORE = {
    'clubhouse|1F': [(0, 0, 0.22, 0.09)],   # "Clubhouse / Ground Floor"
    'nighthaven|1F': [(0, 0, 0.24, 0.06)],  # "...en Labs"
    # tunnel and courtyard: Ubisoft's basement image draws no walls there
    'villa|Basement': [(0, 0.70, 1, 1)],
}


def blueprint_walls(path):
    """White wall lines of an in-game image, full resolution, 0/1 float."""
    im = cv2.imread(path)
    m = (im.min(axis=2) > 205).astype(np.float32)
    if im.shape[:2] == (900, 1600):
        m[690:, 1270:] = 0  # legend box on Ubisoft's blueprints
    side = os.path.splitext(path)[0] + '.ignore.json'
    if os.path.exists(side):  # legend and labels in screenshots (split_panels.py)
        for x0, y0, x1, y1 in json.load(open(side)):
            m[y0:y1, x0:x1] = 0
    return m


def blueprint_mask(path, H):
    m = blueprint_walls(path)
    if H != 1:
        m = cv2.resize(m, None, fx=H, fy=H, interpolation=cv2.INTER_AREA)
    return cv2.GaussianBlur(m, (0, 0), 1.2).astype(np.float32)


def plan_masks(path, ignore=()):
    """(walls, footprint) of a call-sheet plan, 0/1 float, plan resolution."""
    g = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    walls = (g < 90).astype(np.uint8)
    H, W = walls.shape
    for x0, y0, x1, y1 in ignore:
        walls[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = 0
    # decorative rules across the whole image (Villa's plans have them top and bottom)
    for row in np.nonzero(walls.mean(axis=1) > 0.99)[0]:
        walls[max(0, row - 3):row + 4] = 0
    closed = cv2.dilate(walls, np.ones((9, 9), np.uint8))
    ff = (1 - closed).astype(np.uint8) * 255
    pad = cv2.copyMakeBorder(ff, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=255)
    mask = np.zeros((pad.shape[0] + 2, pad.shape[1] + 2), np.uint8)
    cv2.floodFill(pad, mask, (0, 0), 128)
    foot = (pad[1:-1, 1:-1] != 128)  # everything not reachable from outside
    return walls.astype(np.float32), foot.astype(np.float32)


def scaled_template(W, F, w, h):
    """Plan walls scaled to w x h, as a match template: +1 on walls, a matching
    negative weight spread over room interiors (so walls landing inside rooms cost)."""
    wt = cv2.resize(W, (w, h), interpolation=cv2.INTER_AREA)
    wt = cv2.GaussianBlur((wt > 0.15).astype(np.float32), (0, 0), 1.2)
    ft = cv2.resize(F, (w, h), interpolation=cv2.INTER_AREA) > 0.5
    interior = ft & (cv2.dilate(wt, np.ones((5, 5), np.uint8)) < 0.05)
    return wt, interior
