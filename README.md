# AFFL — Fantasy Football League History Dashboard

A polished, self-contained dashboard for the **AFFL** ESPN fantasy football league
(league `51418`) — 12 seasons of champions, records, rivalries and drafts (2014–2025).

Built with **Vite + React + TypeScript**. All league data is pulled from ESPN once,
computed into a single static JSON file, and served with no runtime credentials.

## Pages

- **Overview** — league-at-a-glance, reigning champion, Hall of Champions, all-time leaders
- **All-Time Standings** — sortable career table for every manager (former managers flagged)
- **Weekly Scoreboards** — full box scores: every matchup, every week, with starter & bench
  player names, NFL stat lines, and fantasy points (player detail 2018+; team scores 2014–2017)
- **Head-to-Head** — the full rivalry matrix + any-two-manager series breakdown
- **Records** — single-week highs/lows, blowouts, shootouts, streaks, biggest auction bids
- **Seasons** — per-year deep dive: podium, final standings, playoff bracket, divisions
- **Managers** — career profile per manager (via any name link): trophy case, season history, rivalries
- **Drafts** — auction spending by manager & position, biggest bids, snake boards
- **Roster Lab** — joins every rostered player to the draft **and** the transaction log (by player id):
  points by acquisition source (own draft pick / trade / waiver / free agent), draft-day value of each
  season-ending roster, per-dollar draft ROI (best values & biggest busts, draft-and-keep only), and a
  **Trades report** — every trade reconstructed from the weekly rosters, showing what each side received
  and what it scored afterward (so a traded-away pick is judged by its return, not counted as a bust)
- **Trends** — scoring inflation, title distribution, finish-trajectory bump chart

## Setup

```bash
npm install
npm run refresh   # fetch ESPN data + rebuild league.json  (needs .env, see below)
npm run dev       # http://localhost:5173
```

### Build & preview the static site

```bash
npm run build     # type-checks + outputs dist/
npm run preview
```

`dist/` is a fully static bundle — deploy it to Vercel, Netlify, GitHub Pages, or any
static host. Routing uses `HashRouter`, so no server rewrites are required.

## Data pipeline

Credentials live in `.env` (git-ignored) and are only used at data-build time — they are
never shipped to the browser.

```
.env
  ESPN_LEAGUE_ID=51418
  ESPN_SWID={...}
  ESPN_S2=...
```

| Command | What it does |
|---|---|
| `npm run fetch` | Pull each season + player-name maps → `data/raw/`, `data/players/` (cached; use `npm run fetch:force` to re-pull) |
| `npm run data` | Transform raw files → `public/data/league.json` (all computed stats) |
| `npm run boxscores` | Fetch + build weekly box scores → `public/data/boxscores/{year}.json` (2018+; lazy-loaded per season) |
| `npm run transactions` | Fetch waiver / free-agent / trade acquisition events → `public/data/transactions/{year}.json` (2018+) |
| `npm run refresh` | `fetch` → `data` → `boxscores` → `transactions` |

- `scripts/fetch-espn.mjs` — reads ESPN's `leagueHistory` endpoint for every season.
- `scripts/build-data.mjs` — computes all-time standings, head-to-head, records, playoff
  results, and enriched draft boards. It merges duplicate ESPN accounts for the same
  real-life manager (logged on each run) and restricts matchup-level records to true
  single-NFL-week games so 2-week playoff totals don't distort them.
- `scripts/build-boxscores.mjs` — pulls per-week player rosters (starters + bench) with
  fantasy points and NFL stat lines. Each entry carries the ESPN **player id**, the join key
  used by Roster Lab (`src/lib/analysis.ts`) to match rostered players to draft picks and, in
  future, to external NFL data (Next Gen Stats, combine, etc.). ESPN only exposes player-level
  data from 2018 on, so older seasons fall back to team scores. Every team's per-week starter
  points reconcile to its team total (verified: all 1,580 team-weeks).
- `scripts/build-transactions.mjs` — pulls the season's transaction feed (per scoring period) and
  reduces it to compact acquisition events (waiver / free-agent adds). Roster Lab bins each starter's
  points by how the player joined: draft (from the auction), waiver and free agent (logged directly),
  and trade. Because ESPN's *executed*-trade records are incomplete, **exact trades are reconstructed
  from the weekly rosters** in `src/lib/analysis.ts`: a player who changes teams with no waiver/FA claim
  moved by trade, and simultaneous moves between the same two teams form one trade (with its return).

To add a new season later, just run `npm run refresh` — new years appear automatically.

## Design

Dark broadcast aesthetic. Chart series use a colorblind-validated categorical palette
(`--s1`…`--s8`) checked against the dark surface. Champions/first place are gold throughout.
