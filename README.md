# R6 Callout Drill

A trainer for Rainbow Six Siege callouts on the Pro League map pool: Border, Chalet,
Clubhouse, Villa, Nighthaven Labs, Fortress, Bank, Kafe Dostoyevsky and Lair.

Callout names and positions come from Paltry's R6 Map Call Sheets (FireBirds), 594 callouts
across 25 floors. Each floor shows Ubisoft's in-game blueprint with the call sheet's callouts
aligned onto it. Use the **In-game / Call sheet** button to switch to the call-sheet line plan.

## Modes

- **Name it**: a spot is marked; type its callout. Small typos are accepted, and shorthand
  like `H` = hall, `S` = stairs, `W` = wall works both ways (`Kitch H` = `kitchen hall`).
- **Pick it**: a spot is marked; choose from four callouts on the same map (keys 1 to 4).
- **Find it**: you get a callout; tap where it is on the floor.
- **Study**: every callout on a floor. Hide the names and tap dots to test yourself.

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
python3 tools/align.py      <ubisoft-blueprints-dir> src   # fit plans onto blueprints
python3 tools/game_views.py <ubisoft-blueprints-dir> src   # in-game crops + positions
python3 tools/build.py                                     # inline everything into index.html
```

- `extract.py` places each callout where its text is drawn on the slide (read from the
  PDF), not at the centre of its text box: the deck's boxes are left-aligned,
  top-anchored and often much bigger than the word.
- `align.py` fits each call-sheet plan onto Ubisoft's blueprint for that floor, with
  separate horizontal and vertical scales because some deck images are stretched (Border
  1F is about 10% taller than the game). It writes `src/alignment.json`. Ubisoft's images
  are numbered lowest floor first except Villa (#2 is an empty level) and Bank (1F, 2F,
  Basement, Roof); `ASSIGN` in the script records those. A floor marked
  `"rejected": true` in `alignment.json` keeps only the call-sheet view.
- `game_views.py` crops the blueprints and places each callout with its floor's fit, then
  nudges it to line up with the walls right around it, for places where the call sheet is
  drawn a little differently from the game (the north end of Lair 1F). A nudge is kept
  only when it clearly improves the local match and two or more nearby callouts agree.

Floor plan imagery is Ubisoft's. This is an unofficial fan tool.
