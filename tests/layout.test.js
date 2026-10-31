// The phone drawer (open, close by Done, the dimmed side or Escape, keys ignored while it
// is open), the floor plan filling its space through resizes and zoom without resizing
// itself in a loop, the answer log, and a desktop page that never scrolls.
const { run, open, until, settle, check, TEST_PAGE } = require('./lib');

run(async browser => {
  const page = await open(browser, TEST_PAGE, { viewport: { width: 390, height: 844 }, context: { hasTouch: true, isMobile: true } });
  const shown = (sel, state = 'visible') => page.waitForSelector(sel, { state, timeout: 5000 }).then(() => true, () => false);
  const is = fn => page.evaluate(fn);

  check('phone: settings start hidden', !(await page.isVisible('#side .maps')));
  check('phone: the menu button sums up the settings', (await page.textContent('#menuSum')).length > 5, await page.textContent('#menuSum'));
  check('phone: the keyboard stays closed', await is(() => document.activeElement.id !== 'guess'));
  await page.tap('#menuBtn');
  check('drawer opens', await shown('#side .maps'));
  check('behind it is inert', await is(() => $('board').inert && $('panel').inert));
  check('focus goes to Done', await is(() => document.activeElement.id === 'closeMenu'));
  await page.tap('#mapChips button:nth-child(4)');   // Clubhouse
  check('a map picked in the drawer', await is(() => settings.map === 'clubhouse' && drill.q.c.map.id === 'clubhouse'), await is(() => settings.map));
  check('the summary follows', (await page.textContent('#menuSum')).startsWith('Clubhouse'), await page.textContent('#menuSum'));
  await page.tap('[data-mode=pick]');
  const before = await is(() => drill.q.c.key);
  await page.keyboard.press('1');
  check('keys do nothing while it is open', await page.evaluate(k => drill.q.c.key === k && !drill.q.done, before));
  await page.tap('#closeMenu');
  check('Done closes it', await shown('#side .maps', 'hidden') && await is(() => !$('board').inert));
  await page.tap('#menuBtn'); await shown('#side .maps');
  await page.mouse.click(380, 600);   // the dimmed strip right of the drawer
  check('a tap beside it closes it', await shown('#side .maps', 'hidden'));
  await page.tap('#menuBtn'); await shown('#side .maps');
  await page.keyboard.press('Escape');
  check('Escape closes it and focus goes back', await shown('#side .maps', 'hidden') && await is(() => document.activeElement.id === 'menuBtn'));
  check('Pick it works after', await is(() => { drill.q.choose(0); return drill.q.done; }));

  // The plate fills the stage one way and fits it the other, nothing scrolls.
  await page.evaluate(() => {
    window.__fit = () => {
      const st = $('stage').getBoundingClientRect(), pl = $('plate').getBoundingClientRect();
      const f = { sw: Math.round(st.width), sh: Math.round(st.height), pw: Math.round(pl.width), ph: Math.round(pl.height),
        over: $('stage').scrollWidth > $('stage').clientWidth + 1 || $('stage').scrollHeight > $('stage').clientHeight + 1 };
      return { ...f, fits: !f.over && (Math.abs(f.pw - f.sw) <= 1 || Math.abs(f.ph - f.sh) <= 1) };
    };
    window.__sz = 0; const o = plate.size.bind(plate); plate.size = () => { window.__sz++; o(); };
  });
  const fit = () => is(() => window.__fit());
  await page.tap('#menuBtn'); await shown('#side .maps');
  await page.tap('[data-mode=name]'); await page.tap('#closeMenu'); await shown('#side .maps', 'hidden');
  check('phone: the plate fits', await until(page, () => window.__fit().fits), JSON.stringify(await fit()));
  await page.setViewportSize({ width: 1440, height: 900 });
  check('desktop: the plate fits after a resize', await until(page, () => window.__fit().fits), JSON.stringify(await fit()));
  check('desktop: settings in the side column, no menu button', await page.isVisible('#side .maps') && !(await page.isVisible('#menuBtn')));
  await page.waitForTimeout(500);
  const n1 = await is(() => window.__sz); await page.waitForTimeout(800);
  check('no resize loop', await is(() => window.__sz) === n1, `${n1} -> ${await is(() => window.__sz)}`);
  await page.click('#zoomIn');
  check('zoomed in, the plate overflows to scroll', await until(page, () => window.__fit().over), JSON.stringify(await fit()));
  const n2 = await is(() => window.__sz); await page.waitForTimeout(600);
  check('no resize loop when zoomed', await is(() => window.__sz) - n2 <= 1, `${n2} -> ${await is(() => window.__sz)}`);
  await page.click('#zoomOut');
  check('zoomed back out, it fits again', await until(page, () => window.__fit().fits), JSON.stringify(await fit()));

  // The drawer open on a small window that then grows: the menu state is cleared.
  await page.setViewportSize({ width: 900, height: 600 }); await settle(page);
  await page.click('#menuBtn'); await shown('#side .maps');
  await page.setViewportSize({ width: 1600, height: 900 });
  check('menu cleared when the window grows', await until(page, () => !document.body.classList.contains('menu-open') && !$('board').inert));

  await page.evaluate(() => { settings.mode = 'name'; drill.next(); });
  await page.fill('#guess', 'zzzz'); await page.press('#guess', 'Enter');
  const top = await is(() => [$('logList').firstChild.className, $('logList').firstChild.textContent]);
  check('the log shows a miss with what was said', top[0] === 'bad' && top[1].includes('You said “zzzz”'), JSON.stringify(top));
  await settle(page);
  check('desktop: the page itself never scrolls', await is(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth));
});
