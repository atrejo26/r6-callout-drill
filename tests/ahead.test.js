// The next questions are planned ahead: after each one comes up, the next few are drawn and
// their floor pictures decoded, so Next shows a ready floor at once. The plan follows the
// map, floor and pool chosen, and the view.
const { run, open, until, check, TEST_PAGE } = require('./lib');

run(async browser => {
  const page = await open(browser, TEST_PAGE);
  const is = (fn, arg) => page.evaluate(fn, arg);
  const planned = () => until(page, () => drill.picker.queue.length === Picker.AHEAD && drill.picker.queue.every(c => plate.ready(c.floor)));

  check('three questions planned, their floors decoded', await planned(), JSON.stringify(await is(() => drill.picker.queue.map(c => c.name))));
  const plan = await is(() => { const keys = drill.picker.queue.map(c => c.key); return { size: drill.picker.pool().length, keys, now: drill.q.c.key }; });
  check(`all different, and not the one asked now (pool of ${plan.size})`, plan.size > 6 && new Set(plan.keys).size === 3 && !plan.keys.includes(plan.now), JSON.stringify(plan));

  // All maps, so that floors change from question to question.
  await page.click('#mapChips button:nth-child(1)');
  const rounds = [];
  for (let i = 0; i < 8; i++) {
    await planned();
    await page.click('#skipBtn');
    rounds.push(await is(() => {
      const want = drill.picker.queue[0];
      document.getElementById('goBtn').click();
      const img = document.getElementById('planImg');
      return { asked: drill.q.c === want, ready: img.complete && img.naturalWidth > 0 && img.getAttribute('src') === plate.look(want.floor).image, floor: `${want.map.id} ${want.floor.name}` };
    }));
  }
  check('Next asks the first planned question, its floor already shown', rounds.every(r => r.asked && r.ready), JSON.stringify(rounds));
  check('...on several floors', new Set(rounds.map(r => r.floor)).size > 2, JSON.stringify(rounds.map(r => r.floor)));
  check('only a few floor pictures kept', await is(() => plate.imgs.size <= Plate.KEEP && document.querySelectorAll('#plate img').length === 1), await is(() => plate.imgs.size));

  await page.click('#mapChips button:nth-child(4)');   // Clubhouse
  check('a map picked: the plan is drawn again from it', await planned() && await is(() => drill.q.c.map.id === 'clubhouse' && drill.picker.queue.every(c => c.map.id === 'clubhouse')),
    JSON.stringify(await is(() => drill.picker.queue.map(c => c.map.id))));
  await page.click('#floorTabs button:nth-child(2)');
  check('a floor picked: the plan keeps to it', await planned() && await is(() => drill.picker.queue.every(c => c.floor === drill.q.c.floor && c.floor.name === settings.floor)));

  await page.click('#viewBtn');
  check('the view changed: the plan\'s floors are decoded in it', await planned() && await is(() => settings.view === 'plan'));
  await page.click('#viewBtn');

  // My misses: one missed callout, then learned again, leaves the plan.
  await is(() => drill.erase());
  await page.click('[data-pool=misses]');
  check('no misses: nothing to ask, nothing planned', await is(() => !drill.q && drill.picker.queue.length === 0 && /no misses/.test(document.getElementById('qCard').textContent)));
  await page.click('[data-pool=rooms]');
  await page.click('#skipBtn');
  const missed = await is(() => drill.q.c.key);
  await page.click('[data-pool=misses]');
  check('one miss: it is asked, and planned again after', await planned() && await is(k => drill.q.c.key === k && drill.picker.queue.every(c => c.key === k), missed));
  await is(k => { const c = ALL.find(c => c.key === k); for (let i = 0; i < 4; i++) progress.record(c, 'exact', false); }, missed);
  check('learned again: it leaves the plan', await is(() => drill.picker.plan().length === 0 && drill.picker.next() === null));
});
