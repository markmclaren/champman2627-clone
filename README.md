# Championship Manager 26/27 — Standalone Web Edition

An unofficial, fully reconstructed 2026/27 edition of Championship Manager running **100% in pure JavaScript** in your web browser.

Originally hosted at `champman2627.co.uk`, the site went offline and portions of the client-side engine and web assets were recovered from the [Internet Archive's Wayback Machine](https://web.archive.org/web/*/https://www.champman2627.co.uk/*). This standalone package recreates the **Quick Season** engine and the entire 2026/27 modern database with zero external dependencies, no DOS emulators, and no tracking.

The underlying 2026/27 player, club, and league data is sourced from **[Championship Manager 26/27 Edition Dicaprio ProductionZ](https://swos21z.itch.io/championship-manager-2627)**.

---

## Quick Start

The game is ready to run locally or host directly via GitHub Pages (using the `docs/` folder).

Because modern browsers restrict cross-origin `fetch()` requests when opening HTML files directly via the `file://` protocol, serve the `docs/` directory using any lightweight local web server.

### Option 1: Python (Recommended)
From this repository folder:
```bash
python -m http.server 8080 --directory docs
```
*(or `cd docs && python -m http.server 8080`)*

Then navigate to: **[http://localhost:8080](http://localhost:8080)**.

### Option 2: Node.js / npx
```bash
npx serve docs
```

### Option 3: GitHub Pages
In your repository settings on GitHub:
1. Navigate to **Settings > Pages**.
2. Under **Build and deployment**, select **Source: Deploy from a branch**.
3. Select branch **`main`** and folder **`/docs`**.
4. Save — your game will be live on GitHub Pages.

---

## Features

* **Pure JavaScript Match & Season Engine (`docs/assets/season.js`)**:
  * Realistic match simulation powered by a Poisson xG model and CM tactical styles.
  * Live text match commentary, substitutions, bookings, red cards, and match ratings.
  * Fatigue, condition recovery, injuries, and tactical rotation.
  * Formations: 4-4-2, 4-3-3, 3-5-2, 5-3-2, 4-5-1 with styles (Direct, Passing, Long Ball, Attacking, Counter).
  * Auto-Pick function or manual squad management with drag-and-drop.
  * Board confidence evaluation and realistic season objectives.
  * Browser storage: automatically preserves your season saves in local storage.

* **Reconstructed 2026/27 Database**:
  * **22 Playable Leagues** across 9 European nations (England, Scotland, Italy, Spain, Germany, France, Netherlands, Portugal, Belgium).
  * **394 Clubs** with authentic modern kit colors, stadiums, capacities, and club ratings.
  * **7,890 Players** with authentic 2026/27 abilities, positions, valuations, birth dates, international stats, and all 19 Championship Manager playing skills.
  * Modern top stars calibrated to £100m–£150m valuations (Haaland, Mbappé, Bellingham, Yamal, Kane, Vinícius, etc.).
  * Data extracted and adapted from [Championship Manager 26/27 Edition Dicaprio ProductionZ](https://swos21z.itch.io/championship-manager-2627).

* **Authentic Retro Aesthetics**:
  * Original bitmap pixel fonts: *MS Sans Serif* (`ms_sans_serif.woff2`) and *Lucida* (`cm_lucida_bold.woff2`).
  * Pixelated retro stadium backgrounds and classic CM 97/98 interface design.
  * Fully responsive on desktop and mobile devices.

---

## Repository Structure

```text
.
├── README.md                   # This documentation
└── docs/                       # Web application root (GitHub Pages ready)
    ├── index.html              # Default entry point (Quick Season launcher)
    ├── quick-season.html       # Full Quick Season game page
    ├── database.html           # Database breakdown & statistics
    ├── changes.html            # Build updates changelog & known issues
    ├── favicon.ico             # Site icon
    ├── bg.png                  # Fallback background
    └── assets/
        ├── site.css            # Retro stylesheet with local pixel font declarations
        ├── site.js             # Global navigation & status bar behaviour
        ├── season.js           # Complete 1,180-line match & season engine
        ├── season-data.json    # Global metadata for all 22 leagues, clubs, and stadiums
        ├── fonts/              # WOFF2 retro bitmap fonts
        │   ├── ms_sans_serif.woff2
        │   ├── cm_sans_13.woff2
        │   ├── cm_sans_16.woff2
        │   └── cm_lucida_bold.woff2
        ├── photos/
        │   └── bg.png          # Pixelated stadium background
        └── season/             # 22 League squad rosters (14-element player schema)
            ├── EPR.json        # English Premier League
            ├── ED1.json        # English Championship
            ├── ED2.json        # English League One
            ├── ED3.json        # English League Two
            ├── SPR.json        # Scottish Premiership
            ├── SD1.json        # Scottish Championship
            ├── SD2.json        # Scottish League One
            ├── SD3.json        # Scottish League Two
            ├── ISA.json        # Italian Serie A
            ├── ISB.json        # Italian Serie B
            ├── SP1.json        # Spanish La Liga
            ├── SP2.json        # Spanish La Liga 2
            ├── GD1.json        # German Bundesliga
            ├── GD2.json        # German 2. Bundesliga
            ├── FD1.json        # French Ligue 1
            ├── FD2.json        # French Ligue 2
            ├── HD1.json        # Dutch Eredivisie
            ├── HD2.json        # Dutch Eerste Divisie
            ├── PD1.json        # Portuguese Primeira Liga
            ├── PD2.json        # Portuguese Liga Portugal 2
            ├── BD1.json        # Belgian Pro League
            └── BD2.json        # Belgian Challenger Pro League
```

---

## Data Schema

### Squad Files (`docs/assets/season/<league_code>.json`)
Each league file is a JSON object keyed by club name:
```json
{
  "Arsenal": [
    [
      "Leandro Trossard",
      "AM LC",
      200,
      [0, 0, 100, 95],
      14,
      8,
      14,
      31,
      "Belgium",
      [16, 14, 18, 17, 18, 16, 11, 14, 8, 18, 16, 17, 15, 14, 17, 14, 13, 9, 18],
      "04.12.1994",
      37,
      9,
      13200
    ],
    ...
  ]
}
```

#### The 14-Element Player Array Specification:
| Index | Field | Type | Description |
|:---:|:---|:---:|:---|
| **0** | `name` | `string` | Full display name (e.g. `"Erling Haaland"`). |
| **1** | `label` | `string` | Position tag (e.g. `"GK"`, `"D C"`, `"D/M R"`, `"M C"`, `"AM/F R"`, `"S C"`). |
| **2** | `a` | `number` | Current Ability (`1–200`). Drives team strength and player performance. |
| **3** | `fit` | `number[4]` | Positional suitability `[GK, DEF, MID, FWD]` (each `0–100`). |
| **4** | `sta` | `number` | Stamina (`1–20`). Determines matchday fatigue rate. |
| **5** | `inj` | `number` | Injury proneness (`1–20`). Scales in-match injury probability. |
| **6** | `con` | `number` | Consistency (`1–20`). Governs match-to-match performance variation. |
| **7** | `age` | `number` | Player's age in 2026/27. |
| **8** | `nat` | `string` | Nationality (e.g. `"England"`, `"Norway"`, `"Spain"`). |
| **9** | `attrs` | `number[19]` | 19 CM playing skills (`1–20`). `attrs[1]` is Aggression (drives foul/card frequency). |
| **10** | `born` | `string` | Date of birth formatted as `"DD.MM.YYYY"`. |
| **11** | `caps` | `number` | Senior international appearances. |
| **12** | `goals` | `number` | Senior international goals. |
| **13** | `value` | `number` | Market valuation in **£10,000 units** (e.g. `12100` = £121,000,000; `85` = £850,000). |

---

## Playable Leagues

| Country | Code | League Name | Clubs |
|:---|:---:|:---|:---:|
| **England** | `EPR` | Premier League | 20 |
| | `ED1` | Championship | 24 |
| | `ED2` | League One | 24 |
| | `ED3` | League Two | 24 |
| **Scotland** | `SPR` | Premiership | 10 |
| | `SD1` | Championship | 10 |
| | `SD2` | League One | 10 |
| | `SD3` | League Two | 10 |
| **Italy** | `ISA` | Serie A | 18 |
| | `ISB` | Serie B | 20 |
| **Spain** | `SP1` | La Liga | 20 |
| | `SP2` | La Liga 2 | 22 |
| **Germany** | `GD1` | Bundesliga | 18 |
| | `GD2` | 2. Bundesliga | 18 |
| **France** | `FD1` | Ligue 1 | 18 |
| | `FD2` | Ligue 2 | 22 |
| **Netherlands** | `HD1` | Eredivisie | 18 |
| | `HD2` | Eerste Divisie | 18 |
| **Portugal** | `PD1` | Primeira Liga | 18 |
| | `PD2` | Liga Portugal 2 | 18 |
| **Belgium** | `BD1` | Pro League | 18 |
| | `BD2` | Challenger Pro League | 16 |

---

## Provenance & Attribution

* **Web Game Code & Assets**: Recovered and reconstructed from snapshots preserved in the [Internet Archive / Wayback Machine](https://web.archive.org/web/*/https://www.champman2627.co.uk/*) (original domain: `champman2627.co.uk`).
* **Player & Squad Database**: Sourced and adapted from the 2026/27 database by Dicaprio ProductionZ, available at **[https://swos21z.itch.io/championship-manager-2627](https://swos21z.itch.io/championship-manager-2627)**.
* **Legal Disclaimer**: This is an unofficial, not-for-profit fan preservation project. Not affiliated with or endorsed by Sports Interactive, Square Enix, or Eidos. Championship Manager is a trademark of Square Enix.
