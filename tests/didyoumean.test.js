// Did you mean: what it offers, picking an offer, Enter again or Keep for what was typed,
// fixing the answer instead, and clear typos and the start of a name that just count.
const { isDeepStrictEqual } = require('util');
const { run, open, check, shot, TEST_PAGE } = require('./lib');

run(async browser => {
  const page = await open(browser, TEST_PAGE);
  const ask = (m, f, n) => page.evaluate(([m, f, n]) => {
    S.answer = 'type'; applyAnswer();
    q = { c: ALL.find(c => c.map.id === m && c.floor.name === f && c.name === n), done: false, hinted: false }; paintQuestion(); renderName();
  }, [m, f, n]);
  const type = async v => { await page.fill('#guess', v); await page.press('#guess', 'Enter'); };
  const state = () => page.evaluate(() => ({ fb: $('fb').textContent.trim(), done: q.done, answers: session.n,
    offered: [...document.querySelectorAll('.suggest .chip')].map(b => b.textContent) }));
  let s;

  await ask('chalet', '1F', 'Long'); await type('logg');
  s = await state();
  check('logg: asks Long or Log', !s.done && s.answers === 0 && s.fb.startsWith('Did you mean') && isDeepStrictEqual(s.offered, ['Long45', 'Log', 'Keep “logg”']), JSON.stringify(s));
  await shot(page, 'didyoumean');
  await page.click('.suggest .chip >> text=Long');
  s = await state();
  check('picking Long: right, and it fills the box', s.done && s.answers === 1 && s.fb === 'Correct.Long is the long side of 45.' && await page.inputValue('#guess') === 'Long', JSON.stringify(s));

  await ask('chalet', '1F', 'Log'); await type('logg'); await page.press('#guess', 'Enter');
  s = await state();
  check('logg, Enter again: counted as typed, wrong', s.done && s.answers === 2 && s.fb === "Not quite. It's Log.", JSON.stringify(s));
  await ask('chalet', '1F', 'Log'); await type('logg'); await type('log');
  s = await state();
  check('logg, fixed to log: right', s.done && s.answers === 3 && s.fb === 'Correct.', JSON.stringify(s));
  await ask('chalet', '1F', 'Log'); await type('logg'); await page.click('.suggest .chip.ghost');
  s = await state();
  check('logg, Keep: counted as typed, wrong', s.done && s.answers === 4 && s.fb === "Not quite. It's Log.", JSON.stringify(s));

  await ask('border', '1F', 'Detention'); await type('detnetion');
  s = await state();
  check('detnetion: a clear typo counts', s.done && s.answers === 5 && s.fb === 'Correct: DetentionAlso called Jail', JSON.stringify(s));
  await ask('border', '1F', 'Detention'); await type('det');
  s = await state();
  check('det: the start of the name counts', s.done && s.answers === 6 && s.fb === 'Correct: DetentionAlso called Jail', JSON.stringify(s));
  await ask('border', '1F', 'Stall 2'); await type('stall');
  s = await state();
  check('stall for Stall 2: accepted, names the spot', s.done && s.answers === 7 && s.fb === 'Accepted. More specific: Stall 2.', JSON.stringify(s));
  await ask('kafe', '3F', 'Shaiiko'); await type('shiko');
  s = await state();
  check('shiko: one typo too many, asks Shaiiko', !s.done && s.answers === 7 && isDeepStrictEqual(s.offered, ['Shaiiko', 'Keep “shiko”']), JSON.stringify(s));

  await page.setViewportSize({ width: 400, height: 860 });
  await ask('villa', '1F', 'Piano'); await type('pian');
  s = await state();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('phone: pian offers the three Pianos, nothing sticks out', !s.done && isDeepStrictEqual(s.offered, ['Piano', 'Piano H short', 'Piano H long', 'Keep “pian”']) && wide <= 0, JSON.stringify(s) + ' overflow ' + wide);
  await page.locator('#fb').scrollIntoViewIfNeeded(); await shot(page, 'didyoumean_phone');
});
