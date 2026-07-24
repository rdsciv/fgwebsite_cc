# AFFL — Project Context & Glossary

The shared language + settled decisions for the AFFL analytics site (`FGwebsite_cc`). Kept clean
so every doc and ticket uses the same words. Companion research: `docs/research/AFFL_FRESH_EYES.md`,
`docs/research/AFFL_PLAYER_PLATFORM.md`. Architecture rationale: `docs/decisions/ADR-0001-architecture.md`.

## Glossary (canonical metric language)

| Term | Definition |
|---|---|
| **Points Forced (PF)** | Σ of a team's submitted-starter points in a phase. AFFL label for standard "Points For". **Assumption: PF = standard Points For** (submitted-lineup points), pending final confirmation. |
| **Points Allowed (PA)** | Σ of opponents' scores. Differential = PF − PA. |
| **Power Wins / Power Win Rating (PWR)** | All-play: each week a team is scored as if it played every other team (½ for ties). PWR = Power Wins / (games × (N−1)). Power Rank = ordering by PWR. |
| **Luck suite** | Luck Index = Win% − PWR · Expected Wins = PWR × games · Lucky Win = an actual win while scoring in the bottom half that week · Unlucky Loss = an actual loss while scoring top half · Net Luck = lucky wins − unlucky losses. |
| **Median / All-Play standings** | Standings by weekly-median record and by the full all-play matrix — the "league argument" view. |
| **Phase** | **Regular**, **Postseason**, **Combined**. Every aggregate is computable per phase. **Consolation is excluded from Combined by default.** |
| **Optimal lineup / Management Score** | Management = actual points ÷ best legal lineup (exclusive slots + one FLEX). Points Left on Bench = optimal − actual. **Correct Decision Rate** = share of start/sit calls where the started player ≥ the best benched eligible alternative. |
| **Roto (10-cat) / Skill Radar** | Re-score the league as a 10-category rotisserie over starters' raw NFL stats; rank 12 teams per cat (N…1), sum. Radar plots a team vs league-average polygon. |
| **SOS / Schedule Imbalance** | Strength of schedule (opponents' PF / all-play%); imbalance = actual meetings − expected balanced meetings. |
| **Point Origins / Acquisition Source** | Every started point attributed to how the player was acquired: **Drafted / Traded / Waiver / FA**. Drafted+Traded+Waiver+FA = PF. |
| **Trade chain (trade tree)** | A reconstructed trade, PLUS the transitive lineage: when an asset a team received is later traded again, the chain extends (expandable), and the **cumulative +/- rolls up the entire lineage**, not just the first hop. See ADR + PRD. |
| **Manager / Owner** | The persistent person. **League identity is keyed by manager/owner** — duplicate ESPN accounts and team renames merge under one manager. |
| **Franchise / team_season / team_alias** | Franchise = continuous team identity; team_season = one (franchise, year); team_alias = dated alias→canonical map (needed from the commissioner). |
| **Evidence labels** | Every computed value is tagged **Verified / Reconstructed / Partial / Unavailable**. **Never emit a fake 0 or NaN** — missing data renders "Unavailable". |
| **player_xwalk** | The crosswalk ESPN `playerId` → `gsis_id` (+ pfr/sleeper/mfl/sportradar ids) via DynastyProcess `ff_playerids`. The spine that links league data to NFL data. `playerId` is the stable join key; `teamId` is NOT. |
| **FAAB** | Free-agent acquisition budget bids. **v2** (current pipeline drops `bidAmount`; needs a re-scrape). |
| **Reference products** | **Fantasy Genius**, **PlayerProfiler**, **Sleeper** — idea/metric/UX references only. Never clone their UI/branding or ship their proprietary numbers. |

## Decision log (from grilling, 2026-07)

| ID | Decision | Rationale |
|---|---|---|
| D1 | **v1 = league-analytics suite first** (luck/median/SOS/phase/decision-rate/auction-share/awards + trade-chain), on the current static site. Player platform + NFL warehouse = **v2**. | Fastest visible value; defers heavy infra. |
| D2 | **Architecture:** DuckDB offline warehouse (compute/backfill; play-by-play stays in Parquet) → loads compact gold marts into **Supabase** (served, whole-NFL + auth-ready) → still emits **static JSON** for the public league dashboard. **A served DB is in play for v1** (admin/auth). | User chose to keep a served DB in play; coheres with whole-NFL v2 + private admin. See [ADR-0001](decisions/ADR-0001-architecture.md). |
| D3 | **Player universe (v2): whole NFL** (~4–6k, up to ~10k), not just AFFL-rostered. | Full PlayerProfiler-grade coverage. |
| D4 | **Profile metric bar (v2): free metrics + a few re-implemented composites** (Speed Score, Best-Comparable kNN, Production Premium≈EPA). Pre-2022 charting tagged **Partial**; **no paid data**. | Best value without licensing cost. |
| D5 | **Identity: by manager/owner** (merge duplicate ESPN accounts + renames). Commissioner supplies the canonical alias map. | Friend league; person identity persists, teamId doesn't. |
| D6 | **Trades: log + transitive trade-chain** with cumulative +/- across the whole lineage; expandable chain UI. No standalone "winner" verdict beyond the chain's rolled-up value. | User's explicit feature ask; richer than plain log-only. |
| D7 | **Access: public dashboard + private admin** (Supabase auth for commissioner desk / refresh / writes). | Balances openness with control; site is already public. |
| D8 | **FAAB + waiver-regret → v2** (needs a `bidAmount` re-scrape). | Only Bucket-1 item needing a re-scrape; don't block v1. |
| D9 | **Assumptions locked:** PF = standard Points For; consolation excluded from Combined by default; ESPN cookie rotation manual/~annual/commissioner-owned; CC-BY-SA credits in footer + metric drawer. | Sensible defaults from the specs. |
| D10 | **Evidence honesty everywhere** — Verified/Reconstructed/Partial/Unavailable; never fake 0/NaN. | The founding grievance (FG's 2025 Wrapped shows 0 adds / NaN% management). |
