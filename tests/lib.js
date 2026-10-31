// Shared by the browser tests. tests/run.js builds the pages, then runs each
// tests/*.test.js in its own process; a test exits non-zero when a check fails, it
// throws, or the page logs an error.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'test-results');
const SHIPPED = pathToFileURL(path.join(ROOT, 'index.html')).href;    // the app code is out of reach
const TEST_PAGE = pathToFileURL(path.join(OUT, 'test.html')).href;    // the same page with it reachable
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'callouts.json'), 'utf8'));

const failed = [], errors = [];

function check(name, ok, extra = '') {
  if (!ok) failed.push(name);
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : String(extra));
}

// The app is up: a question is showing, with its floor image and the fonts loaded.
const ready = page => page.waitForFunction(() => document.fonts.status === 'loaded'
  && [...document.images].every(i => i.complete) && document.getElementById('qCard').textContent.trim() !== '');

// True once fn(arg) is truthy in the page, false if it isn't within a few seconds.
const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 5000 }).then(() => true, () => false);

// Two animation frames: whatever a resize set off (the plate is resized in one) is done.
const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(OUT, name + '.png'), ...opts });

// A new browser profile showing url. Page errors and console errors are counted as
// failures, except console errors matching one of `allow`.
async function open(browser, url, { viewport = { width: 1360, height: 900 }, context = {}, init, allow = [] } = {}) {
  const page = await (await browser.newContext({ viewport, ...context })).newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !allow.some(re => re.test(m.text()))) errors.push(m.text()); });
  if (init) await page.addInitScript(init);
  await page.goto(url);
  await ready(page);
  return page;
}

function run(fn) {
  (async () => {
    let browser;
    try {
      browser = await chromium.launch();
      await fn(browser);
    } catch (e) {
      check('runs to the end', false, e.stack || e);
    }
    await browser?.close();
    if (errors.length) console.log('FAIL page errors:\n  ' + errors.join('\n  '));
    const bad = failed.length + errors.length;
    console.log(bad ? `${failed.length} failed, ${errors.length} page errors` : 'all pass');
    process.exitCode = bad ? 1 : 0;
  })();
}

module.exports = { run, open, ready, until, settle, shot, check, errors, DATA, OUT, SHIPPED, TEST_PAGE };
