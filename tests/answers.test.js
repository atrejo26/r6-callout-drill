// Typed answers: short and long forms both ways, typos, the start of a name, broad names
// (Stalls for Stall 1), what Did you mean offers, and a scan of every callout name with
// a letter dropped, doubled or swapped, which must never count as another callout.
const { isDeepStrictEqual } = require('util');
const { run, open, check, TEST_PAGE } = require('./lib');

// [map, floor, callout asked, typed, what accepts() says]; 'ok' is a typo or the start of the name
const CASES = [
  // short and long forms
  ['fortress', '1F', 'Fountain L H', 'fountain long hallway', 'exact'],
  ['fortress', '1F', 'Fountain L H', 'fountain long hall', 'exact'],
  ['fortress', '1F', 'Fountain L H', 'fountain l h', 'exact'],
  ['fortress', '1F', 'Fountain L H', 'fountain long h', 'exact'],
  ['fortress', '1F', 'Fountain S H', 'fountain short hallway', 'exact'],
  ['fortress', '1F', 'Fountain S H', 'fountain stairs hallway', false],
  ['fortress', '1F', 'Fountain S H', 'fountain long hallway', false],
  ['fortress', '1F', 'Kitch H', 'kitchen hallway', 'exact'],
  ['fortress', '1F', 'Kitch H', 'kitchen hallwy', 'typo'],
  ['fortress', '1F', 'Kitch H', 'kitch h', 'exact'],
  ['fortress', '1F', 'Caf H', 'cafeteria hallway', 'exact'],
  ['villa', '1F', 'Main S', 'main stairs', 'exact'],
  ['villa', '1F', 'Main S', 'main stair', 'exact'],
  ['villa', '1F', 'Main S', 'main s', 'exact'],
  ['villa', '1F', 'Main S', 'main', false],
  ['villa', '1F', 'Main S', 'main short', false],
  ['villa', '1F', 'Back h', 'back hallway', 'exact'],
  ['villa', '1F', 'Back h', 'back s', false],
  ['villa', '1F', 'Back S', 'back stairs', 'exact'],
  ['villa', '1F', 'Piano H long', 'piano hallway long', 'exact'],
  ['chalet', '1F', 'HP', 'harry potter', 'exact'],
  ['chalet', '1F', 'HP', 'hp', 'exact'],
  ['chalet', '2F', 'Sol stairs', 'solar stairs', 'exact'],
  ['chalet', '2F', 'Sol stairs', 'sol stairs', 'exact'],
  ['chalet', '2F', '½ W', 'half wall', 'exact'],
  ['chalet', '2F', '½ W', '1/2 wall', 'exact'],
  ['chalet', '2F', 'Mez', 'mezzanine', 'exact'],
  ['border', '1F', 'S1', 'shower 1', 'exact'],
  ['border', '1F', 'S1', 'showers 1', 'exact'],
  ['border', '1F', 'S1', 's1', 'exact'],
  ['border', '1F', 'S1', 'showers', 'broad'],
  ['border', '1F', 'S1', 'shower 2', false],
  ['border', '1F', 'Stall 2', 'stalls', 'broad'],
  ['border', '1F', 'Stall 2', 'stall 2', 'exact'],
  ['border', '1F', 'L desk', 'long desk', false],
  ['border', '1F', 'L desk', 'l desk', 'exact'],
  ['border', '1F', 'L desk', 'ldesk', 'exact'],
  ['border', '1F', 'Tellers hall', 'tellers hallway', 'exact'],
  ['border', '1F', 'Tellers hall', 'tellers h', 'exact'],
  ['border', '2F', 'B desk', 'break desk', 'exact'],
  ['kafe', '2F', 'Red', 'red', 'exact'],
  ['kafe', '2F', 'Red', 'red cart', 'exact'],
  ['kafe', '2F', 'Red', 'red train cart', 'exact'],
  ['kafe', '2F', 'Red', 'red train', 'exact'],
  ['kafe', '2F', 'Red', 'red trian cart', 'typo'],
  ['kafe', '2F', 'Red', 'red s2', false],
  ['kafe', '2F', 'Red', 'red stairs', false],
  ['kafe', '2F', 'Red', 'train', false],
  ['kafe', '2F', 'Train', 'red train', false],
  ['kafe', '2F', 'Green', 'green cart', 'exact'],
  ['kafe', '2F', 'Green', 'green train cart', 'exact'],
  ['chalet', '1F', 'Long', '45 long', 'exact'],
  ['chalet', '1F', 'Long', 'long', 'exact'],
  ['chalet', '1F', 'Short', 'short 45', 'exact'],
  ['chalet', '1F', 'Short', '45', false],
  ['chalet', '1F', '45', '45', 'exact'],
  ['chalet', '1F', 'Inner', 'inner bar', 'exact'],
  ['chalet', '2F', 'Main stairs', 'main stairs', 'exact'],
  ['chalet', '2F', 'Main stairs', 'main s', 'exact'],
  ['chalet', 'Basement', 'Short', 'short', 'exact'],
  ['clubhouse', '2F', 'Long', 'long hallway', 'exact'],
  ['clubhouse', '2F', 'Long', 'long', 'exact'],
  ['clubhouse', '2F', 'R long', 'long', false],
  ['clubhouse', '2F', 'R long', 'rafters long', 'exact'],
  ['clubhouse', 'Basement', 'Short', 'short h', 'exact'],
  ['clubhouse', '1F', 'Wolf', 'wolf door', 'exact'],
  ['nighthaven', '2F', 'Tools', 'tools', 'exact'],
  ['nighthaven', '2F', 'Tools table', 'tools table', 'exact'],
  ['nighthaven', '2F', 'Tools table', 'table', 'exact'],
  ['nighthaven', '2F', 'Tools', 'tools table', false],
  ['bank', '1F', 'Quad Wall', 'quad wall', 'exact'],
  ['bank', '1F', 'Quad Wall', 'quad', 'partial'],
  ['bank', '1F', 'Light', 'light', 'exact'],
  ['kafe', '3F', 'Cocktail', 'cocktail', 'exact'],
  ['kafe', '3F', 'C1', 'cocktail', 'broad'],
  ['kafe', '3F', 'C2', 'cocktail 2', 'exact'],
  ['kafe', '3F', 'Bar', 'bar', 'exact'],
  ['kafe', '3F', 'West', 'west window', 'exact'],
  ['kafe', '3F', 'Cryo', 'cryo window', 'exact'],
  ['kafe', '1F', 'Kitchen', 'kitchen', 'exact'],
  ['kafe', '1F', 'K1', 'kitchen', 'broad'],
  ['kafe', '1F', 'K2', 'kitchen 2', 'exact'],
  ['lair', '2F', 'R6', 'r6', 'exact'],
  ['lair', '2F', 'Desk', 'mask desk', 'exact'],
  ['lair', '2F', 'Desk', 'desk', 'exact'],
  ['lair', '2F', 'Mask', 'mask', 'exact'],
  ['kafe', '3F', 'Inner', 'inner', 'exact'],
  ['kafe', '3F', 'Inner', 'inner bar', 'exact'],
  ['kafe', '3F', 'Inner', 'inside bar', 'exact'],
  ['kafe', '3F', 'Inner', 'outer bar', false],
  ['kafe', '3F', 'Outer', 'outer bar', 'exact'],
  ['kafe', '3F', 'Outer', 'outside bar', 'exact'],
  ['kafe', '3F', 'Outer', 'outer', 'exact'],
  ['kafe', '3F', 'Outer', 'inner bar', false],
  ['kafe', '3F', 'Outer', 'bar', false],
  ['kafe', '2F', 'Red S2', 'red stairs', 'broad'],
  ['kafe', '2F', 'Red Hall 2F', 'red hall 2f', 'exact'],
  ['border', '2F', 'B desk', 'b desk', 'exact'],
  ['border', '2F', 'B desk', 'brake desk', 'typo'],
  ['border', '2F', 'B desk', 'break', false],
  ['border', '2F', 'Break', 'break', 'exact'],
  ['border', '2F', 'CC', 'cc', 'exact'],
  ['border', '2F', 'CC', 'cctv', false],
  ['chalet', '2F', '½ W', 'half w', 'exact'],
  ['chalet', '2F', 'P ½ W', 'piano half wall', 'exact'],
  ['chalet', '1F', 'Half wall', '1/2 w', 'exact'],
  ['clubhouse', '1F', 'J Box', 'jukebox', 'exact'],
  ['clubhouse', '1F', 'J Box', 'juke box', 'exact'],
  ['clubhouse', '1F', 'J Box', 'j box', 'exact'],
  ['clubhouse', '1F', 'Kitch H', 'kitchen hallway', 'exact'],
  ['clubhouse', '2F', 'B2', 'bathroom 2nd floor', 'exact'],
  ['clubhouse', '2F', 'B2', 'bathroom second floor', 'exact'],
  ['clubhouse', '2F', 'B2', '2nd floor bathroom', 'exact'],
  ['clubhouse', '2F', 'B2', 'b2', 'exact'],
  ['clubhouse', '2F', 'R short', 'rafters short', 'exact'],
  ['clubhouse', '2F', 'R90', 'rafters 90', 'exact'],
  ['clubhouse', '2F', 'R90', 'rafter 90', 'exact'],
  ['clubhouse', '2F', 'Logi', 'logistics', 'exact'],
  ['bank', 'Basement', 'E1', 'elevator 1', 'exact'],
  ['bank', '1F', 'E2 Hall', 'elevator 2 hallway', 'exact'],
  ['bank', '1F', 'E2 Hall', 'e2 h', 'exact'],
  ['bank', '1F', 'Sqr Stairs', 'square stairs', 'exact'],
  ['bank', '2F', 'E3', 'elevator 3', 'exact'],
  ['kafe', '3F', 'C1', 'cocktail 1', 'exact'],
  ['kafe', '3F', 'C1', 'coctail 1', 'typo'],
  ['kafe', '3F', 'F2', 'freezer 2', 'exact'],
  ['kafe', '2F', 'P1', 'pillar 1', 'exact'],
  ['kafe', '1F', 'K3', 'kitchen 3', 'exact'],
  ['kafe', '1F', 'K3', 'kitchen 2', false],
  ['kafe', '1F', 'Red S1', 'red stairs 1', 'exact'],
  ['kafe', '1F', 'Red S1', 'red stairs', 'broad'],
  ['kafe', '1F', 'Recep', 'reception', 'exact'],
  ['kafe', '3F', 'New balc', 'new balcony', 'exact'],
  ['nighthaven', '2F', 'E-Box', 'electrical box', 'exact'],
  ['lair', '2F', 'Ops Wall', 'operations wall', 'exact'],
  ['nighthaven', '2F', 'E-Box', 'electric box', 'exact'],
  ['nighthaven', '2F', 'E-Box', 'ebox', 'exact'],
  ['border', '1F', 'Detention', 'jail', 'exact'],
  ['border', '1F', 'Bathroom', 'bathrom', 'typo'],
  ['chalet', '2F', 'P ½ W', 'p half wall', 'exact'],
  ['chalet', '2F', 'P ½ W', 'piano ½ w', 'exact'],
  ['chalet', '2F', 'P ½ W', 'piano', false],
  ['chalet', '2F', 'P ½ W', 'half wall', false],
  ['chalet', '2F', '½ W', 'piano half wall', false],
  ['clubhouse', '2F', 'Con', 'construction', 'exact'],
  ['clubhouse', '2F', 'Con', 'con', 'exact'],
  ['villa', '2F', 'Triple w', 'triple wall', 'exact'],
  ['villa', '2F', 'Triple w', 'triple w', 'exact'],
  ['nighthaven', '1F', 'S1', 'storage 1', 'exact'],
  ['nighthaven', '1F', 'S2', 'storage 2', 'exact'],
  ['nighthaven', '1F', 'S1', 'storage', 'broad'],
  ['nighthaven', '1F', 'S1', 'storage 2', false],
  ['nighthaven', '1F', 'Storage', 'storage', 'exact'],
  ['nighthaven', '2F', 'Connector', 'connector', 'exact'],
  ['nighthaven', '2F', 'CC', 'command center', 'exact'],
  ['nighthaven', '2F', 'CC', 'cc', 'exact'],
  ['nighthaven', '2F', 'R1', 'rafters 1', 'exact'],
  ['nighthaven', '2F', 'R3', 'rafter 3', 'exact'],
  ['nighthaven', '2F', 'R2', 'rafters', 'broad'],
  ['nighthaven', '2F', 'R2', 'rafters 1', false],
  ['bank', 'Basement', 'CC', 'cctv', 'exact'],
  ['bank', 'Basement', 'CC', 'cc', 'exact'],
  ['kafe', '1F', 'Red Hall 1F', 'red hall 1f', 'exact'],
  ['kafe', '1F', 'Red Hall 1F', 'red hall', 'exact'],  // the floor tag can be left off
  ['kafe', '1F', 'Red Hall 1F', 'red hallway', 'exact'],
  ['kafe', '1F', 'Red Hall 1F', 'red h', 'exact'],
  ['kafe', '1F', 'Red Hall 1F', 'red hall 2f', false],
  ['kafe', '1F', 'Red S1', 'red h', false],  // that's Red Hall 1F
  ['kafe', '2F', 'Red Hall 2F', 'red hall', 'exact'],
  ['kafe', '2F', 'Red', 'red h', false],  // that's Red Hall 2F
  ['kafe', '1F', 'Red S1', 'red 1', false],
  ['kafe', '2F', 'R90', 'red 90', 'exact'],
  ['kafe', '3F', 'B1', 'box 1', 'exact'],
  ['kafe', '3F', 'B2', 'box 2', 'exact'],
  ['kafe', '3F', 'B2', 'box 1', false],
  ['lair', 'Basement', 'L1', 'lab 1', 'exact'],
  ['lair', 'Basement', 'L2', 'labs 2', 'exact'],
  ['lair', 'Basement', 'L3', 'lab', 'broad'],
  ['lair', 'Basement', 'Lab', 'lab', 'exact'],
  ['lair', 'Basement', 'Filtration', 'filtration', 'exact'],
  ['lair', 'Basement', 'Filtration Stairs', 'filtration s', 'exact'],
  ['lair', '2F', 'Bathroom 2', 'bathroom 2', 'exact'],
  ['lair', '2F', 'Bath Hall 2', 'bath hallway 2', 'exact'],
  ['lair', '1F', 'Briefing', 'breifing', 'typo'],
  // short <-> long, both directions
  ['chalet', '1F', 'Kitchen', 'kitch', 'exact'],
  ['chalet', '2F', 'Square', 'sqr', 'exact'],
  ['chalet', '2F', 'Solar', 'sol', 'exact'],
  ['chalet', '2F', 'Mez', 'mezz', 'exact'],
  ['lair', '2F', 'Mezz', 'mez', 'exact'],
  ['lair', '2F', 'Operation', 'ops', 'exact'],
  ['fortress', '2F', 'Dorm H', 'dorm hallway', 'exact'],
  ['nighthaven', '2F', 'Blue Hall', 'blue h', 'exact'],
  ['kafe', '3F', 'C2', 'cocktail', 'broad'],
  ['kafe', '3F', 'C2', 'c3', false],
  ['kafe', '3F', 'C2', 'coktail', 'broad'],
  ['border', '1F', 'Showers', 'showrs', 'typo'],
  ['border', '1F', 'Small', 'smal', 'ok'],
  // typos, now in short forms too
  ['fortress', '1F', 'Kitch H', 'kitchn h', 'typo'],
  ['fortress', '1F', 'Kitch H', 'ktich h', 'typo'],
  ['villa', '1F', 'Back h', 'bakc h', 'typo'],
  ['villa', '1F', 'Back h', 'backx', false],  // as close to Back S
  ['bank', '2F', 'Achieved', 'acheived', 'typo'],  // swapped letters
  ['border', '1F', 'Detention', 'detnetion', 'typo'],
  ['border', '1F', 'Passport', 'pasport', 'typo'],
  ['border', '1F', 'Tellers hall', 'tellers hal', 'ok'],
  ['border', '1F', 'Tellers hall', 'tellr', false],  // that's Tellers
  ['border', '1F', 'S1', 'showrs', 'broad'],
  ['border', '1F', 'Stall 1', 'stal 1', 'ok'],
  ['border', '1F', 'Stall 1', 'stall 2', false],
  ['clubhouse', 'Basement', 'Box 1', 'box 2', false],
  ['clubhouse', '1F', 'Lockers', 'lockrs', 'typo'],
  ['kafe', '3F', 'Shaiiko', 'shaiko', 'typo'],
  ['kafe', '3F', 'Shaiiko', 'shiko', false],  // two letters off in 7
  // partial answers
  ['border', '1F', 'Detention', 'det', 'partial'],
  ['border', '1F', 'Passport', 'pass', 'partial'],
  ['border', '1F', 'Customs', 'cust', 'partial'],
  ['border', '1F', 'Tellers hall', 'tell', false],  // Tellers too
  ['border', '1F', 'Tellers hall', 'tellers', false],  // that's Tellers
  ['border', '1F', 'Stall 1', 'stall', 'broad'],
  ['border', '1F', 'Stall 1', 'sta', false],
  ['border', '2F', 'Books Door', 'boo', false],  // Boost too
  ['border', '2F', 'Books Door', 'book', 'ok'],
  ['villa', '1F', 'Piano H long', 'piano long', 'ok'],
  ['villa', '1F', 'Piano H long', 'piano h', false],  // Piano H short too
  ['villa', '1F', 'Greenhouse', 'green', 'partial'],
  ['villa', '1F', 'Greenhouse', 'gr', false],
  ['fortress', '1F', 'Gun Room H', 'gun h', 'partial'],
  ['fortress', '1F', 'Fountain L H', 'fountain l', 'partial'],
  ['fortress', '1F', 'Fountain L H', 'fountain h', false],
  ['clubhouse', 'Basement', 'Bottom Central', 'bottom', 'partial'],
  ['kafe', '1F', 'Red S1', 'red', false],  // the start of Red Hall 1F; the stairs need their S
  ['kafe', '3F', 'Deep freezer', 'deep', 'partial'],
  ['kafe', '2F', 'Red S2', 'red s', 'broad'],
  ['kafe', '2F', 'Red', 'red s', false],  // that's the Red stairs
  ['chalet', '1F', 'Log', 'logg', false],  // Log or Long: asks,
  ['chalet', '1F', 'Long', 'logg', false],
  ['lair', '2F', 'Z Hall', 'b hall', false],  // first letter wrong
  ['fortress', '1F', 'Caf', 'cafe', false],  // Caf or Caf H (Cafe-teria): asks
  ['fortress', '1F', 'Caf', 'cfa', 'typo'],
  ['fortress', '1F', 'Caf', 'cag', false],
];

// [map, floor, callout asked, typed, the callouts Did you mean offers, in order]
const OFFERS = [
  ['chalet', '1F', 'Long', 'logg', ['Long', 'Log']],
  ['chalet', '1F', 'Log', 'logg', ['Long', 'Log']],
  ['fortress', '1F', 'Caf', 'cafe', ['Caf', 'Caf H']],
  ['kafe', '3F', 'Shaiiko', 'shiko', ['Shaiiko']],
  ['villa', '1F', 'Piano', 'pian', ['Piano', 'Piano H short', 'Piano H long']],
  ['villa', '1F', 'Piano H long', 'piano h', ['Piano H short', 'Piano H long', 'Piano']],
  ['border', '1F', 'Tellers', 'teller', ['Tellers', 'Tellers hall']],
  ['lair', '2F', 'Z Hall', 'b hall', ['Z Hall']],
  ['fortress', '1F', 'Caf', 'cag', ['Caf', 'Caf H']],
  ['kafe', '3F', 'C1', 'coktail', []],             // broad for C1-3, not a callout
  ['border', '1F', 'Detention', 'detnetion', []],  // a clear typo: just counts
  ['border', '1F', 'Detention', 'tellers', []],    // a real callout: just wrong
  ['border', '1F', 'Detention', 'zzzz', []],
];

run(async browser => {
  const page = await open(browser, TEST_PAGE);
  const text = sel => page.textContent(sel);

  const wrong = await page.evaluate(cases => cases.map(([m, f, n, typed, want]) => {
    const c = ALL.find(c => c.map.id === m && c.floor.name === f && c.name === n);
    if (!c) return `no callout ${m} ${f} ${n}`;
    const got = c.accepts(typed);
    return (want === 'ok' ? got === 'typo' || got === 'partial' : got === want) ? null : `${m} ${f} ${n} <- "${typed}": got ${got}, want ${want}`;
  }).filter(Boolean), CASES);
  check(`${CASES.length} typed answers`, !wrong.length, '\n  ' + wrong.join('\n  '));

  const offers = await page.evaluate(cases => cases.map(([m, f, n, typed, want]) => {
    const c = ALL.find(c => c.map.id === m && c.floor.name === f && c.name === n);
    if (!c) return `no callout ${m} ${f} ${n}`;
    const got = c.floor.suggestions(typed).map(o => o.name);
    return got.join('|') === want.join('|') ? null : `${m} ${f} "${typed}": offered [${got}], want [${want}]`;
  }).filter(Boolean), OFFERS);
  check(`${OFFERS.length} Did you mean offers`, !offers.length, '\n  ' + offers.join('\n  '));

  const shared = await page.evaluate(() => {
    const out = [];
    for (const m of MAPS) for (const f of m.floors) {
      const seen = new Map();
      for (const c of f.callouts) for (const [t] of c.forms) {
        const o = seen.get(t);
        if (o && o.ck !== c.ck) out.push(`${m.id} ${f.name}: "${t}" is ${o.name} and ${c.name}`);
        else seen.set(t, c);
      }
    }
    return out;
  });
  check('no two callouts on a floor share an answer', !shared.length, '\n  ' + shared.join('\n  '));

  // Each callout name with a letter dropped (not the first: a wrong first letter never
  // counts), doubled or swapped, or cut short. Counting as a callout it could equally be
  // a misspelling of is fine (stall: Stall 1 or Stalls), and so is typing exactly
  // another callout's answer (the start of Green stairs is Green).
  const scan = await page.evaluate(() => {
    const out = [];
    let variants = 0, accepted = 0;
    for (const m of MAPS) for (const f of m.floors) {
      const uniq = f.unique;
      // each misspelling -> the callouts it came from; its compact form -> all the callouts it could misspell
      const from = new Map(), srcs = new Map();
      for (const o of uniq) {
        const n = o.name.toLowerCase(), vs = new Set();
        for (let i = 3; i < n.length; i++) vs.add(n.slice(0, i));
        for (let i = 0; i < n.length; i++) {
          if (i) vs.add(n.slice(0, i) + n.slice(i + 1));
          vs.add(n.slice(0, i) + n[i] + n.slice(i));
          if (i + 1 < n.length) vs.add(n.slice(0, i) + n[i + 1] + n[i] + n.slice(i + 2));
        }
        for (const v of vs) if (compact(v)) { from.set(v, [...from.get(v) || [], o]); srcs.set(compact(v), [...srcs.get(compact(v)) || [], o]); }
      }
      for (const [v, mine] of from) {
        const g = compact(v), hits = uniq.filter(c => c.accepts(v)), could = srcs.get(g);
        variants += mine.length; accepted += mine.filter(o => hits.includes(o)).length;
        const other = hits.filter(c => !could.includes(c) && !c.isExact(g) && !c.isBroad(g) && !could.some(o => c.covers(o)));
        if (other.length) out.push(`${m.id} ${f.name}: "${v}" (from ${mine.map(o => o.name).join(', ')}) taken as ${other.map(c => c.name + '/' + c.accepts(v)).join(', ')}`);
      }
    }
    return { out, variants, accepted };
  });
  check('no misspelt name counts as another callout', !scan.out.length, '\n  ' + scan.out.join('\n  '));
  check('most misspelt names still count', scan.variants > 5000 && scan.accepted > 0.8 * scan.variants, `${scan.accepted} of ${scan.variants}`);

  // Border 1F: Stalls covers Stall 1 and Stall 2.
  const stalls = await page.evaluate(() => {
    const s1 = ALL.find(c => c.name === 'Stall 1'), all = ALL.find(c => c.name === 'Stalls' && c.map.id === 'border');
    return { '1': s1.accepts('1'), 'stall 1': s1.accepts('stall 1'), 'stalls 1': s1.accepts('stalls 1'), stalls: s1.accepts('stalls'),
      stall: s1.accepts('stall'), 'stall 2': s1.accepts('stall 2'), 'Stalls/stalls': all.accepts('stalls'), 'Stalls/stall 1': all.accepts('stall 1'), covers: s1.covers(all) };
  });
  check('Stall 1 and Stalls', isDeepStrictEqual(stalls, { '1': 'exact', 'stall 1': 'exact', 'stalls 1': 'typo', stalls: 'broad',
    stall: 'broad', 'stall 2': false, 'Stalls/stalls': 'exact', 'Stalls/stall 1': false, covers: true }), JSON.stringify(stalls));

  await page.evaluate(() => drill.ask(ALL.find(c => c.name === 'Stall 1')));
  await page.fill('#guess', 'stalls'); await page.press('#guess', 'Enter');
  const fb = await text('#fb'), score = await text('#sScore');
  check('name it: Stalls for Stall 1 counts and names the spot', fb === 'Accepted. More specific: Stall 1.' && score === '1/1', `${fb} | ${score}`);

  await page.click('[data-mode=pick]');
  const picks = await page.evaluate(() => Array.from({ length: 30 }, () => {
    drill.ask(ALL.find(c => c.name === 'Stall 1')); return drill.q.opts.map(o => o.name);
  }));
  check('pick it: four choices, Stall 1 among them, never Stalls', picks.every(o => o.length === 4 && o.includes('Stall 1') && !o.includes('Stalls')), JSON.stringify(picks.slice(0, 3)));

  await page.evaluate(() => { settings.pool = 'all'; });
  await page.click('[data-mode=find]');
  const found = await page.evaluate(() => {
    drill.ask(ALL.find(c => c.name === 'Stalls' && c.map.id === 'border'));
    const s2 = ALL.find(c => c.name === 'Stall 2'); drill.q.tap({ x: plate.x(s2), y: plate.y(s2) }); return $('fb').textContent;
  });
  check('find it: a tap on Stall 2 is in Stalls', found === 'Correct.', found);
});
