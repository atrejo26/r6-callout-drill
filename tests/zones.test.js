// Find it grades a tap by the callout's outlined area. On every floor, in both views and
// both pools: a tap on each callout's label counts, a tap on another callout's label
// (outside this one's area) doesn't, and a tap away from every area says it's outside.
const { run, open, check, shot, TEST_PAGE } = require('./lib');

run(async browser => {
  const page = await open(browser, TEST_PAGE);
  await page.click('[data-mode=find]');
  const res = await page.evaluate(() => {
    drill.file = () => ({ was: 0, mixed: null, mixedWas: 0 });   // scoring isn't under test here, and it is slow
    const out = { asked: 0, ok: 0, fail: [], wrong: 0, wrongFail: [] };
    for (const view of ['game', 'plan']) for (const pool of ['rooms', 'all']) {
      settings.view = view; settings.pool = pool;
      for (const c of ALL) {
        if (pool === 'rooms' && !c.room) continue;
        const f = c.floor;
        if (view === 'game' && !f.game) continue;
        out.asked++;
        drill.ask(c);
        drill.q.tap({ x: plate.x(c), y: plate.y(c) });
        if ($('fb').textContent === 'Correct.') out.ok++; else out.fail.push(`${view}/${pool} ${c.map.id} ${f.name} ${c.name}: ${$('fb').textContent}`);
        const other = f.callouts.find(o => o !== c && (pool !== 'rooms' || o.room) && o.ck !== c.ck && !o.covers(c) && o.area(pool) && inZone(o.area(pool), f.toPlan({ x: plate.x(o), y: plate.y(o) }, plate.inGame(f))));
        if (other) {
          drill.ask(c);
          drill.q.tap({ x: plate.x(other), y: plate.y(other) });
          if ($('fb').textContent.startsWith('You tapped ')) out.wrong++; else out.wrongFail.push(`${view}/${pool} ${c.name} via ${other.name}: ${$('fb').textContent}`);
        }
      }
    }
    drill.ask(ALL[0]); drill.q.tap({ x: 0.001, y: 0.001 });
    out.outside = $('fb').textContent;
    out.outlines = document.querySelectorAll('#layer svg.zone').length;
    delete drill.file;
    return out;
  });
  check(`a tap on the label counts (${res.ok} of ${res.asked})`, res.asked > 1000 && !res.fail.length, '\n  ' + res.fail.slice(0, 20).join('\n  '));
  check(`a tap on another label doesn't (${res.wrong})`, res.wrong > 1000 && !res.wrongFail.length, '\n  ' + res.wrongFail.slice(0, 20).join('\n  '));
  check('a tap away from every area is outside', /^That's outside .+, outlined in green\.$/.test(res.outside), res.outside);
  check('one outline drawn at a time', res.outlines === 1, res.outlines);

  // A miss in the in-game view, for the record.
  await page.evaluate(() => {
    settings.view = 'game'; settings.pool = 'all';
    const c = ALL.find(x => x.name === 'Stall 2'), o = c.floor.callouts.find(x => x.name === 'Showers');
    drill.ask(c); drill.q.tap({ x: plate.x(o), y: plate.y(o) });
  });
  const miss = await page.textContent('#fb');
  check('a miss names what was tapped', miss.startsWith('You tapped Showers'), miss);
  await shot(page, 'zone_miss');
});
