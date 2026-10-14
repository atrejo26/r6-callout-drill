"""Inline the callout data, every floor image and the fonts into one offline index.html.

Abbreviations are expanded here (tools/abbrev.py), so changing them only needs this step.

Usage: python3 -I tools/build.py [bare-page-output.html]

index.html is what the desktop app loads; it has no network dependencies.
The optional second output is the same page without the <html>/<head> skeleton,
for hosts that wrap pages themselves.
"""
import base64, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import abbrev

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(here, 'src')


def data_uri(path, mime):
    with open(path, 'rb') as fh:
        return f'data:{mime};base64,' + base64.b64encode(fh.read()).decode()


data = json.load(open(os.path.join(src, 'callouts.json')))
for m in data['maps']:
    for f in m['floors']:
        for c in f['callouts']:
            abbrev.annotate(m['id'], c)
        f['image'] = data_uri(os.path.join(src, f['image']), 'image/webp')
        if 'game' in f:
            f['game']['image'] = data_uri(os.path.join(src, f['game']['image']), 'image/webp')

fonts_dir = os.path.join(src, 'fonts')
fonts_css = re.sub(r'url\(([^)]+\.woff2)\)',
                   lambda mo: 'url(' + data_uri(os.path.join(fonts_dir, mo.group(1)), 'font/woff2') + ')',
                   open(os.path.join(fonts_dir, 'fonts.css')).read())

tpl = open(os.path.join(src, 'template.html')).read()
assert '/*DATA*/null' in tpl
# Swap the Google Fonts links for the bundled copies.
tpl = re.sub(r'<link rel="(preconnect|stylesheet)" href="https://fonts\.[^>]*>\n', '', tpl)
tpl = tpl.replace('<style>\n', '<style>\n' + fonts_css, 1)
blob = json.dumps(data, separators=(',', ':')).replace('</', '<\\/')
bare = tpl.replace('/*DATA*/null', blob)

page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + bare.replace('<div class="app">', '</head>\n<body>\n<div class="app">', 1) + '\n</body>\n</html>\n')
open(os.path.join(here, 'index.html'), 'w').write(page)
print('index.html', len(page) // 1024, 'KB')
if len(sys.argv) > 1:
    open(sys.argv[1], 'w').write(bare)
