"""Download R6Calls floor maps and render one image per floor for the app.

Usage: python3 tools/r6calls.py <work-dir>

Downloads each map's SVG from www.r6calls.com (once; delete <work-dir>/svg to
refresh), renders every floor the way the site shows it with "Label" and
"Line of sight wall" switched off (Secure and Hostage are off by default there),
and writes <work-dir>/floors/<map>/floor-<floor>.png, cropped to the building
with the same box for every floor of a map. Then:

    python3 tools/align.py      <work-dir>/floors src
    python3 tools/game_views.py <work-dir>/floors src
    python3 tools/build.py

Rendering needs Node with Playwright (tools/r6calls_render.js).
The floor art is R6Calls' (https://www.r6calls.com), built on Ubisoft's maps.
"""
import base64, io, json, os, re, struct, subprocess, sys, time, urllib.request
from lxml import etree
from PIL import Image

XL = '{http://www.w3.org/1999/xlink}href'
# R6Calls map id -> (our map's folder name, our floors)
MAPS = {
    'bank': ('bank', ['Basement', '1F', '2F']),
    'border': ('border', ['1F', '2F']),
    'chalet': ('chalet', ['Basement', '1F', '2F']),
    'club': ('clubhouse', ['Basement', '1F', '2F']),
    'villa': ('villa', ['Basement', '1F', '2F']),
    'labs': ('nighthavenlabs', ['Basement', '1F', '2F']),
    'fortress': ('fortress', ['1F', '2F']),
    'kafe': ('kafe', ['1F', '2F', '3F']),
    'lair': ('lair', ['Basement', '1F', '2F']),
}
FLOOR_NUMBER = {'Basement': 0, '1F': 1, '2F': 2, '3F': 3}  # R6Calls' "Floor N" groups


def floor_pics(root):
    """{floor number: (image element, its group's translate)}"""
    out = {}
    for g in root.iter('{http://www.w3.org/2000/svg}g'):
        m = re.fullmatch(r'Floor (-?\d+)', g.get('id') or '')
        if m:
            n = int(m[1])
            t = [float(v) for v in re.findall(r'-?[\d.]+', g.get('transform') or '')[:2]] or [0, 0]
            out[n] = (g.find(f".//*[@id='{n}-pic']"), t)
    return out


def png(el, head_only=False):
    data = (el.get(XL) or el.get('href')).split(',', 1)[1]
    raw = base64.b64decode(data[:64] if head_only else data)
    return struct.unpack('>II', raw[16:24]) if head_only else Image.open(io.BytesIO(raw))


def main(work):
    svg_dir, shot_dir, out_dir = (os.path.join(work, d) for d in ('svg', 'renders', 'floors'))
    os.makedirs(svg_dir, exist_ok=True)
    plan, roots = {}, {}
    for mid, (folder, floors) in MAPS.items():
        path = os.path.join(svg_dir, mid + '.svg')
        if not os.path.exists(path):
            print('downloading', mid, flush=True)
            urllib.request.urlretrieve(f'https://www.r6calls.com/img/maps/{mid}.svg', path)
            time.sleep(1)  # go easy on their server
        root = roots[mid] = etree.parse(path, etree.XMLParser(huge_tree=True)).getroot()
        vb = [float(v) for v in root.get('viewBox').split()]
        pics = floor_pics(root)
        # render at the floor art's own pixel density, so nothing is resampled
        ppu = max(png(pics[FLOOR_NUMBER[f]][0], True)[0] / float(pics[FLOOR_NUMBER[f]][0].get('width')) for f in floors)
        plan[mid] = dict(out=folder, floors={f.lower(): FLOOR_NUMBER[f] for f in floors},
                         size=[round(vb[2] * ppu), round(vb[3] * ppu)])
    plan_path = os.path.join(work, 'render_plan.json')
    json.dump(plan, open(plan_path, 'w'), indent=1)
    subprocess.run(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'r6calls_render.js'),
                    plan_path, svg_dir, shot_dir], check=True)

    for mid, p in plan.items():
        root = roots[mid]
        vb = [float(v) for v in root.get('viewBox').split()]
        k = p['size'][0] / vb[2]
        pics = floor_pics(root)
        boxes = []
        for n in p['floors'].values():
            el, (tx, ty) = pics[n]
            im = png(el)
            bb = im.getchannel('A').getbbox() if im.mode == 'RGBA' else (0, 0) + im.size
            x, y, w, h = (float(el.get(a) or 0) for a in ('x', 'y', 'width', 'height'))
            sx, sy = w / im.size[0], h / im.size[1]
            boxes.append([(tx + x + bb[0] * sx - vb[0]) * k, (ty + y + bb[1] * sy - vb[1]) * k,
                          (tx + x + bb[2] * sx - vb[0]) * k, (ty + y + bb[3] * sy - vb[1]) * k])
        x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
        x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
        m = 0.08 * max(x1 - x0, y1 - y0)
        W, H = p['size']
        box = (max(0, int(x0 - m)), max(0, int(y0 - m)), min(W, int(x1 + m)), min(H, int(y1 + m)))
        os.makedirs(os.path.join(out_dir, p['out']), exist_ok=True)
        for name in p['floors']:
            Image.open(os.path.join(shot_dir, p['out'], f'floor-{name}.png')).convert('RGB').crop(box) \
                .save(os.path.join(out_dir, p['out'], f'floor-{name}.png'))
        print(f"{mid:9s} floors cropped to {box[2] - box[0]}x{box[3] - box[1]}")


if __name__ == '__main__':
    main(sys.argv[1])
