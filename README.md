# R6 Callout Drill

A trainer for Rainbow Six Siege callouts on the Pro League map pool: Border, Chalet,
Clubhouse, Villa, Nighthaven Labs, Fortress, Bank, Kafe Dostoyevsky and Lair.

**Play it in your browser: https://atrejo26.github.io/r6-callout-drill/** (no download).
It updates whenever `index.html` changes on main, once the tests pass.

Callout names and positions come from Paltry's R6 Map Call Sheets (FireBirds), with some
renamed, added or removed by hand: 563 callouts across 25 floors. Each floor shows the in-game map from [R6Calls](https://www.r6calls.com) (labels,
line-of-sight walls and line-of-sight floors off) with the call sheet's callouts
aligned onto it. Use the **In-game / Call sheet** button to switch to the call-sheet line plan.

## Modes

- **Name it**: a spot is marked; type its callout. The call sheet's short form and the full
  name both count, in any mix (`Kitch H`, `Kitchen Hallway`, `kitchen h`, `Kitch` for
  `Kitchen`). So do small typos (`Kitchn H`, `Achived` for `Achieved`) and the start of a name
  (`Det` for `Detention`, `Piano long` for `Piano H long`), as long as they point at one
  callout on the floor. When an answer could be several callouts (`logg`: Log or Long) or
  is just past what counts, you get **Did you mean** with the closest ones to pick from,
  or keep your answer as typed. Set **Answer** to **Callout pool** to pick the name from a
  bank of every callout on the map (A to Z) instead of typing it.
- **Pick it**: a spot is marked; choose from four callouts on the same map (keys 1 to 4).
- **Find it**: you get a callout; tap where it is on the floor. A tap anywhere in the
  callout's outlined area counts, and the answer shows that area. With **Main rooms** as
  the pool each room's area is the whole room; when spots are in the pool, a main room's
  area is what's left around its label once its spots are taken out.
- **Study**: every callout on a floor. Hide the names and tap dots to test yourself.

When an answer is revealed, an abbreviated callout also shows its full name.

The map list shows how many callouts you have mastered on each map (your latest answer
for it was right). Progress stays in your browser, filed under each callout's id, so it
stays with a callout that is renamed or moved; `src/old_keys.json` carries progress saved
by earlier releases over to the ids. **This session** lists every answer, newest first,
with what you said when you missed.

**Full report**, next to the map list, shows your progress on every map: callouts
mastered, main rooms and spots, answers and how many were right, and the callouts you
missed most, with **Practice my misses**. To share it, add a name if you like, then use
**Share…** (where your device has a share sheet), **Copy report** (a few lines of text
and a link) or **Copy link**. The link opens the web app on a read-only copy of the
report, and **See what they'll see** previews it. Opening someone's link never changes
your own progress.

The page fills the window. On a desktop the settings sit in a column on the left; on
tablets and phones they open from the menu button at the top, so the map and the question
get the screen. On phones the map runs edge to edge and the keyboard only opens when you
tap the answer box.

### Abbreviations

| Short | Full | Where |
|---|---|---|
| H | Hallway | all maps (`Kitch H`, `Fountain L H`) |
| L / S | Long / Short | `Fountain L H`, `Fountain S H` |
| S | Stairs, after a word | `Main S`, `Red S1` (Red Stairs 1) |
| HP | Harry Potter (under the stairs) | all maps |
| S1, S2 | Shower 1, Shower 2 | Border 1F (`Showers` also counts) |
| B desk | Break desk | Border 2F |
| Sol, P ½ W | Solar, Piano Half Wall | Chalet |
| J Box, Con | Juke Box, Construction | Clubhouse |
| B2 | Bathroom 2nd floor | Clubhouse |
| R | Rafters | Clubhouse (`R long`, `R90`) |
| Triple w | Triple Wall | Villa |
| S1, S2 | Storage 1, Storage 2 | Nighthaven 1F (`Storage` also counts) |
| R1-R3, CC | Rafters 1-3, Command Center | Nighthaven (`Rafters` also counts for R1-R3) |
| E1-E3, CC | Elevator 1-3, CCTV | Bank |
| C, F, P, K, R, B | Cocktail, Freezer, Pillar, Kitchen, Red, Box | Kafe (`C1`, `F2`, `P1`, `K3`, `R90`, `B1`; `Cocktail` also counts for C1-C3) |
| L1-L3 | Lab 1-3 | Lair (`Lab` also counts for L1-L3) |
| Kitch, Sqr, Caf, Mez, Recep, balc, Logi, Ops, E-box, ½ W | Kitchen, Square, Cafeteria, Mezzanine, Reception, Balcony, Logistics, Operations, Electrical box, Half wall | where they appear |

Some names aren't short for anything and stay as written: `L desk` and `J desk` (the
desk's shape), `CC` on Border, `K9`, `AK`, `R6` on Lair, and `Emo` and `Achieved` (named
after pro players). `½ W` was shortened to fit the call sheet; the usual answer is `Half wall`,
and either one counts, typed or picked.

On Kafe 2F, `Red` and `Green` are the red and green train carts in Train, not the red
stairs. The app says "train cart" next to them wherever they're asked for or offered, and
`Red cart`, `Red train` and `Red train cart` (and the same for Green) count too. On Kafe 3F,
`Inner` and `Outer` are Inner bar and Outer bar, the inside and outside of the bar;
`Inner bar`, `Inside bar`, `Outer bar` and `Outside bar` count too. `Red Hall 1F` and
`Red Hall 2F` count without the floor (`Red hall`, `Red H`), since the floor is already
known; so on 1F, `Red` alone is the start of Red Hall, and the red stairs need their S
(`Red S`, `Red stairs`).

It works both ways: a name written out also takes its short form (`Kitch` for `Kitchen`,
`Sqr` for `Square`, `Ops` for `Operation`, `½ W` for `Half Wall`). The table lives in
`tools/abbrev.py`; names it doesn't cover are only accepted as written (or nearly).

Pools: **Main rooms** (bold on the call sheet), **Rooms + spots**, **Spots only**, and
**My misses** (callouts you last got wrong). Callouts you miss come up more often.
Progress is stored locally on your machine.

## Run it

- **Windows**, two builds, both portable (nothing to install):
  - `R6-Callout-Drill-Lite.exe` (about 6 MB) opens the app in its own Microsoft Edge app
    window (Chrome or your default browser if Edge is missing). Progress is kept in
    `%LOCALAPPDATA%\R6CalloutDrill`.
  - `R6-Callout-Drill-<version>.exe` (about 75 MB) is a full Electron app with its own
    browser engine.

  Get them from Releases or the latest *Build Windows app* workflow run. Both are
  unsigned, so Windows SmartScreen may ask you to confirm (More info → Run anyway).
- **Any browser**: open `index.html`. It is a single self-contained file that works offline.
- **From source**: `npm install` then `npm start`.

## Build

```sh
npm install
npm run dist:win          # dist/R6-Callout-Drill-<version>.exe (works from Linux too)
npm run dist:lite         # dist/R6-Callout-Drill-Lite.exe (needs Go)
```

Pushing a tag like `v1.0.1` makes GitHub Actions run the tests, then build both exes on
Windows and attach them to a release. Running *Build Windows app* by hand does the same
without the release.

## Tests

```sh
npm install
npx playwright install chromium   # once
npm test                          # or: npm test -- answers progress
```

`npm test` rebuilds the pages and fails if `index.html` was out of date with `src/`, then
runs each `tests/*.test.js` in Chromium (it needs Python 3 for the build):

- `answers`: hundreds of typed answers (short and full forms, typos, the start of a
  name), Did you mean offers, no two callouts on a floor sharing an answer, and thousands
  of misspellings, none of which may count for the wrong callout
- `didyoumean`, `pool`: choosing from Did you mean and from the callout pool, hints and
  reveals, settings kept after a reload
- `zones`: in Find it, a tap on every callout's label counts, and a wrong tap names what
  you tapped
- `layout`: the desktop and phone layouts, the menu, zooming, nothing scrolling sideways
- `progress`: old progress carried over, the update note, the report and sharing it, and
  shared links, well formed or damaged
- `secure`: the app code out of the console's reach, the Content Security Policy, the
  answer kept out of the page, damaged saves, no network requests

Screenshots go to `test-results/`. GitHub Actions runs the tests on every push to a
branch other than main (*Tests*), before publishing the web app (*Publish web app*) and
before building the exes (*Build Windows app*): if any test fails, nothing is published
or built.

## Security

- The page loads nothing from the network: data, floor images and fonts are inside
  `index.html`. Its Content Security Policy runs only its own script and style (by hash)
  and allows images and fonts only from inside the file, so nothing injected can run
  or send anything anywhere.
- The app's code sits in one block, out of reach of the browser console, and the
  answer isn't in the page until you've answered. That stops casual cheating from dev
  tools; it can't stop someone reading the page source, which is true of any app that
  runs entirely in the browser. Scores live only in your own browser and go nowhere unless you share a report.
- Saved progress is checked on load; anything unexpected is dropped, not trusted.
- A shared report link carries only the report's numbers and the name, after the `#`, so
  it never reaches the web server. The app shows it only if every part is well formed and
  the numbers add up, shows the name as plain text, and saves none of it.
- The Electron app runs sandboxed with no Node access, can't navigate away from the
  page, and only hands `https://` links to your browser.

`python3 -I tools/build.py --test test-results/test.html` writes a copy with the app code
reachable, for the tests.

## Rebuilding the data

`index.html` is generated; edit `src/template.html` and run the tools with Python 3
(`python-pptx`, `pdfplumber`, `Pillow`, `numpy`, `opencv-python-headless`) and LibreOffice:

```sh
soffice --headless --convert-to pdf "Paltrys_R6_Map_Call_Sheets.pptx"
python3 tools/extract.py "Paltrys_R6_Map_Call_Sheets.pptx" "Paltrys_R6_Map_Call_Sheets.pdf" src
python3 tools/r6calls.py work                  # download + render R6Calls floors (Node + Playwright)
python3 tools/align.py      work/floors src    # fit call-sheet plans onto the in-game floors
python3 tools/game_views.py work/floors src    # in-game crops + callout positions
python3 tools/build.py                         # expand abbreviations, inline everything
```

`align.py` and `game_views.py` take any folder with one subfolder per map holding
`floor-<floor>.png` images, or Ubisoft's `r6-maps-<map>-blueprint-N.jpg` files.

- `extract.py` places each callout where its text is drawn on the slide (read from the
  PDF), not at the centre of its text box: the deck's boxes are left-aligned,
  top-anchored and often much bigger than the word.
- `align.py` fits each call-sheet plan onto Ubisoft's blueprint for that floor, with
  separate horizontal and vertical scales because some deck images are stretched (Border
  1F is about 10% taller than the game). It writes `src/alignment.json`. Ubisoft's images
  are numbered lowest floor first except Villa (#2 is an empty level) and Bank (1F, 2F,
  Basement, Roof); `ASSIGN` in the script records those. A floor marked
  `"rejected": true` in `alignment.json` keeps only the call-sheet view.
- Screenshots can replace Ubisoft's blueprints: `tools/split_panels.py shot.png <dir>/bank
  Basement 1F 2F -` splits a 2x2 picture of a map's floors into `floor-<name>.png` files,
  which `align.py` and `game_views.py` use instead of the blueprints when present.
- `game_views.py` crops the blueprints and places each callout with its floor's fit, then
  nudges it to line up with the walls right around it, for places where the call sheet is
  drawn a little differently from the game (the north end of Lair 1F). A nudge is kept
  only when it clearly improves the local match and two or more nearby callouts agree.
  A few spots it can't settle are corrected by hand in `MANUAL` in the same script.

### Callout areas

Each callout's outlined area (`zone`, and `room_zone` for a main room's whole room) and
the hand-made renames, moves, additions and deletions come from the area editor, not from
the deck: re-running `extract.py` would lose them.

```sh
pip install shapely
python3 -I tools/area_tool.py src tools/area_tool.html areas.html   # the editor page
python3 -I tools/apply_areas.py <saved floors dir> src/callouts.json
```

The editor saves one document per floor (`<map>.<floor>.json`). `apply_areas.py`
writes them into `callouts.json`. Where outlines overlap, an outline mostly inside
another one (a spot in its room) keeps its shape and is cut out of the bigger one;
other overlaps are split halfway between the two labels. A label left outside its own
area moves into it.

In-game floor maps are R6Calls' work (https://www.r6calls.com), built on Ubisoft's maps. This is an
unofficial fan tool.
