// The shipped page: works under its Content Security Policy, keeps the app's state out of
// reach of the console, blocks injected script, puts no answer in the page before it is
// answered, makes no network requests and survives bad saved data.
const { run, open, ready, check, errors, SHIPPED, TEST_PAGE } = require('./lib');

// What the console must not reach on the shipped page (the test page has them all).
const reach = () => ({ q: typeof q, S: typeof S, DATA: typeof DATA, ALL: typeof ALL, accepts: typeof accepts, stats: typeof stats,
  session: typeof session, saved: typeof saved, finishName: typeof finishName, record: typeof record, nextQuestion: typeof nextQuestion });
const CSP_REFUSAL = /Refused to execute inline script because it violates the following Content Security Policy/;

run(async browser => {
  const control = await open(browser, TEST_PAGE);
  const there = await control.evaluate(reach);
  check('control: the test page reaches the app state', Object.values(there).every(t => t !== 'undefined'), JSON.stringify(there));
  await control.context().close();

  let refusals = 0;
  const page = await open(browser, SHIPPED, { viewport: { width: 1440, height: 900 }, allow: [CSP_REFUSAL] });
  const reqs = [];
  page.on('console', m => { if (CSP_REFUSAL.test(m.text())) refusals++; });
  page.on('request', r => { if (!/^(file|data):/.test(r.url())) reqs.push(r.url()); });
  const fb = () => page.textContent('#fb');

  check('app shows a question', (await page.textContent('#qCard')).includes('marked'));
  check('fonts load from the page', await page.evaluate(() => document.fonts.check('700 20px "Barlow Condensed"')));
  check('floor image shown', await page.evaluate(() => { const i = document.getElementById('planImg'); return i.complete && i.naturalWidth > 0; }));
  const reached = await page.evaluate(reach);
  check('app state out of reach of the console', Object.values(reached).every(t => t === 'undefined'), JSON.stringify(reached));
  check('nothing on window', await page.evaluate(() => !('q' in window) && !('nextQuestion' in window)));
  check('injected inline script is blocked', await page.evaluate(() => { window.__x = 0; const s = document.createElement('script'); s.textContent = 'window.__x = 1'; document.body.append(s); return window.__x === 0; }));
  await page.waitForTimeout(100);
  check('the policy said why', refusals === 1, refusals);

  await page.fill('#guess', 'zzzz'); await page.press('#guess', 'Enter');
  check('typed answer graded', /^Not quite\. It's /.test(await fb()), await fb());
  await page.press('#guess', 'Enter');
  await page.click('[data-mode=pick]');
  await page.keyboard.press('1');
  check('pick graded', /^(Correct|That's)/.test(await fb()), await fb());
  check('log has both answers', await page.evaluate(() => document.getElementById('logList').children.length === 2));
  await page.click('[data-mode=find]');
  await page.click('#plate', { position: { x: 200, y: 200 } });
  check('find graded', /^(Correct|You tapped|That's outside)/.test(await fb()), await fb());
  await page.click('[data-mode=name]');
  check('no answer in the page before answering', await page.evaluate(() => {
    const m = document.getElementById('qMarker');
    return !m.textContent && !m.title && !m.getAttribute('aria-label') && !document.querySelector('.tag.answer');
  }));

  for (const bad of ['5', '"x"', '[]', 'not json', '{"stats":"x","prefs":[1]}',
    '{"prefs":{"mode":"<img src=x onerror=alert(1)>","pool":"]","map":"__proto__","view":7,"floor":{}},"stats":{"a":5}}',
    '{"stats":{"border|1F|o0":{"n":"2","c":-1,"last":"1"},"__proto__":{"n":1}},"update":"x","name":["<b>"]}']) {
    await page.evaluate(v => localStorage.setItem('r6-callout-drill-v1', v), bad);
    const e0 = errors.length;
    await page.reload(); await ready(page);
    check(`bad save ${bad.slice(0, 50)}`, errors.length === e0 && (await page.textContent('#qCard')).length > 10, errors.slice(e0).join(' | '));
  }
  // The last one has progress in it, so the update note is up: close it, then the report.
  check('bad save with progress: the update note shows', await page.evaluate(() => document.getElementById('updateNote').open));
  await page.keyboard.press('Escape');
  await page.click('#reportBtn');
  const hero = await page.textContent('#reportBody .hero');
  check('bad save: the report still adds up', /^\d+\/\d+callouts mastered\d+%$/.test(hero), hero);
  check('no network requests', reqs.length === 0, reqs.join(' '));
});
