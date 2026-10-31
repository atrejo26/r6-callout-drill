// Progress: filed under each callout's id, earlier releases' keys carried over, the update
// note, the progress report, sharing it and opening a shared link. Runs on the shipped
// page: the app is only reached through the page, as a player would.
const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');
const { run, open, ready, until, check, shot, errors, DATA, SHIPPED } = require('./lib');

const KEY = 'r6-callout-drill-v1';
const OLD_KEYS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'old_keys.json'), 'utf8'));

// The report's numbers for some saved stats, worked out here from callouts.json.
function expected(stats) {
  const a = { n: 0, c: 0, t: 0, r: 0, m: 0, rm: 0, s: 0 }, misses = [];
  for (const m of DATA.maps) for (const f of m.floors) for (const c of f.callouts) {
    const st = stats[`${m.id}|${f.name}|${c.id}`];
    a.t++; if (c.room) a.r++;
    if (!st) continue;
    a.s++; a.n += st.n; a.c += Math.min(st.c, st.n);
    if (st.last === 1) { a.m++; if (c.room) a.rm++; }
    if (st.last === 0) misses.push([c.name, st.n - st.c]);
  }
  misses.sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
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

  // 2. Progress under old keys moves to the callout ids.
  const old = {
    'border|1F|2|38': { n: 2, c: 1, last: 0 }, 'border|1F|Stall 2|38': { n: 3, c: 3, last: 1 }, 'border|1F|Stall 2|35': { n: 1, c: 0, last: 0 },
    'kafe|1F|R1|18': { n: 1, c: 1, last: 1 }, 'kafe|1F|R1|19': { n: 2, c: 1, last: 1 },
    'lair|2F|o21': { n: 1, c: 1, last: 1 }, 'lair|2F|Boost|19': { n: 2, c: 0, last: 0 },
    'border|1F|Nope|99': { n: 1, c: 1, last: 1 },
  };
  const carried = {
    'border|1F|o38': { n: 6, c: 4, last: 0 }, 'kafe|1F|o19': { n: 3, c: 2, last: 1 }, 'lair|2F|o21': { n: 3, c: 1, last: 0 },
    'border|1F|Nope|99': { n: 1, c: 1, last: 1 },
  };
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
  check('keep: note seen, progress kept', await seen(page) && (await stored(page)).stats['kafe|1F|o19'].n === 3);
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

  // 3. The report: numbers, misses, practice, sharing.
  const mine = {
    'border|1F|o38': { n: 6, c: 4, last: 0 }, 'kafe|1F|o19': { n: 3, c: 2, last: 1 }, 'lair|2F|o21': { n: 3, c: 1, last: 0 },
    'bank|1F|o0': { n: 2, c: 2, last: 1 }, 'bank|2F|o1': { n: 4, c: 1, last: 0 },
  };
  const e = expected(mine), pct = (a, b) => Math.round(100 * a / b);
  page = await start({ stats: mine, update: 1 }, { viewport: { width: 1440, height: 900 }, init: () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__clip = t; } } });
    Object.defineProperty(navigator, 'share', { value: async d => { window.__share = d; } });
  } });
  await page.click('#reportBtn');
  check('the report opens', await isOpen(page, 'report'));
  const hero = await page.textContent('#reportBody .hero');
  check('report: callouts mastered', hero.includes(`${e.m}/${e.t}`), hero);
  const cells = await page.$$eval('#reportBody .stat', ns => ns.map(n => n.textContent));
  check('report: main rooms, spots, answers, right', isDeepStrictEqual(cells, [`Main rooms${e.rm}/${e.r}`, `Spots${e.m - e.rm}/${e.t - e.r}`, `Answers${e.n}`, `Right${pct(e.c, e.n)}%`]), JSON.stringify(cells));
  const rows = await page.$$eval('#reportBody .rep li', ns => ns.map(n => n.textContent));
  const bankT = DATA.maps.find(m => m.id === 'bank').floors.reduce((a, f) => a + f.callouts.length, 0);
  check('report: a row per map', rows.length === DATA.maps.length, rows[0]);
  check('report: the Bank row', rows.some(r => r.startsWith(`Bank1/${bankT}`) && r.includes('50% right')), rows.find(r => r.startsWith('Bank')));
  const missed = await page.$$eval('#reportBody .log li b', ns => ns.map(n => n.firstChild.textContent));
  check('report: to work on, most missed first', isDeepStrictEqual(missed, e.misses), JSON.stringify([missed, e.misses]));
  await shot(page, 'progress_report');

  await page.$eval('#shareName', n => { n.value = '  Ace <img src=x onerror=alert(1)>' + String.fromCharCode(0x202e) + ' \n'; n.dispatchEvent(new Event('input')); });
  st = await stored(page);
  check('name saved cleaned up and cut to 24', st.name === 'Ace <img src=x onerror=a', JSON.stringify(st.name));
  check('name shown as text', (await page.textContent('#reportWho')).startsWith('Ace <img') && !(await page.$('#reportWho img')));
  await page.click('#copyLink');
  check('Copy link', await until(page, () => document.getElementById('shareMsg').textContent === 'Link copied.'));
  const link = await page.evaluate(() => window.__clip);
  check('the link opens the site on the report', /^https:\/\/atrejo26\.github\.io\/r6-callout-drill\/#report=1~\d{8}~[A-Za-z0-9_-]+~border_/.test(link), link);
  check('the link is short enough to paste anywhere', link.length < 700, link.length);
  await page.click('#copyReport');
  check('Copy report', await until(page, () => document.getElementById('shareMsg').textContent === 'Report copied.'));
  const rep = await page.evaluate(() => window.__clip);
  check('the copied report: who, how far, the link', rep.startsWith('R6 Callout Drill progress: Ace <img src=x onerror=a, ') && rep.includes(`Mastered ${e.m} of ${e.t} callouts`) && rep.trim().endsWith(link), rep);
  check('Share… shown where there is a share sheet', await page.isVisible('#shareBtn'));
  await page.click('#shareBtn');
  check('the share sheet gets the title, the text and the link', await until(page, () => !!window.__share));
  const sh = await page.evaluate(() => window.__share);
  check('...the link once, as the url', sh.url === link && sh.title === 'R6 Callout Drill progress' && sh.text.startsWith('R6 Callout Drill progress') && !sh.text.includes('https://'), JSON.stringify(sh).slice(0, 160));
  await page.click('#previewBtn');
  check('preview: what they see', (await page.textContent('#reportTitle')) === 'Shared progress' && !(await page.isVisible('#reportShare')) && (await page.textContent('#reportBody .hero')).includes(`${e.m}/${e.t}`));
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
  const yours = { 'border|1F|o0': { n: 1, c: 0, last: 0 } };
  page = await start({ stats: yours }, { hash: '#' + link.split('#')[1] });
  check('shared: opens on its own', await isOpen(page, 'report') && (await page.textContent('#reportTitle')) === 'Shared progress');
  check('shared: their numbers and name', (await page.textContent('#reportBody .hero')).includes(`${e.m}/${e.t}`) && (await page.textContent('#reportWho')).startsWith('Ace <img'));
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
  const odd = `#report=1~20261031~${enc('<img src=x onerror=window.__pwn=1>')}~zz-new_2_1_1F.4.1.1.1.2`;
  await page.evaluate(h => { location.hash = h; }, odd);
  await until(page, () => document.getElementById('report').open);
  check('odd link: markup in the name stays text', (await page.textContent('#reportWho')).startsWith('<img src=x onerror=wi') && !(await page.$('#report img')) && !(await page.evaluate(() => window.__pwn)));
  check('odd link: a map this version lacks shows by its id', (await page.textContent('#reportBody .rep')).startsWith('zz-new1/4'));
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
