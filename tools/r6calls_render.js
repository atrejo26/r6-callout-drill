// Render R6Calls map SVGs one floor at a time, the way the site shows them with
// "Label" and "Line of sight wall" switched off (Secure and Hostage are off by default).
// Usage: node tools/r6calls_render.js <render_plan.json> <svg-dir> <out-dir> [map ids...]
// (run by tools/r6calls.py)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const [planPath, svgDir, outDir, ...only] = process.argv.slice(2);
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const browser = await chromium.launch();
  for (const [id, p] of Object.entries(plan)) {
    if (only.length && !only.includes(id)) continue;
    const [W, H] = p.size;
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.goto('file://' + path.resolve(svgDir, id + '.svg'), { waitUntil: 'load', timeout: 300000 });
    await page.evaluate(([W, H]) => {
      const svg = document.documentElement;
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      svg.style.display = 'block';
    }, [W, H]);
    fs.mkdirSync(path.join(outDir, p.out), { recursive: true });
    for (const [name, n] of Object.entries(p.floors)) {
      const hidden = await page.evaluate((n) => {
        const svg = document.documentElement;
        for (const g of svg.querySelectorAll('g[id^="Floor "]')) g.style.display = g.id === `Floor ${n}` ? 'inline' : 'none';
        const off = [];
        for (const layer of ['txt', 'losw', 'sec', 'hst']) {
          for (const g of svg.querySelectorAll(`g[id="${n}-${layer}"]`)) { g.style.display = 'none'; off.push(g.id); }
        }
        return off;
      }, n);
      // let embedded images decode before capturing
      await page.waitForTimeout(1500);
      const out = path.join(outDir, p.out, `floor-${name}.png`);
      await page.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H }, timeout: 300000 });
      console.log(`${id} floor ${n} -> ${out}  (${W}x${H}, hid ${hidden.join(', ') || 'nothing'})`);
    }
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
