# Fresh-Eyes Research Brief — AFFL Analytics (`_cc`) vs. the Warehouse Vision

*Prepared to feed a `/grill-with-docs` interview, then a PRD & Spec, for `/Users/chilly/Projects/FGwebsite_cc` (shipped Vite/React static-JSON SPA on GitHub Pages). Every substantive claim carries its source. Data-source claims keep their provenance tags ([VERIFIED] / [COMMUNITY-REPORTED] / [UNVERIFIED] / [CONFLICTING] / [DESIGN]).*

---

## 1. Executive summary

- **Two builds of one product exist, and they agree on the analytics, not the plumbing.** The metric definitions in the AFFL spec bible and in Grok's engineering spec are nearly identical (all-play Power Win Rating, Points Forced = Points For, management = actual/optimal, roto 10-cat starters-only). The fork is *architecture and data depth*, not analytical intent (metric-bible `AFFL_ANALYTICS_WEBSITE_SPEC.md §2–§8`; grok `ENGINEERING_SPEC.md §5.3`).
- **The single load-bearing constraint is the player-level data era boundary — and our shipped code already contradicts the research's pessimism.** `_cc` sets `FIRST_BOX_YEAR = 2018` and successfully bakes player-level boxscores/transactions from 2018 forward (our-code `src/lib/boxscores.ts`, `scripts/build-boxscores.mjs`). The ESPN research bets the real cutoff is **2019**, with 2018 "a coin flip," anchored on cwendt94's hardcoded `before 2019` guard clauses [VERIFIED mechanism, COMMUNITY-REPORTED cutoff] (data-sources `ESPN_FANTASY_RESEARCH.md §1.4, §8`). Our working 2018 pipeline is a real-league data point that partially *resolves* that conflict in 2018's favor — worth confirming, because it moves the OCR-fallback frontier back a year.
- **`_cc` already implements a surprising fraction of the "advanced" wishlist.** The ideal/optimal-lineup solver, exact trade reconstruction from roster-diff, points-by-acquisition-source attribution, all-play Power record, H2H matrix, roto category re-scoring, and RB-build scatter all exist today (our-code `src/lib/idealLineup.ts`, `analysis.ts`, `categoryStats.ts`, `rbBuild.ts`, `scripts/build-data.mjs`). The genuine build-new items are luck-index framing, median/all-play standings, SOS/schedule-imbalance, FAAB/waiver-regret, phase splits, Wrapped, and the BI shell.
- **Evidence honesty is a first-class requirement in both specs, and `_cc` doesn't formalize it.** Both docs mandate a four-state model (Verified / Reconstructed / Partial / Unavailable) and forbid fake 0/NaN — a direct reaction to FG's 2025 Wrapped showing 0 adds and NaN% management (grok `PRD.md §3/§10`; metric-bible `AFFL_ANALYTICS_WEBSITE_SPEC.md §10, §13`). `_cc` has hard 2018+ coverage limits but only ad-hoc "team scores only" fallbacks, no badge system.
- **Readiness is gated by *ingestion*, not by analytics.** The crosswalk scores 4 pages Ready, 7 Partial, 3 Blocked; everything auction-dollar / transaction / waiver-FAAB / trade-ledger dependent is Blocked or Partial (metric-bible `AFFL_SITE_MAP_DATA_CROSSWALK.md 'Page-by-Page Crosswalk'`).
- **Trade incompleteness is structural, not just historical — which validates `_cc`'s existing approach.** ESPN's `TRADE_ACCEPT` omits the traded assets from its payload and its `relatedTransactionId` doesn't reliably join to asset moves, so roster-diff reconstruction is required *even for current seasons* [VERIFIED, structural] (data-sources `ESPN_FANTASY_RESEARCH.md §2.2`). `_cc`'s `reconstructTrades` already does exactly this (our-code `src/lib/analysis.ts`).
- **The new-data path is researched and provenance-tagged, not speculative:** roster-diff + `kona_playercard`-by-transaction-ID for transaction recovery, Playwright+multimodal-LLM OCR for pre-2020 lineup detail, a per-season availability matrix to probe first, and NFL enrichment via the `ff_playerids` crosswalk → nflverse / Next Gen Stats (2016+) (data-sources `ESPN_FANTASY_RESEARCH.md §2–§9`).
- **Fantasy Genius is reference-only, forever.** Formula reference, CI goldens, and screenshots — never cloned into UI, never shipped as production numbers (grok notes "FG is formula-reference/CI-goldens only"; metric-bible `§10` missing-data prohibition; design-refs notes).

---

## 2. The architecture fork

Our `_cc` is a **static-JSON Vite/React SPA on GitHub Pages**: a Node pipeline pulls ESPN once at build time, bakes computed JSON into `public/data/`, and the browser `fetch()`es it — no server, no DB, no runtime credentials, player-level compute done client-side from lazy-loaded per-season JSON (our-code `README.md`, `src/App.tsx`, `scripts/lib.mjs`, `src/lib/analysis.ts`). Grok's vision is a **Postgres/Supabase medallion warehouse behind a Next.js 16 BI app** with a bronze/silver/gold data model, a versioned pure-function metric engine, quality gates, and private auth (grok `ENGINEERING_SPEC.md §2–§6`).

The three options below are for the grilling to decide. Concrete tradeoffs, grounded in the findings:

### Option A — Evolve `_cc` in place
Keep the static-JSON SPA; add build-time JSON outputs and client-side compute for each new metric.

| Pros | Cons |
|---|---|
| Zero infra/cost; already shipped and free on Pages (our-code `README.md`). | No warehouse to reconcile totals against — Grok's quality gates (Σ starters ≈ team week; week PF ≈ season PF; matchups ≈ standings) presume queryable tables (grok `ENGINEERING_SPEC.md §7`). |
| Satisfies the "UI never embeds ESPN cookies" invariant natively — no runtime creds (grok `ENGINEERING_SPEC.md §1`). | No immutable raw archive, which the research calls **non-negotiable** because ESPN endpoints have moved once and season quality degrades unpredictably (data-sources `ESPN_FANTASY_RESEARCH.md §6.1`). |
| Player-level analyses already run client-side over lazy JSON — proven adequate for one league's data volume (our-code `analysis.ts`, `idealLineup.ts`). | Source+confidence+cross_checked provenance columns and OCR/roster-diff staging are awkward to express in flat baked JSON (data-sources `ESPN_FANTASY_RESEARCH.md §6.2`). |
| Team already fluent in the codebase. | Phase model (Regular/Post/Combined) and evidence badges get bolted on; war-room cross-filter/brush is heavier hand-rolled (design-refs `PRD.md §10`). |

### Option B — Adopt the warehouse (build grokergenius)
Greenfield Next.js/Postgres/Supabase per the engineering spec: medallion planes, `MetricEnvelope` + `calculationVersion`, `metric_runs`, quality CLI, BI shell, private auth (grok `ENGINEERING_SPEC.md §2.3, §5.1, §6, §13`).

| Pros | Cons |
|---|---|
| Matches the full vision end-to-end; native phase model and evidence honesty (grok `ENGINEERING_SPEC.md §5.2`, `PRD.md §10`). | Greenfield rebuild discards the shipped `_cc` UI and its already-working metrics. |
| Immutable raw archive, provenance columns, and OCR/roster-diff staging fit cleanly (data-sources `ESPN_FANTASY_RESEARCH.md §6.2`). | Postgres/Supabase = infra + cost + auth + region choices; loses free static Pages hosting and "no server" simplicity (grok `ENGINEERING_SPEC.md §2.2, §13`). |
| Quality gates with severities, server-side Drizzle/pg (secrets off the client) (grok `ENGINEERING_SPEC.md §7`). | Large 13-wave program W0–W12; every existing `_cc` metric must be re-ported (grok `ENGINEERING_SPEC.md §10`). |
| Scales to the NFL-join layer and JSON API (grok `ENGINEERING_SPEC.md §3.5, §6.3`). | "Overkill for one league" risk — though BigQuery/Snowflake were already rejected on exactly that basis and Supabase is the middle path (grok `ENGINEERING_SPEC.md §2.2`). |

### Option C — Staged hybrid
Keep `_cc`'s shipped UX now; stand up a **warehouse/ETL as an offline backfill + reconciliation engine** (the research already recommends a **DuckDB** warehouse target, and Grok already carries an `AFFL_2014_2025.duckdb` bootstrap + DuckDB OLAP sidecar). The warehouse emits gold → static JSON that continues to feed `_cc`; adopt BI-shell interactions incrementally, deferring the Postgres/Next.js/auth commitment until data justifies it.

| Pros | Cons |
|---|---|
| Preserves shipped value while getting the non-negotiable raw archive + cross-checks + provenance offline (data-sources `ESPN_FANTASY_RESEARCH.md §6.1`; grok `ENGINEERING_SPEC.md §2.2`). | Two systems to maintain during transition. |
| DuckDB-first matches both the research recommendation and Grok's bootstrap; mirrors `_cc`'s existing "pull once → bake JSON" pattern (our-code `scripts/build-data.mjs`; data-sources `§6.1`; grok `§4.4`). | Static JSON can't do live server-side cross-filter queries — though client-side compute already handles this at one-league scale (our-code `analysis.ts`). |
| Keeps GitHub Pages hosting; defers auth/region decisions (grok `ENGINEERING_SPEC.md §13`). | May still need the BI shell eventually for true war-room brushing (design-refs `PRD.md §10`). |

**Where the evidence leans (for the grilling to confirm/reject):** toward **C**. Every hard data requirement — immutable raw archive ("non-negotiable"), source/confidence columns, cross-check gates, OCR staging, phase reconciliation — demands a *warehouse-shaped ETL*, but **none inherently requires a runtime OLTP server** for a single 12-team league whose full backfill is "a few thousand requests… under an hour of API time" (data-sources `ESPN_FANTASY_RESEARCH.md §6.3`). `_cc` already proves client-side compute over lazy JSON is adequate (our-code `analysis.ts`, `idealLineup.ts`). The open decision C punts to the interview: whether the war-room cross-filter/brush interactions (design-refs `PRD.md §10`) and private-by-default auth (grok `ENGINEERING_SPEC.md §1`) eventually justify escalating to full Option B.

---

## 3. Target 1 — Advanced analytics methods

Status legend: **keep** (exists in `_cc`, use as-is) · **extend** (partial in `_cc`, needs more) · **build-new** (absent). "Status in `_cc`" is grounded in the our-code extraction.

| Method | Definition (from specs) | Status in `_cc` | Source |
|---|---|---|---|
| Points Forced (PF) / Points Allowed / Differential | PF = Σ starter points in phase (AFFL label for Points For); PA = Σ opponent scores; diff = PF−PA | **keep/extend** — team scores + PF/PA/diff all-time & per-season exist; starter points reconcile to team total; **extend** = explicit PF label + phase split | metric-bible `SPEC §2/§14`; grok `ENG §5.3`; our-code `build-data.mjs`, `build-boxscores.mjs` |
| Power Wins / **Power Win Rating (all-play PWR)** | Weekly all-play win (½ tie); PWR = PW / (G×(N−1)); Power Rank by PWR | **extend** — all-play "Power" record (W/L/T + pct) computed per-season-team and all-time, numerator preserved; **extend** = normalized PWR rate + Power Rank display | metric-bible `SPEC §2`; grok `ENG §5.3`; our-code `build-data.mjs` (all-play record) |
| **Luck** suite (Luck Index, Expected Wins, WAE, Lucky Wins, Unlucky Losses, Net Luck) | Luck Index = Win%−PWR; Expected Wins = PWR×G; Lucky Win = actual win scoring bottom-half; Unlucky Loss = actual loss scoring top-half | **build-new** — `_cc` has the all-play record but surfaces no luck-index framing | metric-bible `SPEC §2`; grok `ENG §5.3` |
| **Median / All-Play Standings** | Standings by median score / all-play matrix; dedicated `/season/median` | **build-new** | grok `PRD §7.2` |
| Optimal lineup / Management Score / Points Left on Bench | Management = actual/optimal legal lineup; bench = optimal−actual; constraint-assignment solver | **keep/extend** — `computeTeamPotential` solves optimal (exclusive slots then FLEX), actual vs ideal, pts left, %-of-ideal (2018+); **extend** = phase views | metric-bible `SPEC §5`; grok `ENG §5.4`; our-code `idealLineup.ts` |
| Correct Decision Rate / Ideal Start % / Start % / result-flipping blunders | correct start/bench decisions ÷ all decisions; wins lost to lineup calls | **build-new** (extends from the solver) | metric-bible `SPEC §5`; grok `PRD §7.3` |
| **Management by phase** (Regular / Postseason / Combined) | Every aggregate computed for 3 phases; Combined excludes consolation by default; badge (never zero) if a phase is unavailable | **build-new** — `_cc` playoff-tier-classifies matchups but has no phase-scoped management | grok `ENG §5.2`, `PRD §7.3` |
| Roto (10-cat, starters only) | Rank 12 teams per cat, N…1 pts, ties split, sum 10 cats; cumulative weekly trend | **keep/extend** — `computeCategoryStats` ranks starters into categories, awards roto points, radar + league-avg polygon (2018+); **extend** = cumulative weekly trend; reconcile "9-cat" label vs 10-cat spec (see note) | metric-bible `SPEC §3`; our-code `categoryStats.ts` |
| **SOS / Schedule Balance (Schedule Imbalance)** | actual meetings − expected balanced meetings (owner-pair × shared seasons) | **build-new** — `_cc` has H2H matrix but no expected-meetings/imbalance | metric-bible `SPEC §9`; grok `PRD §7.2` (`/season/sos`) |
| Auction allocation / budget share / stars-and-scrubs / balanced-build | budget % by pos; top-3 concentration; auction return = started PF in drafted stint ÷ bid | **extend/partial** — draft boards, auction spend by mgr/position, biggest bids, RB-build scatter, price-based roster construction, Roster-Lab ROI (pts/draft-$, best values/busts); **build-new** = budget share %, stars-and-scrubs concentration | metric-bible `SPEC §4`; our-code `analysis.ts`, `rbBuild.ts`, `rosterConstruction.ts`, `Drafts.tsx` |
| Draft stacks / homers / handcuffs | QB+pass-catcher same NFL team; 2+ same college/NFL team; starter+backup pair | **build-new** in `_cc` (stack/homer/handcuff *examples* exist only in the FG-derived prototype `data.ts`, not `_cc`'s independent compute) | metric-bible `SPEC §4`; metric-bible 'current evidence' note |
| Drafted-player injury report | expected PPG × games missed = Injury Impact (context, not a management penalty) | **build-new** — needs injury/expected-PPG (nflverse join) | metric-bible `SPEC §4` |
| **Points by Acquisition Source** (Point Origins) | Drafted+Traded+Waiver+FA = PF; source = current ownership stint | **keep/extend** — `computeSeasonAnalysis` attributes starter points by draft/trade/waiver/FA (2018+); **extend** = reconciliation display, phase split, stacked-area trend | metric-bible `SPEC §6`; grok `ENG §5.3`; our-code `analysis.ts` |
| **Trade reconstruction + trade confidence** | Reconstruct who-got-whom from roster-diff; NO trade-winner score until ledger verified; confidence/status on every card | **keep/extend** — `reconstructTrades` builds exact bilateral trades from roster movement + points each side scored after (2018+); **extend** = confidence/status badges, pre/post PWR | metric-bible `SPEC §8`, `reports/trade-log-architecture.md`; our-code `analysis.ts` |
| **Waiver reports / FAAB / immediate-stream vs total-add-return / drop regret / waiver regret** | Immediate Stream = first-start pts after add; Total Add Return = all subsequent stint pts; Drop Regret = pts scored for another team after drop; waiver pts per FAAB $ | **build-new** — `_cc` logs executed W/F/T ADD events (2018+) only; no FAAB, no regret metrics (FAAB pre-2019 is "Gone" — see §4) | metric-bible `SPEC §7`; our-code `build-transactions.mjs` |
| Roster age (starter age vs roster age) | avg starter age, oldest/youngest, dollar-weighted age, age bands | **keep/extend** — `build-roster-age.mjs` computes avg starter age + oldest/youngest (2018+, birthdates from ESPN public core-athlete API); **extend** = age bands, $-weighted, roster-vs-starter split | metric-bible `SPEC §4`; our-code `rosterAge.ts` |
| Records book / notable matchups / **Awards Wall** | top/low weeks, blowouts, nailbiters, shootouts, streaks, superlatives; searchable award winners | **keep/extend** — `Records` precomputes these (all seasons, `singleWeek` flag keeps game records apples-to-apples); **extend** = Awards Wall module | metric-bible `SPEC §10`; grok `PRD §7.2`; our-code `build-data.mjs` |
| Rival Report / rivalry matrix | H2H record, streaks, playoff eliminations, shared players/trades | **keep/extend** — full owner-vs-owner H2H matrix (W/L/T + PF/PA, all seasons); **extend** = streaks, eliminations, shared players | metric-bible `SPEC §9`; our-code `build-data.mjs` (HeadToHead) |
| **Wrapped (39-slide)** | Spotify-Wrapped deck fed ONLY by already-verified metrics; slides skip when Unavailable; mandatory Management trio | **build-new** | metric-bible `SPEC §10`; grok `WRAPPED_SLIDE_MAP.md` |
| Compare / Lab-Explore pivot / What-If lineup / Draft-Night Replay / Activity Feed / NFL Lab / Commissioner Desk | 2–4 team slicer; dimension×measure pivot; lineup simulator; auction replay; feed; NFL-join shell; refresh/quality admin | **build-new** (all v1-approved modules) | grok `PRD §7.2`; `DECISIONS.md D10` |

*Reconciliation note:* the our-code topic titles the roto module "9-category" but lists 10 numeric categories (Pass Yds/TD/Comp%, Rush Yds/TD/YPC, Rec Yds/TD/Rec/YPR); the spec canonically defines **10** (metric-bible `SPEC §3`; our-code `categoryStats.ts`). Confirm the category count during ingestion.

---

## 4. Target 2 — New data sources (provenance preserved)

All findings from the ESPN research report; every `[COMMUNITY-REPORTED]`/`Marginal`/`Hist` claim is explicitly gated behind running the **Phase-1 availability audit against the real leagueId (51418)** before committing engineering time (data-sources `ESPN_FANTASY_RESEARCH.md §9`).

### 4.1 Transaction recovery — roster-diff + `kona_playercard`-by-txn-ID
- **Structural trade gap:** `mTransactions2`'s `TRADE_ACCEPT` omits traded players and `relatedTransactionId` doesn't reliably join to asset moves — so roster-diff reconstruction is required **even for current, fully-available seasons**; build it unconditionally, not just as a pre-2019 fallback. [VERIFIED, structural] (`§2.2`). *This validates `_cc`'s existing `reconstructTrades`.*
- **`kona_playercard`-by-transaction-ID workaround:** passing a known txn ID to `kona_playercard` returns detail for ALL players in that transaction, backfilling the asset list `mTransactions2` omits. Chicken-and-egg: you must already know txn IDs (enumerate via `mTransactions2`, then re-query each). Fixes completeness *within* the coverage window; does **not** extend temporal coverage. [COMMUNITY-REPORTED, promising, unverified for football specifically] (`§2.3`).
- **Roster-diff reconstruction (2014–2017/2018):** diff consecutive weekly `mRoster` snapshots (`scoringPeriodId=w`); added = roster_w − roster_w−1. Trade inference = simultaneous add/drop of same player between two teams with no waiver passthrough → flag `inferred_trade_candidate` for manual review, never auto-classify; rows carry `source='roster_diff_inference'` + confidence, week-granularity only. Exact timestamps, failed claims, and FAAB history for 2014–2017 are **permanently lost**. [DESIGN — standard technique] (`§2.4`).
- **How far back transactions go:** sources disagree — one thread "not working for some previous years," another 2026 workaround claims success "back as far as 2018" but for baseball. Best guess: usable via `mTransactions2` ~2019/2020+, 2018 marginal (test `kona_playercard`-by-ID), 2014–2017 roster-diff only. [CONFLICTING — resolved by best-guess] (`§2.1, §8`).
- **Negative results — don't invest:** rendered private-league pages need auth (same data as API, more expensive); Wayback excludes login-walled content (near-certainly never archived). [VERIFIED negative result] (`§2.5`).

### 4.2 Pre-2020 OCR fallback (lineup slot detail, **not** transactions)
- **Scope:** targets weekly lineup slots + box-score bench detail that roster-diff and degraded API still miss for 2014–2018/2019. Box-score/scoreboard URLs are deterministic on leagueId/seasonId/week. Capture via Playwright headless Chromium with SWID/espn_s2 as browser-context cookies (the app is a JS SPA), wait for network-idle, full-page screenshots ~1600px, one PNG per matchup. [DESIGN §3.1].
- **Extractor choice:** Tesseract poor on dense tables; AWS Textract TABLES good on geometry, weak on semantics (can't tell bold=starter); **multimodal LLM (Claude, strict JSON schema) is the best fit** — reasons about bold/greyed=bench, badges=injury, strikethrough=DNP. Recommendation: Claude primary + Textract as a differently-biased validation pass; numeric agreement = high confidence, mismatch flags the row. [DESIGN §3.2].
- **Cross-checks before promoting rows:** (1) team total = Σ starter-slot points; (2) matchup winner matches API `mStandings` W/L (standings more reliable in early years than lineup detail). Output `ocr_lineups` carries `source ('ocr_claude'|'ocr_textract')`, `confidence`, `cross_check_passed`, `source_image_path`, `reviewed_by_human`; shares grain (season×week×team×slot) with API lineups for a UNION view. OCR dominates wall-clock time for the pre-2020 gap-fill. [DESIGN §3.3–§3.4, §6.3].
- **Fresh-eyes flag:** because `_cc` already bakes 2018 player-level boxscores (our-code `boxscores.ts`, `FIRST_BOX_YEAR=2018`), the OCR frontier may be **2014–2017**, not 2014–2018 — confirm via Phase-1 probe.

### 4.3 Per-season availability matrix, 2014–2025 [matrix — mixed provenance; guard-clause evidence is one library's cross-league experience] (`§7`)

| Data | 2014–2017 | 2018 | 2019–2025 | Unlocks |
|---|---|---|---|---|
| League settings, teams/owners, draft results, matchup final scores, standings, playoff brackets | **Hist** (leagueHistory reliable) | **Hist/API boundary — test both** | **API** | Season/Power/Luck/Scoring, drafts, champions, records, H2H (the `_cc` "all-seasons" tier) |
| Weekly rosters/lineups slot detail, full box scores, player-level pts | **OCR required** | **Marginal** | **API** | Management, roto, bench, point-origins, roster-age, RB-build (the `_cc` 2018+ tier) |
| Transactions (adds/drops/waivers) | **roster_diff_inference** (week-gran, no timestamps/FAAB/failed claims) | **Marginal + test `kona_playercard`** | **API** | Point Sources, Waivers, acquisition-source attribution |
| Trades — full asset list | **roster_diff candidates only** | (as transactions) | **API + `kona_playercard` required even here** | Trade Analysis, trade confidence |
| FAAB bids / failed waiver claims | **Gone** | **Gone** | **API** | FAAB waiver reports, waiver-per-dollar, drop/waiver regret |
| Activity / communication feed | **Gone/OCR** | **Marginal** | **API** (`kona_league_communication`) | Activity Feed |

*Read as a starting hypothesis — every Marginal/Hist cell needs the Phase-1 probe against leagueId 51418.* The most load-bearing empirical anchor is cwendt94's hardcoded `before 2019` guard clauses (box score / recent-activity / free-agents) [VERIFIED mechanism, COMMUNITY-REPORTED cutoff] (`§1.4`).

**Endpoint mechanics that matter (all [VERIFIED] unless noted):** current read host `lm-api-reads.fantasy.espn.com/apis/v3/games/ffl` (migrated off legacy ~Apr 2024; build host-fallback like cwendt94, treat hostname as liable to move again) (`§1.1`); 2018+ path `.../seasons/{y}/segments/0/leagues/{id}`, ≤2017 `leagueHistory/{id}?seasonId={y}` returning a **length-1 array** — a real port gotcha (`§1.2`); combining `view=` params **is not associative** — re-verify combined-vs-separate (`§1.3`); `mRoster` needs `scoringPeriodId={week}` for a specific week (`§1.4`); `X-Fantasy-Filter` is a JSON *header*, paginate defensively with `limit`/`offset` [VERIFIED syntax, partial spec] (`§1.5`); auth = SWID + espn_s2 cookies, no TTL, treat 401 as manual re-harvest not auto-retry (`§1.6`); rate limits undocumented — pace ~1 rps + exponential backoff [UNVERIFIED — treat conservatively] (`§1.7`); `teamId` NOT stable across seasons — join on SWID owner GUID; `playerId` is the stable join key (`§1.8`); pull slot/position/proTeam/stat-ID maps programmatically from mkreiser constants [VERIFIED] (`§1.8`).

### 4.4 NFL enrichment joins (design now, ingest later)
- **Crosswalk:** `nflreadr::load_ff_playerids()` / `nflreadpy` pulls DynastyProcess `db_playerids` — confirmed columns `espn_id, gsis_id, pfr_id, sleeper_id, mfl_id, sportradar_id, …` (35 total). Build `player_xwalk` from it; 2014-era coverage not independently quantified, strongest for fantasy-relevant players; join D/ST by NFL team+season (not player ID), fall back to name+pos+team fuzzy match with manual review. [VERIFIED] (`§4.1`). **This is why `_cc` deliberately keeps ESPN `playerId` as the universal join key** (our-code notes).
- **Core NFL data:** `nfl_data_py` is **deprecated/archived (2025-09-25, read-only)** — use `nflreadpy`; `nflreadr` current v1.5.1. Full 2014–2025 coverage for pbp, weekly stats, snaps, rosters, depth charts, injuries, schedules. [VERIFIED] (`§4.2`).
- **Next Gen Stats:** `load_nextgen_stats()` starts **2016** (a real 2-season gap at the archive start no public source fills); passing/receiving/rushing only; week==0 = season summary; low-usage players filtered by NFL. [VERIFIED] (`§4.3`).
- **Other advanced:** FTN charting 2022+ (CC-BY-SA, attribution required); EPA/CPOE from core pbp across full window; PFR advanced would need separate scraping; ADP/market functions exist but verify historical depth to 2014 (lowest-confidence sub-claim). [VERIFIED] (`§4.4`).
- **Broadcast/tracking ceiling:** Prime Vision graphics are presentation-layer only, unobtainable; Big Data Bowl tracking is narrow/recent (2023–24), not cumulative. Verdict: **NGS-via-nflverse (2016+) is the ceiling; chase Prime Vision no further.** [VERIFIED] (`§5`).
- **What this unlocks:** HOFers rostered, most receptions/yards while on an AFFL roster, NFL-team concentration vs performance, college pipelines, combine/draft-capital of auction buys — via schema stubs Grok ships in v1 (`nfl_players`, `nfl_teams`, `player_external_ids`, `nfl_player_season_stats`); join path AFFL lineup `player_id` → `player_external_ids` → `nfl_*` (grok `ENGINEERING_SPEC.md §3.5`, `PRD §11`). Also directly feeds `_cc`'s drafted-player injury report (expected PPG × games missed) and roster-age.

---

## 5. Target 3 — Design / presentation references

### 5.1 BI war-room patterns (the "Tableau for the boys" target)
- **Density baseline:** high-information cards + tables, NOT sparse marketing pages; desktop is the primary war-room layout, mobile usable-but-secondary (design-refs `PRD §10`).
- **Sticky filter chrome:** `AppFilterBar` = Season · Phase · Team(s) · Search, plus Evidence badge + last-refresh timestamp + Metric-definition drawer + Export CSV (design-refs `PRD §6/§10`, `ENG §6.2`).
- **Cross-highlighting:** click a team → cross-filter all panels; brush a week on the heatmap → scope other views (Power-BI slicer behavior) (design-refs `PRD §10`).
- **Phase toggles as a first-class global filter:** Regular | Postseason | Combined, each independently exposing Management Score / bench / result-flipping blunders / correct-decision rate; unavailable phase shows a badge, never fake zeros (design-refs `PRD §6/§7.3`).
- **Table patterns:** `DataTable` (TanStack) — sort, pin columns, sticky headers, CSV export on all major tables (design-refs `PRD §10`, `ENG §6.2`).
- **Viz vocabulary:** Heatmap (week×team), Sparkline (trends), RankBars, ScatterPlot (adds×PWR / lucky-unlucky), RadarChart (roto 10-cat), KpiStrip (PF leaders/luck/management/coverage); chart lib Recharts or Visx (design-refs `PRD §10`, `ENG §6.1–6.2`).
- **Theme:** dark broadcast look, gold accents, colorblind-safe categorical palette (design-refs `PRD §10`).
- **Canonical component set:** `AppFilterBar, KpiStrip, DataTable, Heatmap, RadarChart, ScatterPlot, Sparkline, EvidenceBadge, MetricDrawer` (design-refs `ENG §6.1–6.2`).

### 5.2 Fantasy Genius reference-screenshot inventory (reference only — never cloned)
Image contents are **inferred from filenames** (not opened); module mappings are best-guess. FG is formula/design reference only per task rules (design-refs notes).

| Reference file | Inferred content | Likely `_cc`/§7 module |
|---|---|---|
| `AFFL_SkillRadar.png` | Roto 10-cat spider chart | RadarChart / `/season/roto` |
| `AFFL_Luck.png` | Lucky/unlucky scatter or rank bars vs PWR | `/season/power-luck` |
| `AFFL_Scoring.png` | Week×team heatmap, distributions, notables | `/season/scoring` |
| `AFFL_ScheduleBalance.png` (largest, 1.6M) | H2H grid + schedule-fairness viz | `/rivals`, `/season/sos` |
| `AFFL_NotableMatchups.png` | Blowouts/closest callout panel | Scoring notables / Activity Feed |
| `AFFL_2025Draft.png` | Auction board, $ allocation, returns, stacks | `/auction` |
| `AFFL_2025GoodAwards.png` / `…BadAwards.png` | Season superlatives | Awards Wall `/awards` |
| `AFFL_Feelers.png` / `AFFL_2025Feeler.png` / `AFFL_FeelerHistory.png` | Sentiment/prediction "Feeler" family (snapshot + history) | No direct §7 module — candidate for Lab/Explore or bespoke widget |
| `AFFL_2025_Shippy.png` | Franchise/team dossier | `/teams/[franchise]` |
| `AFFL_GarrettWilson.png` | Player custody-chain + weekly log | `/players/[id]` |
| `AFFL_Fun.png` (1.2M) | Wrapped-style / novelty slide | `/wrapped/[season]` |
| `AFFL_HomePageFantasyGenius.html`, `Home_FantasyGenius.html` (+`_files/`, `chromeinspect/`) | Full-page home/executive dashboard scrapes | Home KPI-tile / coverage-map layout — **design reference only, never cloned** |

All under `/Users/chilly/Projects/AFFL/AFFL_FantasyGenius/`.

---

## 6. Gap analysis vs `_cc`

What the specs want that `_cc` does not yet have:

- **Phase model** — Regular / Postseason / Combined as a global, first-class filter with per-phase management metrics; `_cc` classifies playoff tiers but doesn't compute phase-scoped aggregates (grok `ENG §5.2`, `PRD §7.3`; our-code `build-data.mjs`).
- **Evidence-honesty badge system** — Verified / Reconstructed / Partial / Unavailable, with honest "Unavailable + unlock-requirement" panels; `_cc` has hard 2018+ coverage limits but no badge/metric-drawer (metric-bible `SPEC §13`; grok `PRD §10`).
- **Luck suite** — Luck Index, Expected Wins, Lucky Wins / Unlucky Losses / Net Luck (metric-bible `SPEC §2`).
- **Median / all-play standings** page (grok `PRD §7.2`).
- **SOS / Schedule Imbalance** (metric-bible `SPEC §9`).
- **FAAB + waiver depth** — FAAB bids, immediate-stream vs total-add-return, drop regret, waiver-per-dollar; `_cc` logs only executed W/F/T adds (metric-bible `SPEC §7`; our-code `build-transactions.mjs`).
- **Auction budget-share / stars-and-scrubs / balanced-build / stacks / homers / handcuffs / drafted-player injury report** — `_cc` has spend/ROI/RB-build but not these (metric-bible `SPEC §4`).
- **Correct Decision Rate / Ideal Start % / result-flipping blunders** (metric-bible `SPEC §5`).
- **Wrapped (39-slide)** fed only from verified metrics, with mandatory Management trio (metric-bible `SPEC §10`; grok `WRAPPED_SLIDE_MAP.md`).
- **Explore/BI modules** — Compare, Lab pivot, What-If lineup, Draft-Night Replay, Activity Feed, NFL Lab, Commissioner Desk (grok `PRD §7.2`).
- **Shared normalized data model** — owner / franchise / team_season / team_alias / ownership_stint / lineup_slot / auction_purchase / transaction / trade entities; `_cc` bakes page-oriented JSON, and the crosswalk explicitly warns against page-specific blobs (metric-bible `SITE_MAP_DATA_CROSSWALK 'Required Data Model'`).
- **Identity/alias resolution beyond real-name merge** — dated `team_alias` table for Commish/Grand Teton, Rood/Fairview, spelling variants; `_cc` canonicalizes owners by normalized real name only (metric-bible 'Conflicts'; our-code `build-data.mjs`).
- **Immutable raw archive + provenance columns + quality-gate CLI** — `_cc` bakes derived JSON with no raw-response archive or `source/confidence/cross_checked` tagging (data-sources `§6.1–6.2`; grok `ENG §7`).
- **NFL enrichment layer** — `player_xwalk` → nflverse / NGS joins (stubs only in the vision) (grok `ENG §3.5`).
- **Pre-2018 player-level backfill** via OCR/roster-diff (nothing today below `FIRST_BOX_YEAR=2018`) (our-code `boxscores.ts`; data-sources `§3`).

---

## 7. Evidence-honesty model

**The four-state model, required by both specs:** Verified / Reconstructed / Partial / Unavailable, surfaced via an `EvidenceBadge` component + last-refresh timestamp; empty modules render honest "Unavailable" panels with unlock-requirement text (grok `PRD §3 (G6)/§10`; metric-bible `SITE_MAP_DATA_CROSSWALK 'Global Site Controls'`, `SPEC §13`).

**The hard rule:** never emit fake 0/NaN when data is missing. Never coerce a missing count to 0, a missing percentage to NaN%, or an absent denominator into a ranked result (metric-bible `SPEC §13`, `SITE_MAP_DATA_CROSSWALK 'Conflicts'`).

**Why it matters — this is the founding grievance of the whole project.** The live 2025 FG Wrapped shows **0 adds for every team and NaN% management** because the underlying transaction/lineup values are absent; AFFL must display "Unavailable," and zero is shown *only* when a verified event count is genuinely zero (metric-bible `SPEC §10`; grok `METRIC_DIVERGENCES.md 'Missing waivers → Unavailable'`). The model maps cleanly onto the data-sources provenance columns (`source`, `confidence`, `cross_checked`): API pulls = Verified (confidence 1.0); roster-diff/OCR = Reconstructed (confidence < 1.0, flagged for review); partial-window seasons = Partial; missing = Unavailable (data-sources `§6.2`; `§2.4`; `§3.4`). It also underwrites the "log first, no trade-winner score until ledger reconciliation" rule and the crosswalk's per-page readiness (Ready/Partial/Blocked) so dataset completeness is tracked by page × season × entity, not assumed (metric-bible `reports/trade-log-architecture.md`, `SITE_MAP_DATA_CROSSWALK 'Conflicts'`).

---

## 8. Open questions for the grilling

1. **Architecture verdict (A / B / C).** Does the war-room cross-filter/brush interaction and private-by-default auth justify escalating past a DuckDB-offline + static-JSON hybrid to a full Postgres/Next.js rebuild? Evidence leans C; the interview decides (grok `ENG §2.2, §13`; data-sources `§6.1`; design-refs `PRD §10`).
2. **The 2018 vs 2019 player-level boundary.** `_cc` already bakes 2018 boxscores; the research bets 2019. Run the Phase-1 availability probe against leagueId 51418 to settle it — it sets the OCR frontier (data-sources `§1.4, §7, §9`; our-code `boxscores.ts`).
3. **How far to chase pre-2018 history.** Is OCR + roster-diff worth the (OCR-dominated) wall-clock cost for 2014–2017 lineup detail, knowing FAAB/failed-claims/timestamps are permanently lost? (data-sources `§2.4, §3, §6.3`).
4. **Points Forced definition check.** Confirm PF = standard Points For (submitted-lineup points). If it's an AFFL-specific calculation, that one definition must be replaced before implementation; the rest of the plan survives (metric-bible `SPEC §14`).
5. **Consolation in Combined.** Default is OFF — confirm for AFFL's Power Win Rating and Combined records (grok `DECISIONS.md D5/D6`; metric-bible 'Further Questions').
6. **Franchise identity semantics.** Does history follow the owner, the team slot, or both on ownership change? And the canonical name/alias policy (Commish/Grand Teton, Rood/Fairview, Grand Teton/Teeton, Pollywogs/Polliwogs) — `_cc` merges by real name only; the spec wants a dated `team_alias` table (metric-bible 'Conflicts', 'Further Questions'; our-code `build-data.mjs`).
7. **Trade grading.** Keep "log-only, no trade-winner score" until ledger reconciliation improves, or ship started-points grading now given `_cc`'s reconstruction already computes post-trade returns? (metric-bible `SPEC §8`, `trade-log-architecture.md`; our-code `analysis.ts`).
8. **Where do the FG "Feeler" screenshots map?** No §7 module exists — is it a real feature to design (sentiment/prediction/confidence index) or drop? (design-refs Feelers).
9. **Auction budget & storage.** What is the 2025 auction budget, and where are winning bids stored — needed before any budget-share / stars-and-scrubs / auction-return ranking (metric-bible 'Data Needed Next').
10. **Reconciliation gate for publishing history.** Adopt the rule that a season publishes only after final standings are re-derivable purely from the matchups table vs `mStandings`, and every OCR lineup row has a matching-winner matchup? (data-sources `§9`; metric-bible 'Recommended Build Order').
11. **NFL-join depth for v1.** Ship stubs only (Grok's plan) or ingest nflverse/NGS now to unlock injury report + HOF/roster-concentration modules — accepting the 2014–2015 NGS gap? (grok `ENG §3.5`; data-sources `§4.1–4.4`).

---

## 9. Sources

**Grok vision (`/Users/chilly/Projects/FGwebsite/grokergenius/docs/`):** `ENGINEERING_SPEC.md` (§1–§7, §10, §13), `PRD.md` (§3, §6–§12), `DATA_ARCHITECTURE.md`, `DECISIONS.md` (D2, D3, D5/D6, D8, D9, D10), `METRIC_DIVERGENCES.md`, `WRAPPED_SLIDE_MAP.md`.

**AFFL metric bible:** `AFFL_ANALYTICS_WEBSITE_SPEC.md` (§1–§14), `AFFL_SITE_MAP_DATA_CROSSWALK.md` (Product Rule, Complete Site Map, Global Site Controls, Page-by-Page Crosswalk, Core Metric Contract, Required Data Model, Conflicts, What the Current Evidence Actually Supports, Recommended Build Order, Data Needed Next, Caveats and Safety), `reports/trade-log-architecture.md`.

**ESPN data-source research:** `ESPN_FANTASY_RESEARCH.md` (§1.1–§1.9, §2.1–§2.5, §3.1–§3.4, §4.1–§4.4, §5, §6.1–§6.3, §7, §8, §9).

**Our code (`/Users/chilly/Projects/FGwebsite_cc`):** `README.md`; `src/App.tsx`; `src/types.ts`; `scripts/lib.mjs`, `scripts/build-data.mjs`, `scripts/fetch-espn.mjs`, `scripts/build-boxscores.mjs`, `scripts/build-transactions.mjs`, `scripts/build-roster-age.mjs`, `scripts/fetch-player-ages.mjs`; `src/lib/boxscores.ts`, `src/lib/transactions.ts`, `src/lib/analysis.ts`, `src/lib/idealLineup.ts`, `src/lib/rbBuild.ts`, `src/lib/categoryStats.ts`, `src/lib/rosterConstruction.ts`, `src/lib/rosterAge.ts`, `src/lib/util.ts`; `src/pages/Drafts.tsx`, `RosterLab.tsx`, `RotoStandings.tsx`, `OwnerProfile.tsx`, `Scoreboard.tsx`, `Trends.tsx`.

**Design references (`/Users/chilly/Projects/AFFL/AFFL_FantasyGenius/`):** `AFFL_SkillRadar.png`, `AFFL_Luck.png`, `AFFL_Scoring.png`, `AFFL_ScheduleBalance.png`, `AFFL_NotableMatchups.png`, `AFFL_2025Draft.png`, `AFFL_2025GoodAwards.png`, `AFFL_2025BadAwards.png`, `AFFL_Feelers.png`, `AFFL_2025Feeler.png`, `AFFL_FeelerHistory.png`, `AFFL_2025_Shippy.png`, `AFFL_GarrettWilson.png`, `AFFL_Fun.png`, `AFFL_HomePageFantasyGenius.html`, `Home_FantasyGenius.html`, `chromeinspect/`; plus grok `PRD.md §6/§10` and `ENGINEERING_SPEC.md §6.1–6.2`.