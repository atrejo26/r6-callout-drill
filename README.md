# R6 Callout Drill

A trainer for Rainbow Six Siege callouts on the Pro League map pool: Border, Chalet,
Clubhouse, Villa, Nighthaven Labs, Fortress, Bank, Kafe Dostoyevsky and Lair.

**Play it in your browser: https://atrejo26.github.io/r6-callout-drill/** (no download).
It updates whenever `index.html` changes on main.

Callout names and positions come from Paltry's R6 Map Call Sheets (FireBirds), 594 callouts
across 25 floors. Each floor shows the in-game map from [R6Calls](https://www.r6calls.com) (labels,
line-of-sight walls and line-of-sight floors off) with the call sheet's callouts
aligned onto it. Use the **In-game / Call sheet** button to switch to the call-sheet line plan.

## Modes

- **Name it**: a spot is marked; type its callout. The call sheet's short form and the full
  name both count, in any mix (`Kitch H`, `Kitchen Hallway`, `kitchen h`), and small typos
  in full words are forgiven. Set **Answer** to **Callout pool** to pick the name from a bank
  of every callout on the map (A to Z) instead of typing it.
- **Pick it**: a spot is marked; choose from four callouts on the same map (keys 1 to 4).
- **Find it**: you get a callout; tap where it is on the floor.
- **Study**: every callout on a floor. Hide the names and tap dots to test yourself.

When an answer is revealed, an abbreviated callout also shows its full name.

### Abbreviations

| Short | Full | Where |
|---|---|---|
| H | Hallway | all maps (`Kitch H`, `Fountain L H`) |
| L / S | Long / Short | `Fountain L H`, `Fountain S H`, `L desk` |
| S | Stairs, after a word | `Main S`, `Red S1` (Red Stairs 1) |
| HP | Harry Potter (under the stairs) | all maps |
| S1, S2 | Shower 1, Shower 2 | Border 1F (`Showers` also counts) |
| Sol | Solar | Chalet |
| J Box | Juke Box | Clubhouse |
| B2 | Bathroom 2nd floor | Clubhouse |
| R | Rafters | Clubhouse (`R long`, `R90`) |
| E1-E3 | Elevator 1-3 | Bank |
| C, F, P, K | Cocktail, Freezer, Pillar, Kitchen | Kafe (`C1`, `F2`, `P1`, `K3`) |
| Kitch, Sqr, Caf, Mez, Recep, balc, Logi, Ops, E box, ½ W, DMZ | Kitchen, Square, Cafeteria, Mezzanine, Reception, Balcony, Logistics, Operations, Electrical box, Half wall, Dead Man Zone | where they appear |

The table lives in `tools/abbrev.py`; names it doesn't cover are only accepted as written.

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

Pushing a tag like `v1.0.1` makes GitHub Actions build the exe on Windows and attach it
to a release.

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

In-game floor maps are R6Calls' work (https://www.r6calls.com), built on Ubisoft's maps. This is an
unofficial fan tool.
