# AFFL Player Platform — Design Brief

*Synthesis of five research tracks (storage architecture, NFL data catalog, PlayerProfiler taxonomy, Sleeper linking model, scrape analytics) into one buildable plan. Reader's three questions, answered up front: **(1)** analyze the scrape via a two-bucket suite — finish the league-only luck/schedule/decision metrics first, then NFL-linked joins; **(2)** store all NFL data in a **DuckDB + Parquet offline warehouse** (~350 MB, medallion schema); **(3)** ship a PlayerProfiler-grade, Sleeper-linked player site by rendering **static per-player JSON shards client-side**, with DuckDB-WASM for cross-player queries — no server, still free.*

---

## 1. Vision

Two products fused into one linked graph:

- **AFFL league dashboard** — the existing static site (2014–2025 league history: standings, matchups, drafts, trades, managers), extended with a full luck/schedule/decision-quality analytics suite.
- **PlayerProfiler-grade NFL player database** — a profile page for *every* NFL player who warrants one (~4,000–6,000, up to ~10k), carrying combine/athletic profile, opportunity, efficiency, Next Gen Stats, game logs, and splits.

**Linked like Sleeper:** every player, manager, season, matchup, draft pick, and trade is a **clickable node with one canonical route and one canonical ID**. You arrive at the same player node whether from an AFFL box score, a trade card, a leaderboard, or NFL search. The spine that makes this possible is a single crosswalk: **ESPN `playerId` → `gsis_id`** (via DynastyProcess `ff_playerids`), mirroring Sleeper's one-`player_id`-for-everything discipline (docs.sleeper.com).

---

## 2. Recommended storage architecture — THE answer to "how to store all the NFL data"

### 2.1 Recommendation & why

**Use a DuckDB + Parquet offline warehouse as the sole compute and source-of-truth, and split the *serving* layer by surface:**

| Surface | Served as | Host | Cost |
|---|---|---|---|
| AFFL dashboard | Gold marts baked to static JSON (unchanged from today) | GitHub Pages | $0 |
| Whole-NFL player pages | One static JSON shard per player, client-rendered | GitHub Pages | $0 |
| Cross-player leaderboards / live filtering | **DuckDB-WASM over partitioned Parquet via HTTP range reads** | GitHub Pages (static assets) | $0 |
| Auth / writes / saved views | Postgres/Supabase — **deferred**, holds only slim gold marts *if ever* | — | later |

**Why not pure Postgres/Supabase.** The universe is dominated by play-by-play: ~48–50k rows/season × 12 seasons ≈ **600k pbp rows at ~370 columns, ~0.5–1 GB Parquet** ([nflverse pbp ≈ 49,912 rows/season](https://github.com/nflverse/nflverse-pbp)). Supabase's free tier is **500 MB DB + auto-pause after 7 idle days + 5 GB egress** ([Supabase 2026](https://uibakery.io/blog/supabase-pricing)). pbp alone won't fit, and an idling hobby site keeps getting paused. There are no per-user writes and no live OLTP here — Postgres/RLS/auth buy nothing for a read-only analytics surface.

**Why not pure DuckDB→static-JSON (the old "option C").** Right for the dashboard, breaks for the whole-NFL vision: a page per NFL player plus arbitrary cross-player leaderboards can't be answered by a fixed set of pre-baked blobs, and pre-baking every slice blows past GitHub Pages' **1 GB** site cap ([GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)).

**Why hybrid wins.** DuckDB is a serverless embedded OLAP engine that aggregates a billion rows on a 16 GB laptop and tops open-source ClickBench ([DuckDB benchmarks](https://duckdb.org/2024/06/26/benchmarks-over-time)), so the entire 2014–2025 universe computes offline for $0. Its output feeds both surfaces cheaply — small JSON for the dashboard, and **DuckDB-WASM in the browser reading remote Parquet via HTTP range requests, downloading only the columns/row-groups a query touches, with no backend** ([DuckDB-WASM httpfs](https://duckdb.org/docs/lts/core_extensions/httpfs/https); [in-browser](https://motherduck.com/blog/duckdb-wasm-in-browser/)). A served DB appears only when accounts/writes arrive — and even then pbp stays in Parquet.

### 2.2 Medallion schema sketch

**Spine of the whole model:** `ESPN playerId → silver.player_xwalk.espn_id → player_xwalk.gsis_id → nfl_player.gsis_id`. Every AFFL reference keys on the (season-stable) ESPN `playerId`; every NFL fact keys on `gsis_id`; the crosswalk is the only bridge. **`teamId` is deliberately not a key** (unstable across seasons — resolved via `team_season`/`team_alias`).

**BRONZE — raw, immutable, append-only** (registered as DuckDB external views):

| Table | Grain | Notes |
|---|---|---|
| `bronze.espn_raw` | (season, view, fetched_at) | raw ESPN JSON per view (mTeam/mMatchup/mRoster/mTransactions2/mDraftDetail) |
| `bronze.espn_boxscore_raw` | (season, week, matchupId, fetched_at) | mirrors `public/data/boxscores/*` |
| `bronze.nflverse_*_raw` | (season, source_file) | one per loader (pbp, player_stats, rosters, snaps, depth_charts, ngs, combine, draft, injuries) as fetched Parquet, partitioned by season |
| `bronze.ff_playerids_raw` | (asof_date) | DynastyProcess dump, ~35 id columns |
| `bronze.load_manifest` | (source, url, fetched_at) | sha256, row_count, status — feeds completeness + Verified/Reconstructed/Partial/Unavailable tags |

**SILVER — normalized entities** (PK **bold**, → FK):

*League:* `season` (**season**) · `owner` (**owner_id**) · `franchise` (**franchise_id**, continuous identity across renames) · `team_season` (**(franchise_id, season)**, holds per-season `espn_team_id`, keeps owner/franchise/team-season separate) · `team_alias` (**(alias_text, season)**, dated alias→canonical map) · `matchup` (**matchup_id**, →team_season ×2, `phase`) · `roster_week` (**(season, week, franchise_id, espn_player_id)**) · `lineup_slot` (**(…, slot)**, starter/bench, actual points) · `auction_purchase` (**(season, franchise_id, espn_player_id, nomination_order)**, winning_bid — *loaded separately, never inferred from pick order*) · `transaction` (**transaction_id**) · `ownership_stint` (**stint_id**, `acquired_via`, start/end week) · `trade` (**trade_id**) + `trade_asset` · `injury_week`.

*NFL:* `nfl_player` (**gsis_id**) · `nfl_team` (**team_abbr**) · `player_week_stats` (**(gsis_id, season, week)**) · `ngs_week` (**(gsis_id, season, week, stat_type)**, 2016+) · `combine` (**(pfr_id, draft_year)**) · `draft_pick` (**(season, round, pick)**) · `injuries`/`snap_counts` (**(gsis_id, season, week)**).

*Crosswalk (the bridge):* `player_xwalk` (**xwalk_id**, natural key `gsis_id`) — columns `espn_id, gsis_id, pfr_id, sleeper_id, mfl_id, sportradar_id, …` (~35 ids) plus `match_status` (Verified/Reconstructed/Partial/Unavailable) + `match_method`. ESPN players with no DynastyProcess match (some pre-2018, team-only 2014–2017, D/ST, some kickers) land **Unavailable**, never faked.

**GOLD — metric marts + player-profile mart.** Every aggregate carries **`phase_scope` + `week_range`** and preserves **raw numerator/denominator** (honors 14-vs-17-week and rounded-rating conflicts); population-sensitive stats publish as *distinct named metrics*.

| Table | Grain | Contents |
|---|---|---|
| `team_season_metrics` | (franchise_id, season, phase_scope, week_range) | Points Forced/Allowed, Power Wins (num/den), Power Win Rating, Expected/Luck/Net-Luck, Roto |
| `team_week_metrics` | (franchise_id, season, week, phase) | actual vs optimal lineup, points left on bench, management score |
| `matchup_luck` | matchup | lucky-win / unlucky-loss flags |
| `acquisition_source_points` | (stint_id, week) | Drafted/Traded/Waiver/FA started points |
| `auction_roi` | auction_purchase | budget share, return — *Unavailable until bid data loaded* |
| `roster_age` | (franchise_id, season, **population**) | separate `roster_age` vs `starter_age` rows |
| **`player_profile`** | **gsis_id** (+ child `player_profile_week`) | **THE mart — one row per NFL player, whole universe:** usage (snap%, target share, air yards, aDOT), efficiency (EPA/play, CPOE, success, YAC), NGS, combine, draft capital, fantasy PPG by format — **plus AFFL linkage** (`is_affl_rostered`, `affl_ownership_stints[]`) joined through `player_xwalk`. Both an AFFL player page and a generic NFL player page read this one row |

### 2.3 Serving both surfaces — and the SSG tension, quantified

Both surfaces read **the same gold**, so an AFFL-rostered player and a generic NFL player are one entity (`player_profile`), Sleeper-style.

- **Static AFFL dashboard (unchanged):** `team_*` marts + AFFL-linked slices → `public/data/*.json`, a few MB, GitHub Pages. Keep today's pipeline exactly.
- **Whole-NFL surface:** `player_profile` + `player_profile_week` → **one JSON shard per player** (`data/players/{gsis_id}.json`) + a light `search-index.json` (id, name, pos, team, thumb). One client route `/player/[id]` fetches the shard on demand.

**Is per-player SSG (pre-rendered HTML at build) viable? No — render client-side from shards.**

| Question | Number | Verdict |
|---|---|---|
| Players warranting a page | ~4,000–6,000 (≥1 snap 2014–25), up to ~10k with practice squad | — |
| Pre-render HTML at build (Next.js `generateStaticParams`) | ~0.1–0.3 s/page → 5k pages ≈ **8–25 min** fragile CI; Next.js docs warn against large catalogs ([docs](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)) | **Reject** |
| Static site size (data shards) | ~30–120 KB/shard; 5k × ~75 KB ≈ **~375 MB** (under 1 GB cap; 10k richer shards would breach) | Shards fit |
| Bandwidth | 100 GB/mo ÷ ~75 KB ≈ **~1.3M player-page loads/mo** ([Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)) | Ample |

**Verdict:** client-render player pages from static JSON shards (no build-time page explosion, stays free). For **cross-player leaderboards / live filtering across the full pbp/weekly universe**, don't shard — run **DuckDB-WASM over partitioned Parquet via HTTP range requests** (column-pruned, predicate-pushed, no server). A served DB/API is needed **only** if accounts, writes, or saved views arrive — and even then Postgres holds only compact gold marts; pbp stays in Parquet (won't fit Supabase's 500 MB free tier).

### 2.4 Refresh model + secrets

- **Backfill-once (immutable):** 2014–2024 ESPN + all nflverse history are frozen. Pull once, snapshot `bronze`, freeze derived gold. Re-run only on a schema/metric change.
- **Weekly-in-season:** only the current season is live. A **GitHub Actions cron (in-season only)** fetches ESPN (cookie secrets) + `nflreadpy`, rebuilds silver/gold **for the current season only**, emits JSON shards + Parquet, commits/deploys. nflverse releases refresh Tue/Wed post-games. Off-season: monthly or manual.
- **Secrets:** ESPN `SWID` + `espn_s2` cookies live in **`.env` locally** (gitignored; `scripts/lib.mjs` reads `ESPN_SWID`/`ESPN_S2`) and in **GitHub Actions encrypted secrets** for CI. **Never shipped to the browser, never committed inside data** — the browser fetches only pre-baked JSON/Parquet. ESPN cookies expire ~annually → document a manual rotation step. If Supabase is ever added: service key in Actions secrets only; anon key + RLS for private reads.
- **Evidence-honesty wiring:** `bronze.load_manifest` (completeness by source/season) + `player_xwalk.match_status` propagate into every gold row's tag — missing waiver/auction/transaction inputs render **Unavailable**, never 0/NaN.

---

## 3. NFL data catalog & volume

Scope: nflverse-data via **nflreadpy** (Python) / **nflreadr** (R v1.5.1) — successors to deprecated `nfl_data_py`. Sizes measured from GitHub release asset byte counts (parquet, per season) except *(est.)*. Window 2014–2025. **Headline: the entire core catalog is ~330–360 MB parquet (~1.6 GB CSV), and play-by-play alone is ~70% of it.**

| Dataset | `load_*` fn | Grain | Rows/szn | 2014–25 parquet | Cadence | Years |
|---|---|---|---|---|---|---|
| **Play-by-play** | `load_pbp` | play | ~48,000 | **~245 MB** | Nightly in-season | 1999– |
| PBP participation | `load_participation` | play (personnel/box) | ~48,000 | ~33 MB | Frozen* | 2016–2023* |
| Weekly player stats | `load_player_stats` | player × week | ~11,000 | ~15 MB | Nightly | 1999– |
| Seasonal player stats | `load_player_stats(summary)` | player × season | ~1,700 | ~3.5 MB | Weekly rollup | 1999– |
| Weekly rosters | `load_rosters_weekly` | player × team × week | ~32,000 | ~8 MB | Weekly | 2002– |
| Depth charts | `load_depth_charts` | player × pos × slot × wk | ~30,000 | ~6 MB | Weekly | 2001– |
| Snap counts | `load_snap_counts` | player × game | ~24,000 | ~2.6 MB | Weekly | 2012– |
| Injuries | `load_injuries` | player × team × wk report | ~6,000 | ~1.4 MB | Weekly | 2009– |
| Next Gen Stats | `load_nextgen_stats` | player × wk × stat_type | ~3,500 | ~2 MB | Nightly | 2016– |
| FTN charting | `load_ftn_charting` | charted play | ~30,000 | ~2 MB (4 szn) | ≤48h post-game | 2022– |
| PFR advanced | `load_pfr_advstats` | player × wk/szn × type | ~4,000 | ~4 MB | Weekly | 2018– |
| ESPN QBR | `load_espn_qbr` | QB × wk/szn | ~600 | <1 MB | Weekly | 2006– |
| Combine | `load_combine` | player-workout | ~330 | ~0.3 MB | Annual (Feb–Mar) | 2000– |
| Draft picks | `load_draft_picks` | pick | ~257 | ~0.5 MB | Annual (Apr) | 1980– |
| Schedules/games | `load_schedules` | game | ~285 | ~1 MB | Weekly (scores) | 1999– |
| Players master | `load_players` | player (all-time) | ~20,000 | ~1–2 MB | Nightly | all-time |
| **FF player IDs (xwalk)** | `load_ff_playerids` | player (fantasy-rel.) | ~11,000 | ~0.5 MB | Periodic | all-time |

\* Participation covers 2016–2025 but the NFL source degraded after 2022 (2023+ files ~double, derive differently); treat 2016–2022 as clean, flag 2023+ **Partial**.

**Join spine.** `ff_playerids` (espn↔gsis↔pfr↔sleeper↔mfl↔sportradar) is the mandatory hub: pbp/stats/NGS key on **`gsis_id`**; snaps/combine/advanced on **`pfr_id`**; the AFFL scrape on **`espn_id`**. This one table is what lets you "link everything like Sleeper."

**Storage-design takeaways:** (1) prefer parquet (~350 MB vs ~1.6 GB CSV); (2) two volume tiers — *play-grain* (pbp + participation + ftn ≈ 280 MB, ~99% of bytes; partition by season, load lazily) vs *player-grain summaries* (weekly/seasonal, snaps, NGS, rosters, injuries, depth ≤15 MB total; bake fully) vs *static dims* (players, ff_playerids, teams, draft, combine ≤2 MB); (3) cadence split maps to "rebuild play-grain weekly, refresh dims nightly, static once"; (4) **~350 MB parquet comfortably fits the DuckDB pattern — the data *volume* does not invalidate option C; the *query/UX* needs are what force the escalation in §7.**

**Licensing (all datasets).** Code (nflreadr/nflreadpy/nflfastR): **MIT**. Data: **CC-BY-SA 4.0** — free but **attribution-required and share-alike**. Required credit lines: **"FTN Data via nflverse"** (2023+ charting/derived), **"NFL Next Gen Stats via nflverse"** (2022-and-earlier); combine/draft/snaps/advanced via **Pro Football Reference**; contracts via **OverTheCap**. Keep numbers as-published, don't rebrand as proprietary, carry a visible credit + license link. Sources: [nflfastR LICENSE](https://github.com/nflverse/nflfastR/blob/master/LICENSE.md) · [nflreadr home](https://nflreadr.nflverse.com/) · [reference index](https://nflreadr.nflverse.com/reference/index.html) · [nflreadpy load functions](https://nflreadpy.nflverse.com/api/load_functions/) · [nflverse-data releases](https://github.com/nflverse/nflverse-data/releases).

---

## 4. PlayerProfiler-style profile spec

**Sourcing legend.** **FREE** = loadable/trivially derivable from open data (nflverse `load_*`, NGS 2016+, combine, draft, snaps, QBR, CFBD college). **PARTIAL** = inputs free but needs play-charting we only partially have (`load_ftn_charting` is 2022+ only; pre-2022 needs paid PFF/Sportradar). **PROPRIETARY** = PP's own model/formula/cohort or a paid charting input — approximate under our own definition or omit. **Do not ship PP's numbers.** Every definition below is from PlayerProfiler's own glossary/profiles.

### 4.1 What is FREE-sourceable (ship as Verified 2016+, most further back)

| Block | FREE metrics | Source |
|---|---|---|
| **Athletic / prospect** | 40-time, BMI, Speed Score `(wt×200)/40⁴`, Height-adjusted Speed Score, Burst (vert+broad), Agility (shuttle+3-cone), Draft Capital/Pick | `load_combine`, `load_draft_picks` |
| **College** | Dominator Rating, Breakout Age, Target Share/YPR/YPC | CFBD/`cfbfastR` (not in nflverse core) |
| **Opportunity** | Snap Share, Target Share, Total Air Yards, aDOT, Red Zone target/touch share, Opportunity/Carry Share, Hog Rate, Deep Balls, Game Script, Pace | `load_snap_counts`, pbp, NGS |
| **Efficiency** | Catch Rate, YAC, QB Rating When Targeted, Fantasy Pts per Opp/Target/Attempt, Target Premium, True YPC, Stuffed Runs, AY/A, Total QBR, EPA | pbp, `load_espn_qbr` |
| **Advanced tracking (all FREE via `load_nextgen_stats`, 2016+)** | Route/Target Separation, Air Yards Share, Avg Cushion, Avg Time to Throw, CPOE, xYAC, RYOE/efficiency, 8+ box %, Avg Time to LOS | NGS |
| **Game logs & splits** | Weekly logs, home/away/div/RZ splits, Fantasy Pts/Game, Weekly Volatility | `load_player_stats`, pbp |
| **Matchup** | Defense vs Position (fantasy pts allowed), Stacked/Base/Light Front (`percent_attempts_gte_eight_defenders`) | pbp/weekly aggregation, NGS rushing |

### 4.2 What is PARTIAL (Verified 2022+ via FTN, Unavailable/approximate before)

Routes Run / Route Participation, Target Rate, Slot Rate, True Catch Rate, **YPRR**, Juke Rate, Target Quality, Hurry Rate — all need routes/alignment/drops/pressure charting. `load_ftn_charting` (2022+) closes much of this for recent seasons; pre-2022 requires paid charting → tag **Partial (2022+)** or **Unavailable**.

### 4.3 What is PROPRIETARY (re-implement under our own name, or skip)

PP composites/models — **SPARQ-x, Athleticism Score, Catch Radius, Breakout Rating, Production Premium, Weighted Opportunities coefficients, Lifetime Value, Value Over Stream, Best Comparable Player, Scouting Grade, Coverage Rating / CB matchups, Accuracy Rating/Money Throw/Danger Play, Yards Created** — plus **Popularity Index** (PP site telemetry, not reproducible) and **Wonderlic** (discontinued, not in nflverse). Approximate what we can under our own definitions (e.g. Production Premium ≈ EPA/expected-points; Best Comparable ≈ our own kNN over free inputs; Expected Fantasy Pts ≈ NGS xYards/xYAC + our expected-points model). **Never ship PP's numbers.**

### 4.4 Honesty posture

AFFL player-level data starts **2018**; NGS starts **2016**; combine/draft/pbp go further back. Tag FREE metrics **Verified 2016+**, charting-dependent **Partial (2022+)** or **Unavailable (pre-2022)**, PP composites re-implemented under our own names.

### 4.5 Proposed player-page layout

**Two-column node** (the Sleeper "player object as hub" pattern):

- **Header:** name, position, NFL team badge (→ `/nfl/[team]`), headshot, draft slot, age, Verified/Partial coverage chip.
- **Left / primary — AFFL panel:** season-by-season **custody timeline** (rostered by whom, acquisition source [draft pick / auction $ / trade / waiver], started vs benched weeks, points-by-source, optimal-lineup regret contribution); links to every Trade and DraftPick node touched; ownership-history strip.
- **Right / secondary — NFL profile:** athletic/combine block, opportunity tiles (snap%, target/air-yards share, aDOT), efficiency (EPA/CPOE/YAC/QBR), NGS tracking block, weekly game log + splits, matchup/DvP. Each row links onward.
- **Every row a link.** Box-score cells ↔ matchups; game-log rows ↔ matchup weeks; NGS/combine values carry their license credit.

**Sources:** [PlayerProfiler glossary](https://www.playerprofiler.com/terms-glossary/) · [About](https://www.playerprofiler.com/about/) · [profile example — Trey Benson](https://www.playerprofiler.com/nfl/trey-benson/) · [College Dominator](https://www.playerprofiler.com/article/college-dominator-rating-wide-receiver-nfl-draft-advanced-stats-metrics-analytics-profiles/) · [Athleticism](https://www.playerprofiler.com/article/athleticism/) · [CB matchup tools](https://www.playerprofiler.com/fantasy-football-rankings/) · cross-checked against nflverse loaders (`load_nextgen_stats`, `load_combine`, `load_draft_picks`, `load_snap_counts`, `load_ftn_charting`, `load_espn_qbr`).

---

## 5. Sleeper-style linking model

**Observed Sleeper patterns (cited).** One canonical `player_id` is the spine — Sleeper fetches its player universe once (`GET /v1/players/nfl`, ~5 MB, cached daily) and every other entity refers to players *only* by that string ID; nothing embeds name/team redundantly (docs.sleeper.com). The player object *is* a cross-platform crosswalk (`espn_id`, `yahoo_id`, `sportradar_id`, …). Trending is a first-class linkable surface — `GET /v1/players/nfl/trending/{add|drop}` returns `[{player_id, count}]`, an ordered list of IDs, each a click into the player node (publicly embeddable at `sleeper.com/embed/players/nfl/trending/add`). League/roster context is woven *into* the player card, not siloed beside it (support.sleeper.com/en/articles/6365463). Consistent ID discipline across every entity (users↔`user_id`, leagues↔`league_id`+`previous_league_id` season chain, rosters↔`roster_id`+`owner_id`, matchups↔`roster_id`+`matchup_id`).

**AFFL entity graph** — each node gets one canonical route:

| Node | Canonical ID | Route |
|---|---|---|
| Player | ESPN `playerId` (stable across seasons) | `/players/[espnId]` |
| Manager / Franchise | AFFL managerId (persists; **not** ESPN teamId) | `/managers/[managerId]` |
| Season | year 2014–2025 | `/seasons/[year]` |
| Roster / Team-Season | (managerId, year) | `/seasons/[year]/teams/[managerId]` |
| Matchup | (year, week, matchupId) | `/matchups/[year]/[week]/[id]` |
| DraftPick | (year, overall) | `/draft/[year]#pick-[overall]` |
| Trade | tradeId | `/trades/[tradeId]` |
| NFLTeam | team abbr | `/nfl/[team]` |

**Edges (all bidirectional):** Player ↔ Roster/Team-Season (custody chain) · Player ↔ LineupSlot ↔ Matchup (box-score cell ↔ game-log row) · Player ↔ DraftPick · Player ↔ Trade · Player ↔ NFLTeam · **Player → NFL profile** (ESPN `playerId` → `gsis_id`/`pfr_id` via `ff_playerids` → nflreadr stats/NGS — the "player object as crosswalk" pattern) · Manager ↔ Season/Matchup/Trade/Draft · Season ↔ everything · Trending/leaderboard list → Player.

**Concrete cross-link UX rules:**

1. **Every player mention anywhere is `<a href="/players/[espnId]">` — no exceptions.** Box scores, rosters, draft boards, trade cards, leaderboards, search, NFL team pages all resolve names through the *one* players map keyed on ESPN `playerId`. Never store name/team redundantly, never key on ESPN `teamId`.
2. **Every manager mention is `<a href="/managers/[managerId]">`**; every team-season badge → `/seasons/[year]/teams/[managerId]`. Manager identity persists though teamId doesn't.
3. **Player page = AFFL custody-chain + NFL profile side by side** (the §4.5 layout).
4. **Ship a Trending/Movers surface as an ordered list of clickable IDs** — AFFL analogs: most-rostered in AFFL history, biggest optimal-lineup regrets, best draft-ROI, most-traded. Each row `{entityId, metric}` → link, exactly like `trending/{add|drop}` returns `{player_id, count}`.
5. **Universal search box → the same canonical routes**, backed by a prebuilt static `search-index.json` (players→espnId, managers, NFL teams). A `/players` index page is the browse entry point (à la `sleeper.com/nfl/players`).
6. **Context travels with the entity** — surface which AFFL managers ever rostered a player inline on his node (cross-league-ownership pattern collapsed to one league).
7. **Box-score cells and game-log rows are reciprocal links** (LineupSlot is the shared edge; started/benched drives regret).
8. **Every edge bidirectional; every stored ID renders as a link** — this is what makes it *feel* linked like Sleeper.
9. **Honor the evidence model at the link layer** — player-level nodes only join 2018+ (team-only 2014–2017); tag each value Verified/Reconstructed/Partial/Unavailable and **gray-out (don't fabricate)** links into seasons without player data. Never link a 0/NaN as if real.
10. **Static-JSON routing** — path/hash routes on GitHub Pages with per-entity shards in `public/data/` (`players/[espnId].json`, `managers/[id].json`, `seasons/[year].json`, `trades/[id].json`), each node lazy-loading its own file — the browser-side equivalent of Sleeper resolving an ID against a cached map.

**Sources:** [docs.sleeper.com](https://docs.sleeper.com/) · [trending add embed](https://sleeper.com/embed/players/nfl/trending/add) · [cross-league ownership](https://support.sleeper.com/en/articles/6365463) · [app redesign](https://sleeper.com/blog/sleepers-app-redesign-whats-new/) · [players index](https://sleeper.com/nfl/players) · DynastyProcess `db_playerids` (espn_id ↔ gsis_id).

---

## 6. Analytics over our scrape

Grounded in what's baked today: `public/data/league.json` (seasons→teams, `matchups` with `isReg`/`isPlayoff`/`isConsolation`, `draft.picks[].bid`, headToHead, records), `public/data/boxscores/2018–2025` (starters+bench, each ESPN `id`, `pt`, slot `s`, real box stats `att/cmp/py/ptd/car/ry/rtd/rec/recy/retd`), `public/data/transactions/2018–2025` (`{pid, team, m:W/F/T, sp}`), `public/data/roster-age`, per-year `data/players/<yr>.json` id→name/pos (2014–2025). **Player-level starts 2018; 2014–2017 is team-score-only. Join key throughout is ESPN `playerId`.** Tags: **Verified** (from baked data as-is), **Partial** (2018+ only or needs a dropped field), **Blocked** (needs a new scrape).

### Bucket 1 — Finish the league-only suite (ranked by value-per-effort)

| # | Metric | Answers | Difficulty | Tag |
|---|---|---|---|---|
| **P0-1** | **Median / all-play standings + luck suite** (weekly-median record, expected wins = all-play% × games, luck = actual − expected, Pythagorean wins) | schedule vs scoring; paper tigers | Easy | **Verified** all seasons (score-based) |
| **P0-2** | **Schedule strength (SOS) + schedule-imbalance** (opp PF/all-play%; replay each team through every other's slate) | did the bracket hand someone an easy road | Easy–Med | **Verified** |
| **P0-3** | **Phase splits (Reg/Post/Combined)** — thread a phase selector through existing reducers (matchups already tag phase; boxscore weeks carry `tier`) | regular-season merchants vs playoff performers | Easy (plumbing) | **Verified** 2018+, **Partial** (team-only) 2014–17 |
| **P1-4** | **Correct-decision-rate (start/sit)** — reuse optimal-lineup regret + bench: was the started player ≥ best benched eligible alt? | good lineup-setters vs roster talent | Easy | **Verified** 2018+ |
| **P1-5** | **FAAB spend + waiver-regret** — (a) spend **Blocked**: `build-transactions.mjs` drops `bidAmount`, re-scrape `mTransactions2`; (b) regret = points a pickup scored vs best still-available FA | budget allocation; the pickup you missed | Med / Med–Hard | **Partial/Blocked** until re-scrape |
| **P2-6** | **Auction budget-share / stars-and-scrubs** — `draft.picks[].bid`: spend concentration (Gini / top-2 share), spend-by-position, vs finish | roster-construction philosophy | Easy | **Verified** (auction seasons) |
| **P2-7** | **Awards / superlatives engine** — thin aggregator over 1–6 | season "Emmys" | Easy once 1–5 exist | inherits source tags |

*Priority: do 1→2→3 first (all Verified, all from `league.json`, they anchor every other view), then 4, then 6/7 as near-free wins; schedule 5 last (only one needing a re-scrape).*

### Bucket 2 — NFL-linked frontier

**Foundational prerequisite (everything below depends on it):** build `player_xwalk` — `nflreadr::load_ff_playerids()`, key ESPN `playerId`→`gsis_id`/`pfr_id`/`sleeper_id`, over the distinct ESPN ids ever in boxscores+drafts+transactions. **Caveat:** D/ST and some kickers/pre-2018 won't map — transaction `pid` can be negative (`-16030` = a D/ST) → tag **Unavailable**, never 0. Then the NFL warehouse (§2/§3) and bake *joined* slices to static JSON — **this is exactly where DuckDB-offline→emit-JSON earns its keep** (NFL tables too big to ship raw to the browser).

| Metric | Answers | Join / data | Difficulty |
|---|---|---|---|
| **NFL production accumulated WHILE on an AFFL roster** | "You rostered Jefferson for the 900-yard stretch, not the dead weeks" | boxscore `{playerId, year, week}` → `player_stats` via `espn_id→gsis_id`, sum over roster-tenure windows | Med |
| **HOF-track / breakout players ever rostered** | bragging rights | distinct rostered `playerId` → xwalk → breakout/HOF flag (seasonal totals / draft capital) → attribute first-roster | Easy–Med |
| **Best/worst waiver pickups by *subsequent* NFL production** | which scrap-heap adds hit | transactions `m∈{W,F}` → NFL weekly stats after add date (pairs with B1-5) | Med |
| **Roster efficiency vs NFL baseline** (YPRR, target share) | efficient starters vs just high-volume | started `playerId` → NGS (2016+) + snaps for routes/targets vs baseline | Hard (NGS/routes gaps) |
| **Strength-of-roster by underlying NFL usage** | rank rosters by real snap/target share | starters → snaps + weekly opportunity → composite usage index | Med |
| **"Who drafts athletic freaks" (Speed Score of buys)** | who pays for testing profiles | `draft.picks[].playerId` → combine → `(wt×200)/40⁴`, weight by `bid` | Med |
| **Draft-capital of auction purchases** | blue-chip pedigree vs lottery tickets | `draft.picks[].playerId` → `load_draft_picks` (round/overall) vs `bid` | Easy–Med |
| **Age curve of rosters vs the NFL** | contender-old vs rebuild-young vs real league | roster-age (already built) + NFL baseline from `load_rosters` birthdates | Easy |

*Build order: xwalk + warehouse → the Med/Easy volume joins (production-while-rostered, draft-capital, age-curve) needing only seasonal/weekly stats → usage/SOR (snaps) → efficiency/YPRR last (NGS+routes are flakiest → most Partial).* **Cross-cutting:** every joined value carries a coverage tag — **Verified** where xwalk + NFL row both exist, **Partial** for NGS-era-only (2016+)/route-derived, **Unavailable** for D/ST, unmapped kickers, 2014–2017 player-level. Never emit a silent 0/NaN.

---

## 7. Architecture-fork verdict

**Question:** does the whole-NFL player-site requirement force a served DB/API layer, or is DuckDB-warehouse + SSG/edge still viable? The prior brief leaned "option C (DuckDB + static JSON)."

**Verdict — option C survives, in a refined form. No served DB is required now.** Concretely:

- **Data volume does *not* force escalation.** The full core catalog is ~350 MB parquet; pbp ~245 MB. That fits the DuckDB embedded-warehouse pattern trivially and is invalidated, *if at all, by query/UX needs, not by bytes.*
- **Pre-rendered per-player HTML (build-time SSG) *is* rejected** — 5k pages ≈ 8–25 min fragile CI, Next.js docs warn against it, and 10k richer HTML pages breach the 1 GB Pages cap. But the fix is **client-side rendering from static JSON shards**, not a server: 5k × ~75 KB ≈ 375 MB of *data* fits under 1 GB, and bandwidth headroom is ~1.3M loads/month. Still 100% static, still $0.
- **Cross-player leaderboards / arbitrary filters** — the one need a fixed set of pre-baked blobs can't serve — are handled by **DuckDB-WASM over partitioned Parquet via HTTP range reads** in the browser, not a backend. Column-pruned, predicate-pushed, no server.

**So the refined option C is: DuckDB offline warehouse → (a) static JSON shards for pages + (b) partitioned Parquet queried by DuckDB-WASM for leaderboards. Zero servers, zero recurring cost.**

**Escalation triggers — introduce a served DB/API (Supabase, holding only slim gold marts; pbp stays in Parquet) only when *any* of these becomes real:**

1. **User accounts / auth** — logins, private league views, per-user permissions.
2. **Writes** — user-submitted content, saved views/watchlists, comments, mock-draft persistence.
3. **Personalization at request time** — anything that must be computed per-user and can't be a static shard.
4. **Site data exceeds ~1 GB or bandwidth approaches 100 GB/mo** on GitHub Pages (e.g. shard count toward 10k richer profiles) — move static assets to object storage/CDN before considering a DB.
5. **Live in-game data** with sub-nightly freshness the cron model can't satisfy.

Until one of those fires, do **not** stand up Postgres — it buys nothing for a read-only analytics surface and its free tier can't even hold pbp.

---

## 8. Phased build order

| Phase | Ships | Infra | Ships on current static site? |
|---|---|---|---|
| **0 — Bucket 1 quick wins** | Luck suite, SOS/imbalance, phase splits, correct-decision-rate, auction budget-share, awards (B1 #1–4, 6, 7) | none new — reads `league.json`/boxscores | **Yes — current static site** |
| **1 — Re-scrape gap-fill** | Keep `bidAmount` in `mTransactions2`; FAAB spend + waiver-regret (B1 #5) | update `build-transactions.mjs`; one re-scrape | Yes (static) |
| **2 — Warehouse + xwalk** | DuckDB medallion (bronze/silver/gold), `player_xwalk` via `load_ff_playerids`, `load_manifest`, evidence tags | **New: DuckDB offline warehouse** | Build-time only (no user-facing change yet) |
| **3 — NFL ingest** | Pull pbp/player_stats/snaps/NGS/combine/draft/rosters as partitioned Parquet; backfill-once + weekly-in-season GitHub Actions cron | New: cron + Parquet store | No (pipeline) |
| **4 — Player mart** | `player_profile` + `player_profile_week` (usage/efficiency/NGS/combine + AFFL linkage) → JSON shards + `search-index.json` | Warehouse emits shards | Data lands in `public/data/` |
| **5 — Player pages** | `/players/[espnId]` + `/nfl/[team]` + `/players` index; client-render from shards; FREE-metric profile (Verified 2016+), Partial/Unavailable tags | Client route; **no server** | **Yes — static shards + client render** |
| **6 — Cross-linking** | Make every entity a canonical clickable node (rules §5.1–10); bidirectional edges; Trending/Movers surfaces; universal search | Static routing + shards | Yes (static) |
| **7 — NFL-linked analytics** | Bucket 2 joins (production-while-rostered, draft-capital, age-curve → usage/SOR → efficiency/YPRR) | Warehouse joins → baked slices | Yes (baked JSON) |
| **8 — Leaderboards / live filter** | Cross-player leaderboards + arbitrary filtering | **New: DuckDB-WASM over Parquet (still static host)** | Yes (WASM in browser) |
| **(deferred) — served DB** | Only if an escalation trigger (§7) fires | Supabase w/ slim gold marts | — |

Phases 0–1 ship immediately on the existing static site with no new infra. Phase 2 introduces the offline warehouse (build-time only). Everything user-facing through Phase 8 stays on the free GitHub Pages static deploy.

---

## 9. Open questions for the grilling

1. **Player-universe cutoff.** Do we page *every* player with ≥1 snap (~4–6k) or cap at fantasy-relevant/AFFL-touched (~a few thousand)? This sets shard count, the 375 MB vs approaching-1 GB question, and whether escalation trigger #4 ever fires.
2. **College data in or out?** Dominator/Breakout Age/college usage need CFBD/`cfbfastR` (not nflverse core) — a whole extra ingest + crosswalk (`cfb_id`). Ship college block or defer?
3. **Charting posture pre-2022.** For routes/YPRR/True Catch Rate/pressure — do we (a) live with Partial (2022+ only via FTN), (b) pay for PFF/Sportradar backfill, or (c) omit entirely? Affects how "PlayerProfiler-grade" the pre-2022 profiles look.
4. **Which PP composites do we re-implement vs skip?** Best Comparable Player (our kNN), Production Premium (EPA proxy), Speed Score (free) are reproducible; SPARQ-x/Athleticism Score/Catch Radius/Breakout Rating/VOS/Lifetime Value are bespoke models. How many are worth building under our own names?
5. **DuckDB-WASM UX bar.** Is a ~few-MB WASM download + range-read latency acceptable for leaderboards, or do we pre-bake the top-N slices as JSON and reserve WASM for power-user filtering only?
6. **ESPN cookie durability.** Cookies expire ~annually and the in-season cron depends on them — who owns rotation, and what's the fallback if a mid-season expiry breaks the weekly rebuild?
7. **Auction bid re-scrape scope.** Re-scraping `mTransactions2` for `bidAmount` — is historical FAAB bid data still retrievable from ESPN for all of 2018–2025, or only recent seasons (bounding B1 #5 and `auction_roi`)?
8. **Manager identity ground truth.** `franchise`/`owner`/`team_alias` resolution (Rood, Grand Teeton, Polliwogs, the Commish/Grand Teton conflict) needs a human-authored canonical map — who supplies and signs off on it?
9. **Licensing display.** CC-BY-SA 4.0 requires visible "FTN Data via nflverse" / "NFL Next Gen Stats via nflverse" / PFR / OverTheCap credits on any page showing that data — where do these live so we're share-alike compliant without cluttering the profile?
10. **Escalation appetite.** Are accounts/saved-views/watchlists genuinely out of scope for v1, or likely enough soon that we should design the gold marts to be Supabase-portable from day one?