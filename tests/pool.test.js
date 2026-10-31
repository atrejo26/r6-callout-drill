// Answering from the callout pool: right, broad and wrong picks, the hint, reveal, the
// choice being remembered, and every callout counting for its own chip and no other.
const { isDeepStrictEqual } = require('util');
const { run, open, ready, settle, check, shot, TEST_PAGE } = require('./lib');

// Callouts on different floors whose names say the same words (½ W is Half wall, Red S is
// Red Stairs): either chip counts for both.
const SAME_WORDS = ['chalet:Half wall -> ½ W|Half wall', 'chalet:½ W -> ½ W|Half wall', 'villa:Red Stairs -> Red S|Red Stairs', 'villa:Red S -> Red S|Red Stairs'];

run(async browser => {
  const page = await open(browser, TEST_PAGE);
  const text = async sel => (await page.textContent(sel)).trim();
  const ask = name => page.evaluate(n => { q = { c: ALL.find(c => c.name === n && c.map.id === 'border'), done: false, hinted: false }; paintQuestion(); renderName(); }, name);

  check('the answer row shows in Name it', await page.isVisible('#answerRow'));
  await page.click('[data-answer=pool]');
  const chips = await page.$$eval('#bank button', bs => bs.length), names = await page.evaluate(() => poolFor(q.c.map).length);
  check('a chip for every callout name on the map', chips > 20 && chips === names, `${chips} chips, ${names} names`);

  await ask('Stall 1');
  await page.click('#bank button[data-key="stall1"]');
  check('right chip', await text('#fb') === 'Correct.' && await text('#bank .good') === 'Stall 1' && await page.isVisible('#goBtn'), await text('#fb'));
  await shot(page, 'pool_right');
  await ask('Stall 1');
  await page.click('#bank button[data-key="stalls"]');
  check('broad chip: accepted, names the spot', await text('#fb') === 'Accepted. More specific: Stall 1.' && await text('#bank .near') === 'Stalls', await text('#fb'));
  await ask('Stall 1');
  await page.click('#bank button[data-key="stall2"]');
  const dots = await page.$$eval('.marker.small.bad', m => m.length);
  check('wrong chip: marked, and shown on the map', await text('#fb') === "Not quite. It's Stall 1. Stall 2 is the red dot." && await text('#bank .bad') === 'Stall 2' && dots === 1, `${await text('#fb')} | ${dots} red dots`);
  await shot(page, 'pool_wrong');

  await ask('Tellers hall');
  await page.click('#hintBtn');
  const lit = await page.$$eval('#bank button:not(.dim)', bs => bs.map(b => b.textContent));
  check('hint: first letter and length, the rest dimmed', await text('#fb') === 'Starts with “T”, 11 characters' && lit.includes('Tellers hall') && lit.every(n => n.startsWith('T')), `${await text('#fb')} | ${lit}`);
  await page.click('#skipBtn');
  check('reveal', await text('#fb') === "It's Tellers hall.", await text('#fb'));
  await page.keyboard.press('Enter');
  check('Enter goes on to the next question', await page.evaluate(() => !q.done));

  const odd = await page.evaluate(() => {
    const out = [];
    for (const c of ALL) {
      const hits = poolFor(c.map).filter(o => { const k = compact(o.name); return forms(c).some(([t]) => t === k) || (c.broad || []).some(t => compact(t) === k); });
      if (!hits.some(o => compact(o.name) === compact(c.name)) || hits.length > 1 + (c.broad || []).length) out.push(c.map.id + ':' + c.name + ' -> ' + hits.map(o => o.name).join('|'));
    }
    return out;
  });
  check('every callout counts for its own chip and no other', isDeepStrictEqual(odd.sort(), [...SAME_WORDS].sort()), JSON.stringify(odd));

  await page.reload(); await ready(page);
  check('the pool choice is remembered', await page.isVisible('#bank'));
  await page.click('[data-answer=type]');
  await ask('Stall 1');
  await page.fill('#guess', 'stall 1'); await page.press('#guess', 'Enter');
  check('back to typing', await text('#fb') === 'Correct.' && !(await page.$('#bank')), await text('#fb'));
  await page.click('[data-mode=pick]');
  check('no answer row in Pick it', !(await page.isVisible('#answerRow')));
  await page.click('[data-mode=name]'); await page.click('[data-answer=pool]');
  await page.setViewportSize({ width: 400, height: 860 }); await settle(page);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('phone: nothing sticks out', wide <= 0, wide);
  await shot(page, 'pool_phone', { fullPage: true });
});
