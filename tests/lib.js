// Shared by the tests: opening the page, waiting for it, checks, page errors, screenshots.
// The browser is TEST_BROWSER (chromium, firefox or webkit; tests/run.js sets it). Chromium
// opens the page from the file, as the desktop app does; Firefox and WebKit open it over
// HTTP from TEST_BASE, as people open the website in them.
const playwright = require('playwright'); const fs = require('fs'); const path = require('path'); const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..'); const OUT = path.join(ROOT, 'test-results');
const BROWSER = process.env.TEST_BROWSER || 'chromium';
if (!['chromium', 'firefox', 'webkit'].includes(BROWSER)) throw new Error(`TEST_BROWSER=${BROWSER}: use chromium, firefox or webkit`);
const BASE = process.env.TEST_BASE || (BROWSER === 'chromium' ? pathToFileURL(ROOT + path.sep).href : null);
if (!BASE) throw new Error(`${BROWSER} opens the page over HTTP: run it with npm test -- ${BROWSER}`);
const SHIPPED = new URL('index.html', BASE).href;                 // the app code is out of reach
const TEST_PAGE = new URL('test-results/test.html', BASE).href;   // the same page with it reachable
const SHOTS = path.join(OUT, BROWSER);
fs.mkdirSync(SHOTS, { recursive: true });
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'callouts.json'), 'utf8'));
const failed = [], errors = [];
function check(name, ok, extra = '') { if (!ok) failed.push(name); console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : String(extra)); }
const ready = page => page.waitForFunction(() => document.fonts.status === 'loaded' && [...document.images].every(i => i.complete) && document.getElementById('qCard').textContent.trim() !== '');
const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 5000 }).then(() => true, () => false);
const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
// Not every engine logs a Content Security Policy refusal to the console, so each page
// reports them itself, and they count as page errors like any other.
const VIOLATION = 'Content Security Policy violation: ';

// In WebKit, Playwright's screenshots put <style>body {}</style> in the page for a moment (to
// line up animations), and the page's policy refuses it: WebKit logs that, and the page reports
// it. Those two errors are the screenshot's, so they are taken back; anything else stays.
const SHOT_STYLE = [/^Refused to apply a stylesheet because/, new RegExp(`^${VIOLATION}style-src-elem inline$`)];
async function shot(page, name, opts = {}) {
  const from = errors.length;
  await page.screenshot({ path: path.join(SHOTS, name + '.png'), ...opts });
  if (BROWSER !== 'webkit') return;
  await settle(page);   // the page's report comes a moment after the refusal
  for (const re of SHOT_STYLE) { const i = errors.findIndex((e, j) => j >= from && re.test(e)); if (i >= 0) errors.splice(i, 1); }
}
const reportViolations = prefix => document.addEventListener('securitypolicyviolation', e => console.error(prefix + (e.effectiveDirective || e.violatedDirective) + ' ' + e.blockedURI));

// `allow`: console errors that are expected. `onConsole`: sees every console message,
// from the first one.
async function open(browser, url, { viewport = { width: 1360, height: 900 }, context = {}, init, allow = [], onConsole } = {}) {
  if (BROWSER === 'firefox') { const { isMobile, ...rest } = context; context = rest; }   // Firefox has no mobile mode: a narrow window with touch
  const page = await (await browser.newContext({ viewport, ...context })).newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { onConsole?.(m); if (m.type() === 'error' && !allow.some(re => re.test(m.text()))) errors.push(m.text()); });
  await page.addInitScript(reportViolations, VIOLATION);
  if (init) await page.addInitScript(init);
  await page.goto(url); await ready(page); return page;
}

function run(fn) {
  (async () => {
    let browser;
    try { browser = await playwright[BROWSER].launch(); await fn(browser); } catch (e) { check('runs to the end', false, e.stack || e); }
    const version = browser?.version();
    await browser?.close();
    if (errors.length) console.log('FAIL page errors:\n  ' + errors.join('\n  '));
    const bad = failed.length + errors.length;
    console.log((bad ? `${failed.length} failed, ${errors.length} page errors` : 'all pass') + ` in ${BROWSER} ${version || ''}`);
    process.exitCode = bad ? 1 : 0;
  })();
}

module.exports = { run, open, ready, until, settle, shot, check, errors, DATA, OUT, BROWSER, SHIPPED, TEST_PAGE, VIOLATION };
