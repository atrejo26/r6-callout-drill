"""Apply the callout area editor's saved floors to src/callouts.json.

Usage: python3 -I tools/apply_areas.py <dir of floor JSON files> src/callouts.json

Each <map>.<floor>.json is the editor's saved document for that floor (its
callouts in order, with id, name, aliases, room, x/y/gx/gy, and the outlines
"whole" for the Main rooms pool and "area" for the other pools, in call-sheet
coordinates). Callouts keep the fields the editor doesn't know about (short,
broad) unless they were renamed. Outlines become:
  room_zone  the whole room, main rooms only (Main rooms pool); a main room
             with no whole-room outline uses its own area
  zone       the callout's own area (every other pool)
each a list of rings read with the even-odd rule, so a room can have holes
where its spots are. Overlaps between outlines in the same pass are removed:
an outline mostly inside another one keeps its shape and is cut out of the
bigger one (spots inside a room), otherwise the overlap is split along the
line halfway between the two dots. A dot left outside its own zone moves into
it, so a tap on the label counts. Each floor also gets "fit", the linear map
from call-sheet to in-game coordinates (gx = ax*x + bx, gy = ay*y + by) the
editor used, so the app can test in-game taps against the zones. Running it
again on its own output changes nothing.
"""
import json, os, re, sys
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, Point
from shapely.ops import nearest_points, polylabel, unary_union
from shapely.validation import make_valid

floors_dir, path = sys.argv[1], sys.argv[2]
data = json.load(open(path))
NESTED = 0.8      # an outline this much inside another one counts as inside it
MIN_AREA = 40     # drop leftover slivers smaller than this (call-sheet pixels squared)


def polygonal(g):
    """The polygon parts of a geometry, as one (Multi)Polygon."""
    if isinstance(g, (Polygon, MultiPolygon)):
        return g
    return unary_union([p for p in getattr(g, 'geoms', []) if isinstance(p, (Polygon, MultiPolygon))])


def shape(ring, w, h):
    p = Polygon([(x * w, y * h) for x, y in ring])
    return polygonal(p if p.is_valid else make_valid(p))


def half_plane(a, b, size):
    """The side of the perpendicular bisector of a-b that holds b, clipped to a big box."""
    a, b = np.array(a), np.array(b)
    if not np.any(b - a):   # same spot: no line to split on; the overlap goes to the first
        return Polygon()
    mid, n = (a + b) / 2, (b - a) / np.linalg.norm(b - a)
    t = np.array([-n[1], n[0]])
    L = size * 4
    return Polygon([mid + t * L, mid + t * L + n * L, mid - t * L + n * L, mid - t * L])


def resolve(items, size, log):
    """items: [(callout, shape, dot)]. Returns shapes with overlaps removed."""
    cut = [[] for _ in items]
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            (a, pa, da), (b, pb, db) = items[i], items[j]
            inter = pa.intersection(pb)
            if inter.area < 1:
                continue
            small = min(pa.area, pb.area)
            if inter.area >= NESTED * small:
                if pa.area <= pb.area:
                    cut[j].append(pa)
                else:
                    cut[i].append(pb)
                kind = 'inside'
            else:
                cut[i].append(inter.intersection(half_plane(da, db, size)))
                cut[j].append(inter.intersection(half_plane(db, da, size)))
                kind = 'split'
            log.append(f"{kind} {a['name']} / {b['name']} ({inter.area:.0f}px2)")
    out = [polygonal(p.difference(unary_union(cs))) if cs else p for (_, p, _), cs in zip(items, cut)]
    # Anything still shared (three-way corners) goes to whichever comes first.
    taken = Polygon()
    for k, p in enumerate(out):
        out[k] = polygonal(p.difference(taken))
        taken = taken.union(out[k])
    return out


def rings(g, w, h):
    parts = [g] if isinstance(g, Polygon) else list(g.geoms)
    rs = []
    for p in parts:
        if p.area < MIN_AREA:
            continue
        p = p.simplify(0.05)
        for r in [p.exterior, *p.interiors]:
            pts = [[round(x / w, 4), round(y / h, 4)] for x, y in list(r.coords)[:-1]]
            if len(pts) >= 3:
                rs.append(pts)
    return rs or None


report = []
for m in data['maps']:
    for f in m['floors']:
        name = f"{m['id']}.{f['name']}"
        saved = json.load(open(os.path.join(floors_dir, name + '.json')))['callouts']
        old = f['callouts']
        w, h = f['w'], f['h']
        if 'fit' not in f:      # the editor's fit; kept once set, so re-running changes nothing
            cs = np.array([[c['x'], c['y'], c['gx'], c['gy']] for c in old])
            f['fit'] = [round(v, 6) for v in (*np.polyfit(cs[:, 0], cs[:, 2], 1), *np.polyfit(cs[:, 1], cs[:, 3], 1))]
        ax, bx, ay, by = f['fit']
        by_name = {c['name']: c for c in old}
        log = []
        new = []
        for s in saved:
            nm = s['name'].strip()
            extra = {k: v for k, v in by_name.get(nm, {}).items() if k in ('short', 'broad')}
            new.append({'name': nm, 'aliases': s['aliases'], 'room': s['room'], 'rot': s.get('rot', 0),
                        'x': s['x'], 'y': s['y'], 'gx': s['gx'], 'gy': s['gy'], **extra,
                        '_whole': (s.get('whole') or s.get('area')) if s['room'] else None, '_area': s.get('area')})
            if s['room'] and not s.get('whole') and s.get('area'):
                log.append(f"{nm} has no whole-room outline: its own area stands in")
        for field, key in (('_whole', 'room_zone'), ('_area', 'zone')):
            items = [(c, shape(c[field], w, h)) for c in new if c[field]]
            items = [(c, p, (c['x'] * w, c['y'] * h)) for c, p in items]
            for c, g in zip([c for c, _, _ in items], resolve(items, max(w, h), log)):
                c[key] = rings(g, w, h)
        for c in new:
            for key in ('zone', 'room_zone'):
                z = c.get(key)
                if not z:
                    continue
                g = Polygon()
                for r in z:     # even-odd, as the app reads them
                    g = g.symmetric_difference(Polygon([(x * w, y * h) for x, y in r]).buffer(0))
                dot = Point(c['x'] * w, c['y'] * h)
                if g.contains(dot):
                    continue
                if key == 'zone':
                    # A tap on the label should count: a dot just outside its zone steps
                    # a few pixels in, one further away moves to the middle of the zone.
                    pt = None
                    if g.distance(dot) <= 15:
                        near = nearest_points(g.boundary, dot)[0]
                        step = np.array([near.x - dot.x, near.y - dot.y])
                        step = step / (np.linalg.norm(step) or 1) * 3
                        pt = Point(near.x + step[0], near.y + step[1])
                        pt = pt if g.contains(pt) else None
                    if pt is None:
                        pt = polylabel(max(getattr(g, 'geoms', [g]), key=lambda q: q.area), 0.5)
                    c['x'], c['y'] = round(pt.x / w, 4), round(pt.y / h, 4)
                    c['gx'], c['gy'] = round(ax * c['x'] + bx, 4), round(ay * c['y'] + by, 4)
                    log.append(f"moved {c['name']}'s dot {dot.distance(pt):.0f}px into its zone")
                else:
                    log.append(f"dot outside its {key}: {c['name']}")
            del c['_whole'], c['_area']
        f['callouts'] = new
        report.append((name, log))

# One line per ring: written out point by point, the zones would be most of the file.
text = json.dumps(data, indent=1)
text = re.sub(r'\[\s+(-?[\d.e-]+),\s+(-?[\d.e-]+)\s+\]', r'[\1, \2]', text)
text = re.sub(r'\[\s+(\[-?[\d.e-]+, -?[\d.e-]+\](?:,\s+\[-?[\d.e-]+, -?[\d.e-]+\])*)\s+\]',
              lambda mo: '[' + re.sub(r',\s+', ', ', mo.group(1)) + ']', text)
open(path, 'w').write(text + '\n')
for name, log in report:
    if log:
        print(f'== {name}')
        for line in log:
            print('  ', line)
