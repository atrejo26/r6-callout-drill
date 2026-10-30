"""Build the callout area editor page from the repo's src/ data.

Usage: python3 -I tools/area_tool.py src tools/area_tool.html out.html
Embeds every floor's call-sheet and in-game image, the current callouts, and
a per-floor linear fit from call-sheet to in-game coordinates (areas are stored
in call-sheet coordinates and drawn on either view through it).
"""
import base64, json, sys
import numpy as np

src, tpl, out = sys.argv[1:4]
d = json.load(open(f'{src}/callouts.json'))


def uri(path):
    return 'data:image/webp;base64,' + base64.b64encode(open(f'{src}/{path}', 'rb').read()).decode()


maps = []
for m in d['maps']:
    floors = []
    for f in m['floors']:
        cs = f['callouts']
        x, y = np.array([c['x'] for c in cs]), np.array([c['y'] for c in cs])
        gx, gy = np.array([c['gx'] for c in cs]), np.array([c['gy'] for c in cs])
        ax, bx = np.polyfit(x, gx, 1)
        ay, by = np.polyfit(y, gy, 1)
        g = f.get('game')
        floors.append({
            'name': f['name'],
            'plan': {'src': uri(f['image']), 'w': f['w'], 'h': f['h']},
            'game': {'src': uri(g['image']), 'w': g['w'], 'h': g['h']} if g else None,
            'fit': [round(v, 6) for v in (ax, bx, ay, by)],
            'callouts': [{'id': f'o{i}', **c} for i, c in enumerate(cs)],
        })
    maps.append({'id': m['id'], 'name': m['name'], 'floors': floors})

data = json.dumps({'maps': maps}, separators=(',', ':')).replace('</', '<\\/')
open(out, 'w').write(open(tpl).read().replace('/*DATA*/', data))
