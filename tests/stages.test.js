// Learning stages and what comes up next. Four right answers in a row make a callout
// learned and eight mastered; a miss sets it back below learned; mixing another callout up
// with the one asked (tapping, picking or naming it instead) costs that one a step; and a
// learned callout is kept back until the pool's other callouts have come up. Runs on the
// test page, where the app's code is reachable.
const { isDeepStrictEqual } = require('util');
const { run, open, check, shot, TEST_PAGE } = require('./lib');

const KEY = 'r6-callout-drill-v1';

run(async browser => {
  let page = await open(browser, TEST_PAGE);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const note = () => ev(() => { const n = document.getElementById('stageNote'); return n ? [n.textContent, n.className] : null; });
  const level = name => ev(n => { const c = ALL.find(c => c.map.id === 'border' && c.name === n); const s = progress.of(c); return s ? [progress.stage(c), s.p, s.n, s.c] : [0]; }, name);
  const setP = (name, s) => ev(([n, s]) => { const c = ALL.find(c => c.map.id === 'border' && c.name === n); progress.stats[c.key] = { last: 1, at: ++store.data.asked, ...s }; }, [name, s]);

  // 1. Pick it, answered through the page: up the stages, then a miss from each.
  await page.click('[data-mode=pick]');
  const pickAnswer = async (name, right, other) => {
    // the four options are drawn at random: draw again until the one wanted is there
    await ev(([n, other]) => {
      for (let k = 0; k < 200; k++) {
        drill.ask(ALL.find(c => c.map.id === 'border' && c.name === n));
        if (!other || drill.q.opts.some(o => o.name === other)) return;
      }
    }, [name, other]);
    const i = await ev(([right, other]) => { const q = drill.q; return q.opts.findIndex(o => right ? o === q.c : other ? o.name === other : o !== q.c); }, [right, other]);
    if (i < 0) throw new Error(`${other} isn't offered`);
    await page.click(`.choices button >> nth=${i}`);
  };
  await ev(() => drill.erase());
  const seen = [];
  for (let i = 1; i <= 8; i++) { await pickAnswer('Stall 1', true); seen.push((await level('Stall 1')).slice(0, 2)); }
  check('right answers: somewhat learned, learned at 4 in a row, mastered at 8',
    isDeepStrictEqual(seen, [[2, 1], [2, 2], [2, 3], [3, 4], [3, 5], [3, 6], [3, 7], [4, 8]]), JSON.stringify(seen));
  check('the note says so', isDeepStrictEqual(await note(), ['Mastered: 8 right in a row.', 'stage-note up']), JSON.stringify(await note()));
  await pickAnswer('Stall 1', false);
  check('a miss from mastered: back to somewhat learned, 2 in a row', isDeepStrictEqual(await level('Stall 1'), [2, 2, 9, 8]), JSON.stringify(await level('Stall 1')));
  check('...and the note says it comes up more often again', isDeepStrictEqual(await note(), ['Back to somewhat learned: it comes up more often again.', 'stage-note down']), JSON.stringify(await note()));
  await shot(page, 'stages_lapse');
  await pickAnswer('Stall 1', true); await pickAnswer('Stall 1', true);
  check('two more right: learned again', (await level('Stall 1'))[0] === 3);
  await pickAnswer('Stall 1', false);
  check('a miss from learned: 1 in a row', (await level('Stall 1'))[1] === 1);
  await pickAnswer('Stall 1', false);
  check('a miss from somewhat learned: unlearned', isDeepStrictEqual((await level('Stall 1')).slice(0, 2), [1, 0]) && (await note())[0] === 'Back to unlearned: it comes up more often again.', JSON.stringify(await note()));

  // 2. The callout picked, tapped or named instead loses a step and can't stay learned.
  await setP('Stall 2', { n: 6, c: 6, p: 6 });
  await pickAnswer('Stall 1', false, 'Stall 2');
  check('Pick it: the callout picked instead drops to somewhat learned', isDeepStrictEqual(await level('Stall 2'), [2, 2, 6, 6]), JSON.stringify(await level('Stall 2')));
  check('...and the note names it', (await note())[0].endsWith(' Stall 2, which you mixed it up with, is somewhat learned now.'), (await note())[0]);
  await pickAnswer('Stall 1', false, 'Stall 2');
  check('...again: one step more', (await level('Stall 2'))[1] === 1 && !(await note())[0].includes('mixed'), JSON.stringify(await note()));
  await pickAnswer('Stall 1', true);
  check('a right answer leaves the other callouts alone', (await level('Stall 2'))[1] === 1);
  const unasked = await ev(() => { const q = drill.q, o = q.opts.find(o => o !== q.c && !progress.of(o)); if (!o) return 'none offered'; q.choose(q.opts.indexOf(o)); return progress.of(o) === undefined; });
  check('...and mixing up one never asked leaves it unasked', unasked === true || unasked === 'none offered', unasked);

  await page.click('[data-mode=find]');
  const tapped = await ev(() => {
    // a main room whose outline holds its own dot, asked as another main room on its floor
    settings.pool = 'rooms';
    for (const o of ALL) {
      const f = o.floor, z = o.area('rooms');
      if (!o.room || !z || !inZone(z, f.toPlan({ x: plate.x(o), y: plate.y(o) }, plate.inGame(f)))) continue;
      const c = f.callouts.find(c => c !== o && c.room && c.ck !== o.ck && !o.covers(c));
      if (!c) continue;
      progress.stats[o.key] = { n: 9, c: 9, p: 8, last: 1, at: ++store.data.asked };
      drill.ask(c);
      drill.q.tap({ x: plate.x(o), y: plate.y(o) });
      return [o.name, progress.of(o).p, document.getElementById('fb').textContent, document.getElementById('stageNote').textContent];
    }
  });
  check('Find it: the callout tapped instead drops from mastered to 2', tapped[1] === 2 && tapped[2].startsWith(`You tapped ${tapped[0]}.`) && tapped[3].includes(`${tapped[0]}, which you mixed it up with, is somewhat learned now.`), JSON.stringify(tapped));
  await shot(page, 'stages_find_mixup');

  await page.click('[data-mode=name]'); await page.click('[data-answer=type]');
  const askName = n => ev(n => drill.ask(ALL.find(c => c.map.id === 'border' && c.name === n)), n);
  await setP('Stall 2', { n: 5, c: 5, p: 5 });
  await askName('Stall 1');
  await page.fill('#guess', 'stall 2'); await page.press('#guess', 'Enter');
  check('Name it, typed: the callout named instead drops', (await level('Stall 2'))[1] === 2, JSON.stringify(await level('Stall 2')));
  await setP('Stall 2', { n: 5, c: 5, p: 5 });
  await askName('Stall 1');
  await page.fill('#guess', 'xyzzy'); await page.press('#guess', 'Enter'); await page.press('#guess', 'Enter');
  check('...a wrong answer that names nothing leaves the others alone', (await level('Stall 2'))[1] === 5, JSON.stringify(await level('Stall 2')));
  await page.click('[data-answer=pool]');
  await askName('Stall 1');
  await page.click('#bank button[data-key="stall2"]');
  check('Name it, from the pool: the chip picked instead drops', (await level('Stall 2'))[1] === 2, JSON.stringify(await level('Stall 2')));
  await page.click('[data-answer=type]');

  await setP('Stall 1', { n: 2, c: 2, p: 2 });
  await askName('Stall 1');
  await page.click('#hintBtn');
  await page.fill('#guess', 'stall 1'); await page.press('#guess', 'Enter');
  check('a right answer after a hint: counted right, no step on', isDeepStrictEqual(await level('Stall 1'), [2, 2, 3, 3]), JSON.stringify(await level('Stall 1')));
  check('...and the note says why', (await note())[0] === 'Somewhat learned: 2 of 4 right in a row to learned. A hinted answer doesn’t count toward it.', (await note())[0]);

  // 3. What comes up next, on Border's main rooms.
  const picks = (setup, times = 3000) => ev(([setup, times]) => {
    drill.erase(); Object.assign(settings, { map: 'border', floor: null, pool: 'rooms' });
    const p = drill.picker.pool();
    new Function('p', 'stats', 'saved', setup)(p, progress.stats, store.data);
    const n = Object.fromEntries(p.map(c => [c.key, 0]));
    for (let i = 0; i < times; i++) n[drill.picker.draw().key]++;
    return { size: p.length, n: p.map(c => [n[c.key], progress.stage(c), progress.of(c)?.at ?? -1]) };
  }, [setup, times]);
  let r = await picks(`p.forEach((c, i) => { if (i % 2) stats[c.key] = { n: 4, c: 4, p: 4 + i % 5, last: 1, at: ++saved.asked }; });`);
  check(`learned callouts don't come up while any in the pool is unasked (${r.size} rooms)`, r.n.every(([k, st]) => st < 3 || k === 0) && r.n.some(([k, st]) => st === 0 && k > 0), JSON.stringify(r.n));
  r = await picks(`p.forEach((c, i) => { if (i % 2) stats[c.key] = { n: 1, c: 0, p: 0, last: 0, at: ++saved.asked }; });`, 12000);
  const each = st => { const ks = r.n.filter(x => x[1] === st).map(x => x[0]); return ks.reduce((a, b) => a + b, 0) / ks.length; };
  const ratio = each(1) / each(0);
  check(`a missed callout comes up a little more often than an unasked one (${ratio.toFixed(2)} times)`, ratio > 1.3 && ratio < 1.75, ratio);
  r = await picks(`p.forEach(c => { stats[c.key] = { n: 4, c: 4, p: 4, last: 1, at: ++saved.asked }; });`);
  const due = Math.ceil(0.75 * (r.size - 1)), oldest = r.n.map(x => x[2]).sort((a, b) => a - b).slice(0, r.size - due).at(-1);
  check('all learned: only those that most of the pool has come up since', r.n.every(([k, , at]) => (at <= oldest) === (k > 0)), JSON.stringify(r.n));
  r = await picks(`p.forEach((c, i) => { stats[c.key] = { n: 9, c: 9, p: i ? 4 : 8, last: 1, at: ++saved.asked }; });`);
  check('a mastered callout waits longer than a learned one', r.n[0][0] === 0 && r.n[1][0] > 0, JSON.stringify(r.n.slice(0, 3)));
  r = await picks(`p.forEach((c, i) => { stats[c.key] = { n: 9, c: 9, p: i ? 4 : 8, last: 1, at: ++saved.asked }; }); saved.asked += 2 * p.length;`);
  check('...and comes up once twice the pool has gone by', r.n[0][0] > 0, JSON.stringify(r.n.slice(0, 3)));

  const misses = await ev(() => {
    drill.erase(); Object.assign(settings, { map: 'border', floor: null, pool: 'all' });
    const [a, b, c, d, e] = drill.picker.pool(), stats = progress.stats;
    stats[a.key] = { n: 2, c: 1, p: 0, last: 0, at: 1 };      // unlearned
    stats[b.key] = { n: 3, c: 2, p: 2, last: 1, at: 2 };      // somewhat learned, missed once
    stats[c.key] = { n: 2, c: 2, p: 2, last: 1, at: 3 };      // somewhat learned, never missed
    stats[d.key] = { n: 6, c: 5, p: 4, last: 1, at: 4 };      // learned again
    stats[e.key] = { n: 9, c: 8, p: 8, last: 1, at: 5 };      // mastered
    settings.pool = 'misses';
    return drill.picker.pool().map(o => [a, b, c, d, e].indexOf(o));
  });
  check('My misses: missed and not learned again', isDeepStrictEqual(misses, [0, 1]), JSON.stringify(misses));

  // 4. A drill on Border's main rooms, every answer right, with the next questions planned
  // ahead as the app does: learned callouts stay back, everything gets mastered, and the
  // order isn't the same lap after lap.
  const lap = await ev(() => {
    drill.erase(); Object.assign(settings, { map: 'border', floor: null, pool: 'rooms' });
    const picker = drill.picker, stats = progress.stats, p = picker.pool(), N = p.length, need = Math.ceil(0.75 * (N - 1));
    const out = { N, early: 0, close: [], masteredAt: null, laps: [] };
    for (let i = 0; i < 14 * N; i++) {
      const c = picker.next(), s = stats[c.key];
      if (s && Progress.stageOf(s) >= 3) {
        if (p.some(o => !stats[o.key])) out.early++;
        const since = p.filter(o => stats[o.key] && stats[o.key].at > s.at).length;
        if (since < need) out.close.push(`${c.name} after ${since}`);
      }
      progress.record(c, 'exact', false);
      picker.plan();
      if (out.masteredAt === null && p.every(o => progress.stage(o) === 4)) out.masteredAt = i + 1;
      if (out.masteredAt !== null && out.laps.length < 2 * N) out.laps.push(c.key);
    }
    out.sameLap = out.laps.slice(0, N).join() === out.laps.slice(N).join();
    return out;
  });
  check(`drill: no learned callout comes up while any is unasked (${lap.N} rooms)`, lap.early === 0, lap.early);
  check('drill: a learned callout comes back only after most of the others', !lap.close.length, lap.close.slice(0, 10).join(', '));
  check(`drill: all mastered after ${lap.masteredAt} answers`, lap.masteredAt !== null && lap.masteredAt <= 10 * lap.N, lap.masteredAt);
  check('drill: then the order changes from lap to lap', lap.laps.length === 2 * lap.N && !lap.sameLap);
  await page.context().close();

  // 5. Saves from before the stages, and odd ones, read back as numbers that fit.
  page = await open(browser, TEST_PAGE);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify({ update: 1, asked: 3, stats: {
    'border|1F|o0': { n: 5, c: 5, last: 1 }, 'border|1F|o1': { n: 5, c: 4, last: 1 }, 'border|1F|o2': { n: 3, c: 1, last: 0 },
    'border|1F|o3': { n: 12, c: 12, last: 1 }, 'border|1F|o4': { n: 2, c: 9, p: 99, at: -3, last: 'x' }, 'border|1F|o5': { n: 0, c: 0 },
    'border|1F|o6': { n: 4, c: 3, p: 6, at: 12, last: 1, extra: '<b>' }, 'border|1F|o7': { n: 1.5, c: 1 },
  } })]);
  await page.reload(); await page.waitForFunction(() => document.getElementById('qCard').textContent.trim() !== '');
  const back = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  check('old saves: all right was all in a row, otherwise only the latest', isDeepStrictEqual(back.stats, {
    'border|1F|o0': { n: 5, c: 5, p: 5, last: 1, at: 0 }, 'border|1F|o1': { n: 5, c: 4, p: 1, last: 1, at: 0 }, 'border|1F|o2': { n: 3, c: 1, p: 0, last: 0, at: 0 },
    'border|1F|o3': { n: 12, c: 12, p: 8, last: 1, at: 0 }, 'border|1F|o4': { n: 2, c: 2, p: 2, last: 1, at: 0 },
    'border|1F|o6': { n: 4, c: 3, p: 6, last: 1, at: 12 },
  }) && back.asked === 12, JSON.stringify(back));
  await page.context().close();
});
