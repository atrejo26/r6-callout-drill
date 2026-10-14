"""Pull floor plans and callout labels out of the call-sheet deck.

Usage: python3 -I tools/extract.py <deck.pptx> <deck.pdf> src/

<deck.pdf> is the deck rendered by LibreOffice
(`soffice --headless --convert-to pdf deck.pptx`). Label positions come from
where each label's text is actually drawn there: the deck's text boxes are
left-aligned and top-anchored, and often much larger than their text, so the
centre of the box can sit well away from the word itself.

Writes src/maps/<map>_<floor>.webp and src/callouts.json. Each label is stored
as a position normalized to its (cropped, trimmed) floor image, so the app can
place markers at any display size.
"""
import io, json, math, os, re, sys
import pdfplumber
from pptx import Presentation
from PIL import Image, ImageOps

EMU_PER_PT = 12700

A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'

# slide number -> (map id, display name, floor name for each picture in z-order)
MAPS = {
    3:  ('border',     'Border',          ['1F', '2F']),
    4:  ('chalet',     'Chalet',          ['Basement', '1F', '2F']),
    5:  ('clubhouse',  'Clubhouse',       ['Basement', '1F', '2F']),
    6:  ('villa',      'Villa',           ['1F', 'Basement', '2F']),
    7:  ('nighthaven', 'Nighthaven Labs', ['Basement', '1F', '2F']),
    8:  ('fortress',   'Fortress',        ['2F', '1F']),
    9:  ('bank',       'Bank',            ['Basement', '1F', '2F']),
    10: ('kafe',       'Kafe Dostoyevsky', ['1F', '2F', '3F']),
    11: ('lair',       'Lair',            ['2F', '1F', 'Basement']),
}
FLOOR_ORDER = ['Basement', '1F', '2F', '3F']

# Display fixes for typos / formatting in the deck; aliases are extra accepted answers.
FIXES = {
    # Border 1F bathroom stalls: the sheet labels them 1/2/3 inside "Stalls".
    '1': ('Stall 1', ['1']),
    '2': ('Stall 2', ['2']),
    '3': ('Stall 3', ['3']),
    'Dinning': ('Dining', []),
    'BottomSqr': ('Bottom Sqr', []),
    'DMZ(DeadManZone)': ('DMZ', ['Dead Man Zone']),
    'BLUE HALL': ('Blue Hall', []),
    'Tellers  hall': ('Tellers Hall', []),
    'Detention or Jail': ('Detention', ['Jail']),
    'boost': ('Boost', []),
}


def walk(shapes, xf):
    """Yield (shape, slide-space rect), resolving nested group transforms."""
    for sh in shapes:
        if sh.shape_type == 6:
            x = sh._element.grpSpPr.find(A + 'xfrm')
            off, ext, coff, cext = (x.find(A + n) for n in ('off', 'ext', 'chOff', 'chExt'))
            ox, oy = int(off.get('x')), int(off.get('y'))
            gsx = int(ext.get('cx')) / (int(cext.get('cx')) or 1)
            gsy = int(ext.get('cy')) / (int(cext.get('cy')) or 1)
            cx, cy = int(coff.get('x')), int(coff.get('y'))
            sx, sy, tx, ty = xf
            yield from walk(sh.shapes, (sx * gsx, sy * gsy, tx + sx * (ox - cx * gsx), ty + sy * (oy - cy * gsy)))
        elif sh.left is not None:
            sx, sy, tx, ty = xf
            yield sh, (tx + sx * sh.left, ty + sy * sh.top, sx * sh.width, sy * sh.height)


def label_info(sh):
    paras, size, bold, color = [], 0, False, None
    for para in sh.text_frame.paragraphs:
        t = ''.join(r.text for r in para.runs).strip()
        if t:
            paras.append(t)
        for r in para.runs:
            if r.font.size:
                size = max(size, r.font.size.pt)
            bold = bold or bool(r.font.bold)
            try:
                if r.font.color and r.font.color.type is not None:
                    color = str(r.font.color.rgb)
            except (AttributeError, KeyError):
                pass
    return ' '.join(paras), size, bold, color


def rendered_center(chars, rect, rot, text):
    """Centre of the drawn glyphs of one text box, in EMU; None if not found.

    `chars` are the slide's non-blank pdfplumber chars in drawing order. The box's
    text appears there as one consecutive run, so look for that exact run and,
    if it occurs more than once ("Boost" on Border 1F), take the one inside the
    (possibly rotated) box. A wrapped label can spill below its top-anchored box,
    so the box is searched a line further down.
    """
    x, y, w, h = (v / EMU_PER_PT for v in rect)
    cx, cy, a = x + w / 2, y + h / 2, math.radians(rot)

    def local(ch):  # char centre in the box's own, unrotated frame
        mx, my = (ch['x0'] + ch['x1']) / 2 - cx, (ch['top'] + ch['bottom']) / 2 - cy
        return mx * math.cos(a) + my * math.sin(a), -mx * math.sin(a) + my * math.cos(a)

    def inside(ch):
        lx, ly = local(ch)
        return abs(lx) <= w / 2 + 1 and -h / 2 - 1 <= ly <= h / 2 + 10

    target = text.replace(' ', '')
    n = len(target)
    runs = [chars[i:i + n] for i in range(len(chars) - n + 1)
            if ''.join(c['text'] for c in chars[i:i + n]) == target]
    runs = [r for r in runs if sum(inside(c) for c in r) >= max(1, n // 2)]
    if not runs:
        return None
    run = max(runs, key=lambda r: sum(inside(c) for c in r))
    x0 = min(c['x0'] for c in run); x1 = max(c['x1'] for c in run)
    y0 = min(c['top'] for c in run); y1 = max(c['bottom'] for c in run)
    return (x0 + x1) / 2 * EMU_PER_PT, (y0 + y1) / 2 * EMU_PER_PT


def trim_box(img):
    """Bounding box of non-white content, padded, so empty margins don't shrink the plan."""
    g = ImageOps.invert(img.convert('L')).point(lambda v: 255 if v > 20 else 0)
    box = g.getbbox() or (0, 0, *img.size)
    pad = round(0.02 * max(img.size))
    return (max(0, box[0] - pad), max(0, box[1] - pad), min(img.width, box[2] + pad), min(img.height, box[3] + pad))


def main(deck, deck_pdf, outdir):
    os.makedirs(os.path.join(outdir, 'maps'), exist_ok=True)
    prs = Presentation(deck)
    pdf = pdfplumber.open(deck_pdf)
    maps = []
    for num, (mid, name, floor_names) in MAPS.items():
        pics, texts = [], []
        chars = [c for c in pdf.pages[num - 1].chars if c['text'].strip()]
        for z, (sh, rect) in enumerate(walk(prs.slides[num - 1].shapes, (1, 1, 0, 0))):
            if sh.shape_type == 13:
                pics.append((z, sh, rect))
            elif sh.has_text_frame and sh.text_frame.text.strip():
                text, size, bold, color = label_info(sh)
                # Skip slide titles and floor headings (black text, not red callouts).
                if color != 'FF0000':
                    continue
                at = rendered_center(chars, rect, sh.rotation, re.sub(r'\s+', ' ', text).strip())
                if at is None:
                    print(f'  {mid}: no rendered text found for {text!r}; using its box centre')
                    at = (rect[0] + rect[2] / 2, rect[1] + rect[3] / 2)
                texts.append((text, at, sh.rotation, bold))
        assert len(pics) == len(floor_names), (mid, len(pics))
        floors = []
        for (z, sh, rect), fname in zip(pics, floor_names):
            img = Image.open(io.BytesIO(sh.image.blob)).convert('RGB')
            W, H = img.size
            img = img.crop((round(sh.crop_left * W), round(sh.crop_top * H),
                            round(W - sh.crop_right * W), round(H - sh.crop_bottom * H)))
            floors.append(dict(name=fname, z=z, rect=rect, img=img, labels=[]))
        for text, (cx, cy), rot, bold in texts:
            hits = [f for f in floors if f['rect'][0] <= cx <= f['rect'][0] + f['rect'][2]
                    and f['rect'][1] <= cy <= f['rect'][1] + f['rect'][3]]
            if not hits:
                continue
            f = max(hits, key=lambda f: f['z'])  # topmost picture wins where plans overlap
            fx, fy, fw, fh = f['rect']
            text = re.sub(r'\s+', ' ', text).strip()
            disp, aliases = FIXES.get(text, (text, []))
            # Less specific answers that still count, e.g. "Stalls" for "Stall 1".
            broad = ['Stalls'] if mid == 'border' and text in ('1', '2', '3') else []
            short = text if broad else None
            disp = disp[:1].upper() + disp[1:]
            f['labels'].append(dict(name=disp, aliases=aliases, room=bold and not broad, rot=round(rot),
                                    **({'broad': broad, 'short': short} if broad else {}),
                                    u=(cx - fx) / fw, v=(cy - fy) / fh))
        out_floors = []
        for f in sorted(floors, key=lambda f: FLOOR_ORDER.index(f['name'])):
            img = f['img']
            l, t, r, b = trim_box(img)
            W, H = img.size
            img = img.crop((l, t, r, b))
            labels = []
            for lab in f['labels']:
                u = (lab.pop('u') * W - l) / (r - l)
                v = (lab.pop('v') * H - t) / (b - t)
                labels.append(dict(lab, x=round(u, 4), y=round(v, 4)))
            fn = f"{mid}_{f['name'].lower()}.webp"
            img.save(os.path.join(outdir, 'maps', fn), 'WEBP', quality=82, method=6)
            out_floors.append(dict(name=f['name'], image=f'maps/{fn}', w=img.width, h=img.height, callouts=labels))
            print(f"{mid:11s} {f['name']:8s} {img.width}x{img.height} {len(labels)} callouts")
        maps.append(dict(id=mid, name=name, floors=out_floors))
    with open(os.path.join(outdir, 'callouts.json'), 'w') as fh:
        json.dump(dict(source='Paltry\'s R6 Map Call Sheets', maps=maps), fh, indent=1)


if __name__ == '__main__':
    main(*sys.argv[1:4])
