// Progress: filed under each callout's id, earlier releases' keys carried over, the update
// note, the progress report, sharing it and opening a shared link. Runs on the shipped
// page: the app is only reached through the page, as a player would.
const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');
const { run, open, ready, until, check, shot, errors, DATA, SHIPPED } = require('./lib');

const KEY = 'r6-callout-drill-v1';
const OLD_KEYS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'old_keys.json'), 'utf8'));

// A saved callout as the app reads it back: saves from before the stages have no p (right
// answers in a row) or at (when last asked), and get them.
const norm = s => ({ n: s.n, c: s.c, p: s.p ?? (s.last === 0 ? 0 : s.c === s.n ? Math.min(s.n, 8) : 1), last: s.last, at: s.at ?? 0 });
const normAll = stats => Object.fromEntries(Object.entries(stats).map(([k, s]) => [k, norm(s)]));
const stageOf = s => !s ? 0 : s.p >= 8 ? 4 : s.p >= 4 ? 3 : s.p > 0 ? 2 : 1;
// The report's numbers for some saved stats, worked out here from callouts.json: callouts
// (t), main rooms (r), tried (s), somewhat learned (a), learned (l), mastered (m), learned
// or mastered (won, rooms rw), answers (n) and right (c), and what's to work on.
function expected(saved) {
  const a = { n: 0, c: 0, t: 0, r: 0, s: 0, a: 0, l: 0, m: 0, won: 0, rw: 0, maps: {} }, misses = [];
  for (const m of DATA.maps) {
    const mm = a.maps[m.id] = { t: 0, won: 0, n: 0, c: 0 };
    for (const f of m.floors) for (const c of f.callouts) {
      const raw = saved[`${m.id}|${f.name}|${c.id}`], st = raw && norm(raw), g = stageOf(st);
      a.t++; mm.t++; if (c.room) a.r++;
      if (!st) continue;
      a.s++; a.n += st.n; a.c += st.c; mm.n += st.n; mm.c += st.c;
      if (g === 2) a.a++; if (g === 3) a.l++; if (g === 4) a.m++;
      if (g >= 3) { a.won++; mm.won++; if (c.room) a.rw++; }
      if ((g === 1 || g === 2) && st.n > st.c) misses.push([c.name, g, st.n - st.c]);
    }
  }
  misses.sort((x, y) => x[1] - y[1] || y[2] - x[2] || x[0].localeCompare(y[0]));
  return { ...a, misses: misses.map(x => x[0]) };
}

run(async browser => {
  // Every callout has an id of its own on its floor, and every old key points at one.
  const dupes = [], lost = [];
  for (const m of DATA.maps) for (const f of m.floors) {
    const ids = f.callouts.map(c => c.id);
    if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) dupes.push(`${m.id} ${f.name}`);
    for (const [old, id] of Object.entries(OLD_KEYS[`${m.id}|${f.name}`] || {})) if (!ids.includes(id)) lost.push(`${m.id}|${f.name}|${old} -> ${id}`);
  }
  const floors = new Set(DATA.maps.flatMap(m => m.floors.map(f => `${m.id}|${f.name}`)));
  check('every callout has an id of its own', !dupes.length, dupes.join(', '));
  check('every old progress key belongs to a callout', !lost.length && Object.keys(OLD_KEYS).every(w => floors.has(w)), lost.join(', '));

  // A page on the shipped app with `state` saved before it starts.
  async function start(state, { hash = '', ...opts } = {}) {
    const page = await open(browser, SHIPPED, opts);
    if (state !== undefined) await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(state)]);
    await page.goto(SHIPPED + hash);
    if (hash) await page.reload();
    await ready(page);
    return page;
  }
  const stored = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  const isOpen = (page, id) => page.evaluate(id => document.getElementById(id).open, id);
  const seen = page => until(page, k => JSON.parse(localStorage.getItem(k)).update === 1, KEY);   // the note's close is saved a moment later
  const logRows = page => page.evaluate(() => document.getElementById('logList').children.length);

  // 1. A new player: no note, and it's marked seen so it never shows later.
  let page = await start(undefined);
  check('new player: no update note', !(await isOpen(page, 'updateNote')));
  check('new player: note marked seen', (await stored(page)).update === 1);
  await page.context().close();

  // Only progress from before the major update (1.1.3) brings the note up: not 1.1.3's
  // own, nor anything saved since. Once found, it waits for an answer.
  page = await start({ stats: { 'border|1F|Stall 2|35': { n: 2, c: 2, last: 1 }, 'lair|2F|Boost|19': { n: 1, c: 0, last: 0 } } });
  const v113 = await stored(page);
  check('1.1.3 progress: no note, marked seen', !(await isOpen(page, 'updateNote')) && v113.update === 1);
  check('1.1.3 progress: carried to the ids', isDeepStrictEqual(v113.stats, normAll({ 'border|1F|o38': { n: 2, c: 2, last: 1 }, 'lair|2F|o21': { n: 1, c: 0, last: 0 } })), JSON.stringify(v113.stats));
  await page.context().close();
  page = await start({ stats: { 'kafe|1F|o19': { n: 1, c: 1, last: 1 } } });
  check('progress saved since, the note never answered: no note', !(await isOpen(page, 'updateNote')) && (await stored(page)).update === 1);
  await page.context().close();
  page = await start({ stats: { 'kafe|1F|R1|18': { n: 1, c: 1, last: 1 } } });
  check('progress from before: the note shows', await isOpen(page, 'updateNote'));
  await page.reload(); await ready(page);
  const pending = await stored(page);
  check('...and again until answered, after the progress moved to the ids', await isOpen(page, 'updateNote') && pending.update === 0 && isDeepStrictEqual(pending.stats, normAll({ 'kafe|1F|o19': { n: 1, c: 1, last: 1 } })), JSON.stringify(pending));
  await page.context().close();

  // 2. Progress under old keys moves to the callout ids, and the note shows: some of it is
  // from before 1.1.3.
  const old = {
    'border|1F|2|38': { n: 2, c: 1, last: 0 }, 'border|1F|Stall 2|38': { n: 3, c: 3, last: 1 }, 'border|1F|Stall 2|35': { n: 1, c: 0, last: 0 },
    'kafe|1F|R1|18': { n: 2, c: 2, last: 1 }, 'kafe|1F|R1|19': { n: 2, c: 2, last: 1 },
    'lair|2F|o21': { n: 1, c: 1, last: 1 }, 'lair|2F|Boost|19': { n: 2, c: 0, last: 0 },
    'border|1F|Nope|99': { n: 1, c: 1, last: 1 },
  };
  // all 4 of Kafe's answers were right, so in a row: learned
  const carried = normAll({
    'border|1F|o38': { n: 6, c: 4, last: 0 }, 'kafe|1F|o19': { n: 4, c: 4, last: 1 }, 'lair|2F|o21': { n: 3, c: 1, last: 0 },
    'border|1F|Nope|99': { n: 1, c: 1, last: 1 },
  });
  page = await start({ stats: old, prefs: { mode: 'pick' } });
  let st = await stored(page);
  check('old keys carried to the ids, answers added up', isDeepStrictEqual(st.stats, carried), JSON.stringify(st.stats));
  check('the map list counts carried progress', (await page.textContent('#mapChips')).includes('Kafe Dostoyevsky1/'));
  check('Full report fits beside the map label', await page.evaluate(() => { const h = document.querySelector('.group-head'); return h.offsetHeight < 24 && h.scrollWidth <= h.clientWidth; }));
  check('the update note shows for old progress', await isOpen(page, 'updateNote'));
  check('note: Keep is focused', await page.evaluate(() => document.activeElement.id) === 'keepProgress');
  await shot(page, 'progress_note');
  await page.keyboard.press('1');
  check('keys over the note do nothing behind it', await logRows(page) === 0 && await isOpen(page, 'updateNote'));
  await page.keyboard.press('Enter');   // the focused Keep button
  check('Enter keeps', !(await isOpen(page, 'updateNote')) && await logRows(page) === 0);
  check('keep: note seen, progress kept', await seen(page) && (await stored(page)).stats['kafe|1F|o19'].n === 4);
  await page.reload(); await ready(page);
  check('keep: no note after a reload', !(await isOpen(page, 'updateNote')));
  await page.context().close();

  page = await start({ stats: old });
  await page.keyboard.press('Escape');
  check('Escape: note closed and seen, progress kept', !(await isOpen(page, 'updateNote')) && await seen(page) && Object.keys((await stored(page)).stats).length === 4);
  await page.context().close();

  page = await start({ stats: old, prefs: { pool: 'misses' } });
  await page.click('#startOver');
  check('Start over: progress erased, note seen', !(await isOpen(page, 'updateNote')) && await seen(page) && Object.keys((await stored(page)).stats).length === 0);
  check('Start over: the map list is back to zero', /All maps0\//.test(await page.textContent('#mapChips')));
  check('Start over: the misses pool is empty now', (await page.textContent('#qCard')).includes('no misses'));
  await page.context().close();

  // 3. The report: numbers, misses, practice, sharing. A callout at every stage, and two
  // saved before the stages.
  const mine = {
    'border|1F|o38': { n: 6, c: 4, p: 0, last: 0, at: 5 }, 'kafe|1F|o19': { n: 9, c: 8, p: 8, last: 1, at: 7 }, 'lair|2F|o21': { n: 3, c: 1, p: 1, last: 1, at: 6 },
    'bank|1F|o0': { n: 4, c: 4, last: 1 }, 'bank|2F|o1': { n: 4, c: 1, last: 0 }, 'bank|1F|o2': { n: 2, c: 2, p: 2, last: 1, at: 3 },
  };
  const e = expected(mine), pct = (a, b) => Math.round(100 * a / b);
  page = await start({ stats: mine, update: 1 }, { viewport: { width: 1440, height: 900 }, init: () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__clip = t; } } });
    Object.defineProperty(navigator, 'share', { value: async d => { window.__share = d; } });
  } });
  await page.click('#reportBtn');
  check('the report opens', await isOpen(page, 'report'));
  const hero = await page.textContent('#reportBody .hero');
  check('report: callouts learned', hero === `${e.won}/${e.t}callouts learned${pct(e.won, e.t)}%` && e.won === 2, hero);
  const legend = await page.$$eval('#reportBody .legend li', ns => ns.map(n => n.textContent));
  check('report: how many at each stage', isDeepStrictEqual(legend, [`Mastered${e.m}`, `Learned${e.l}`, `Somewhat learned${e.a}`, `Unlearned${e.s - e.a - e.l - e.m}`, `Unasked${e.t - e.s}`])
    && e.m === 1 && e.l === 1 && e.a === 2 && e.s === 6, JSON.stringify(legend));
  const cells = await page.$$eval('#reportBody .stat', ns => ns.map(n => n.textContent));
  check('report: main rooms, spots, answers, right', isDeepStrictEqual(cells, [`Main rooms${e.rw}/${e.r}`, `Spots${e.won - e.rw}/${e.t - e.r}`, `Answers${e.n}`, `Right${pct(e.c, e.n)}%`]), JSON.stringify(cells));
  const rows = await page.$$eval('#reportBody .rep li', ns => ns.map(n => n.textContent));
  const bank = e.maps.bank;
  check('report: a row per map', rows.length === DATA.maps.length, rows[0]);
  check('report: the Bank row', rows.some(r => r.startsWith(`Bank${bank.won}/${bank.t}`) && r.includes(`${pct(bank.c, bank.n)}% right`)) && bank.won === 1, rows.find(r => r.startsWith('Bank')));
  const missed = await page.$$eval('#reportBody .log li b', ns => ns.map(n => n.firstChild.textContent));
  check('report: to work on, unlearned first, then the most missed', isDeepStrictEqual(missed, e.misses) && missed.length === 3, JSON.stringify([missed, e.misses]));
  const work = await page.$$eval('#reportBody .log li small', ns => ns.map(n => n.textContent));
  check('report: to work on says the stage and the misses', work[0] === 'Unlearned · missed 3 of 4' && work[2] === 'Somewhat learned · missed 2 of 3', JSON.stringify(work));
  await shot(page, 'progress_report');

  await page.$eval('#shareName', n => { n.value = '  Ace <img src=x onerror=alert(1)>' + String.fromCharCode(0x202e) + ' \n'; n.dispatchEvent(new Event('input')); });
  st = await stored(page);
  check('name saved cleaned up and cut to 24', st.name === 'Ace <img src=x onerror=a', JSON.stringify(st.name));
  check('name shown as text', (await page.textContent('#reportWho')).startsWith('Ace <img') && !(await page.$('#reportWho img')));
  await page.click('#copyLink');
  check('Copy link', await until(page, () => document.getElementById('shareMsg').textContent === 'Link copied.'));
  const link = await page.evaluate(() => window.__clip);
  check('the link opens the site on the report', /^https:\/\/atrejo26\.github\.io\/r6-callout-drill\/#report=2~\d{8}~[A-Za-z0-9_-]+~border_/.test(link), link);
  check('the link is short enough to paste anywhere', link.length < 700, link.length);
  await page.click('#copyReport');
  check('Copy report', await until(page, () => document.getElementById('shareMsg').textContent === 'Report copied.'));
  const rep = await page.evaluate(() => window.__clip);
  check('the copied report: who, how far, the link', rep.startsWith('R6 Callout Drill progress: Ace <img src=x onerror=a, ') && rep.includes(`Learned ${e.won} of ${e.t} callouts`) && rep.includes(`Mastered ${e.m} · Learned ${e.l} · Somewhat learned ${e.a}`) && rep.trim().endsWith(link), rep);
  check('Share… shown where there is a share sheet', await page.isVisible('#shareBtn'));
  await page.click('#shareBtn');
  check('the share sheet gets the title, the text and the link', await until(page, () => !!window.__share));
  const sh = await page.evaluate(() => window.__share);
  check('...the link once, as the url', sh.url === link && sh.title === 'R6 Callout Drill progress' && sh.text.startsWith('R6 Callout Drill progress') && !sh.text.includes('https://'), JSON.stringify(sh).slice(0, 160));
  await page.click('#previewBtn');
  check('preview: what they see', (await page.textContent('#reportTitle')) === 'Shared progress' && !(await page.isVisible('#reportShare')) && (await page.textContent('#reportBody .hero')).includes(`${e.won}/${e.t}`));
  await page.click('#reportClose');
  check('Back from the preview', (await page.textContent('#reportTitle')) === 'Progress report' && await page.isVisible('#reportShare'));
  await page.mouse.click(100, 450);
  check('a click outside closes it', !(await isOpen(page, 'report')));
  await page.click('#reportBtn');
  await page.click('#reportBody .log .btn');
  const prefs = (await stored(page)).prefs;
  check('Practice my misses: closed, all maps, misses pool', !(await isOpen(page, 'report')) && prefs.pool === 'misses' && prefs.map === 'all', JSON.stringify(prefs));
  await page.context().close();

  // No share sheet, and the clipboard refused: the text is left selected to copy by hand.
  page = await start({ stats: mine, update: 1 }, { init: () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } } });
    delete Navigator.prototype.share;
  } });
  await page.click('#reportBtn');
  check('no share sheet: no Share…, Copy report is the main button', !(await page.isVisible('#shareBtn')) && !(await page.getAttribute('#copyReport', 'class')).includes('ghost'));
  await page.click('#copyLink');
  check('clipboard refused: the link is shown, selected', await until(page, () => {
    const t = document.getElementById('shareText');
    return !t.hidden && t.selectionStart === 0 && t.selectionEnd === t.value.length && t.value.startsWith('https://');
  }), await page.textContent('#shareMsg'));
  await page.context().close();

  // 4. Opening a shared link: their numbers, read-only, and nothing of yours changes.
  const yours = { 'border|1F|o0': { n: 1, c: 0, p: 0, last: 0, at: 1 } };
  page = await start({ stats: yours, update: 0 }, { hash: '#' + link.split('#')[1] });   // the update note not answered yet
  check('shared: opens on its own', await isOpen(page, 'report') && (await page.textContent('#reportTitle')) === 'Shared progress');
  check('shared: their numbers and name', (await page.textContent('#reportBody .hero')).includes(`${e.won}/${e.t}`)
    && isDeepStrictEqual(await page.$$eval('#reportBody .legend b', ns => ns.map(n => +n.textContent)), [e.m, e.l, e.a, e.s - e.a - e.l - e.m, e.t - e.s]) && (await page.textContent('#reportWho')).startsWith('Ace <img'));
  check('shared: no misses list or share box', !(await page.$('#reportBody .log')) && !(await page.isVisible('#reportShare')));
  check('shared: the update note waits', !(await isOpen(page, 'updateNote')));
  await shot(page, 'progress_shared');
  st = await stored(page);
  check('shared: your progress untouched', isDeepStrictEqual(st.stats, yours) && st.name === undefined, JSON.stringify(st));
  await page.click('#reportClose');
  check('shared: closing takes the link out of the address', await until(page, () => location.hash === ''));
  check('shared: then the update note', await isOpen(page, 'updateNote'));
  await page.context().close();

  const enc = s => Buffer.from(s).toString('base64url');
  const bad = {
    garbage: '#report=garbage', empty: '#report=', 'c > n': '#report=1~20261031~~border_1_2_1F.5.1.1.1.1',
    'm > s': '#report=1~20261031~~border_3_2_1F.5.1.2.1.1', 'bad date': '#report=1~20261332~~border_1_1_1F.5.1.1.1.1',
    'bad number': '#report=1~20261031~~border_1_1_1F.5.1.1.1.!', 'map twice': '#report=1~20261031~~bank_1_1_1F.5.1.1.1.1~bank_1_1_1F.5.1.1.1.1',
    'bad name': '#report=1~20261031~%%%~border_1_1_1F.5.1.1.1.1', 'not utf-8': '#report=1~20261031~' + Buffer.from([0xff, 0xfe]).toString('base64url') + '~border_1_1_1F.5.1.1.1.1',
    huge: '#report=1~20261031~~' + Array(500).fill('border_1_1_1F.5.1.1.1.1').join('~'),
    'unknown version': '#report=3~20261031~~border_1_1_1F.5.1.1',
    'stages > tried': '#report=2~20261031~~border_1_1_1F.5.1.1.1.1', 'rooms learned > learned': '#report=2~20261031~~border_1_1_1F.5.2.2.0.1.0.2',
    'rooms learned > rooms': '#report=2~20261031~~border_1_1_1F.5.1.2.0.2.0.2', 'spots learned > spots': '#report=2~20261031~~border_1_1_1F.3.2.3.0.3',
    'too many numbers': '#report=2~20261031~~border_1_1_1F.5.1.1.0.0.0.0.0', 'no numbers': '#report=2~20261031~~border_1_1_1F',
  };
  page = await start({ stats: {}, update: 1 });
  for (const [what, h] of Object.entries(bad)) {
    const e0 = errors.length;
    await page.evaluate(h => { location.hash = h; }, h);
    const ok = await until(page, () => document.getElementById('report').open && document.getElementById('reportNote').textContent.includes('damaged'));
    check(`bad link: ${what}`, ok && !(await page.$('#reportBody .hero')) && errors.length === e0, errors.slice(e0).join(' | '));
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('report').open && location.hash === '');
  }
  const odd = `#report=2~20261031~${enc('<img src=x onerror=window.__pwn=1>')}~zz-new_2_1_1F.4.1.2.0.1`;
  await page.evaluate(h => { location.hash = h; }, odd);
  await until(page, () => document.getElementById('report').open);
  check('odd link: markup in the name stays text', (await page.textContent('#reportWho')).startsWith('<img src=x onerror=wi') && !(await page.$('#report img')) && !(await page.evaluate(() => window.__pwn)));
  check('odd link: a map this version lacks shows by its id', (await page.textContent('#reportBody .rep')).startsWith('zz-new1/4'));
  await page.keyboard.press('Escape');
  await until(page, () => !document.getElementById('report').open && location.hash === '');
  // A link made before the stages: the callouts last got right show as somewhat learned.
  await page.evaluate(h => { location.hash = h; }, '#report=1~20261031~~border_3_2_1F.5.1.1.1.2');
  await until(page, () => document.getElementById('report').open);
  const v1 = await page.$$eval('#reportBody .legend b', ns => ns.map(n => +n.textContent));
  check('a link from before the stages still opens', (await page.textContent('#reportBody .hero')).startsWith('0/5') && isDeepStrictEqual(v1, [0, 0, 1, 1, 3])
    && (await page.textContent('#reportNote')).includes('before callouts had stages'), JSON.stringify(v1));
  await page.context().close();

  // 5. Phone: the report fits, nothing scrolls sideways, practice closes the menu too.
  page = await start({ stats: mine, update: 1, name: 'Ace' }, { viewport: { width: 390, height: 844 } });
  await page.click('#menuBtn'); await page.waitForSelector('#side .maps', { state: 'visible' });
  await page.click('#reportBtn');
  const fit = await page.evaluate(() => {
    const d = document.getElementById('report'), r = d.getBoundingClientRect();
    return { sw: d.scrollWidth, cw: d.clientWidth, left: r.left, right: innerWidth - r.right, page: document.documentElement.scrollWidth };
  });
  check('phone: the report fits', fit.sw <= fit.cw && fit.left >= 15 && fit.right >= 15 && fit.page <= 390, JSON.stringify(fit));
  await shot(page, 'progress_phone');
  await page.click('#reportBody .log .btn');
  check('phone: practice closes the menu too', await page.evaluate(() => !document.body.classList.contains('menu-open') && !document.getElementById('report').open));
});
