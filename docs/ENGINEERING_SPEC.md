# AFFL v1 — Engineering Spec (League Truth Suite)

Implements `docs/PRD.md` under `docs/decisions/ADR-0001-architecture.md`. Scope is **v1 only**:
extend the existing static-JSON pipeline; no NFL warehouse, no player pages (v2).

## 1. Principles

- **Extend, don't rebuild.** v1 is new metrics + views over the *existing* build-time pipeline
  (`scripts/*.mjs` → `public/data/*.json` → Vite/React SPA). No architecture change for the public
  dashboard; Supabase enters only for admin/auth (§8).
- **Phase-aware everywhere.** Every new aggregate is computed for Regular / Postseason / Combined
  (consolation excluded from Combined by default). Matchups already carry phase flags.
- **Evidence-tagged everywhere.** Every emitted value carries a label
  (Verified/Reconstructed/Partial/Unavailable); missing → Unavailable, never 0/NaN.
- **Reconcile or don't ship.** New marts pass the quality gates in §9 before deploy.

## 2. Data flow (unchanged shape, new marts)

```
scripts/build-data.mjs      → public/data/league.json          (+ new: season truth marts)
scripts/build-boxscores.mjs → public/data/boxscores/{y}.json    (existing; feeds mgmt/decision)
scripts/build-transactions  → public/data/transactions/{y}.json (existing; feeds point-origins/trades)
NEW src/lib/*               → client-side compute where cheap; heavy rollups baked in build-data
```

New baked outputs (added to `league.json` or sibling files):
- `teamSeasonMetrics[phase]` — PF/PA/diff, PWR, xWins, luck suite, median/all-play, SOS.
- `teamWeekMetrics` — management %, points-left, correct-decision flags (2018+).
- `tradeChains` — reconstructed trade lineage with rolled-up +/-.
- `awards` — superlatives aggregated from the above.
- `coverage` — per season × metric-family availability → drives evidence labels.

## 3. Metric formulas (canonical — see `docs/CONTEXT.md`)

Compute in `scripts/build-data.mjs` (all-seasons, score-based) and, for player-level pieces, over
`boxscores` (2018+):

- **All-play / PWR.** For each team-week, wins = # opponents outscored + ½·ties among the other N−1.
  `PWR = ΣweekWins / (games × (N−1))`. Power Rank = order by PWR desc.
- **Expected Wins** `xW = PWR × games`. **Luck Index** `= winPct − PWR`. **Lucky Win** = win while
  in bottom half of that week's scores; **Unlucky Loss** = loss while in top half. **Net Luck** =
  luckyWins − unluckyLosses.
- **Median record.** Per week, W if team score ≥ league median that week (½ at exactly median).
- **SOS / imbalance.** SOS = mean(opponent PF or opponent all-play%) over the actual slate.
  Imbalance = actualMeetings(pair) − expectedMeetings (uniform over shared seasons). Optional
  schedule-replay: recompute a team's W-L through each *other* team's slate.
- **Management.** Reuse `src/lib/idealLineup.ts` `computeTeamPotential` (optimal legal lineup:
  exclusive slots then FLEX). `mgmt% = actual/optimal`; `pointsLeft = optimal − actual`.
  **Correct-Decision Rate** = share of started players that were ≥ the best benched *eligible*
  alternative for their slot that week.
- **Roto.** Existing `src/lib/categoryStats.ts` (confirm 10-cat label vs current "9-category" title).

All of the above accept a **phase filter** (subset of weeks/matchups by `isReg`/`isPlayoff` and
`isConsolation`).

## 4. Trade-chain algorithm (the distinctive feature)

Extends `reconstructTrades` in `src/lib/analysis.ts` (which already builds bilateral trades from
roster movement + post-trade points).

```
Build a directed lineage per received asset:
1. From reconstructed trades, for each trade T with sides (teamA, teamB):
     for each asset `a` teamA received in T:
       node(a, T, receivingTeam=teamA)
2. Link forward: if asset `a` (owned by teamA after T) appears as the *given* asset in a later
   trade T', add edge node(a,T) → the assets teamA received in T'. (Same player leaving teamA
   with no waiver/FA passthrough = the traded-away leg.)
3. Terminal states per node: STILL_ROSTERED (season end) | TRADED_AGAIN (edge exists) |
     DROPPED (left roster via waiver/FA release — chain terminates, points-after shown as context).
4. Rolled-up value for a chain root = Σ started points scored *for the receiving team* by every
   node in the lineage during that team's tenure window (recursively down TRADED_AGAIN edges).
```

Output `tradeChains[]`: `{ tradeId, season, week, sides:[{team, receivedAssets:[assetNode]}] }`
where `assetNode = { playerId, startedPoints, terminal, next?: tradeId, rolledUpPlusMinus }`.
Tag **Reconstructed** (roster-diff inference); 2018+ only (needs player points) → pre-2018 chains
render **Unavailable**.

Edge cases: multi-asset trades (fan-out), circular guards (a player reacquired), and week-granularity
only (no intra-week ordering) — documented as Reconstructed limitations.

## 5. Phase plumbing

Add a `Phase = 'reg' | 'post' | 'combined'` selector (global, in the season view). Thread it into the
metric reducers as a week/matchup predicate. `combined` = reg ∪ post, **minus consolation** unless a
`includeConsolation` toggle is set. Where a phase has no data for a season (e.g. player-level pre-2018),
the metric returns `Unavailable`, surfaced as a badge.

## 6. Evidence labels

```ts
type Evidence = 'Verified' | 'Reconstructed' | 'Partial' | 'Unavailable';
```
Derivation: score-based metrics (luck/median/SOS) = **Verified** all seasons; player-level
(mgmt/decision/roto/point-origins/trade-chain) = **Verified 2018+**, **Unavailable** 2014–2017;
trade chains = **Reconstructed**; any metric missing an input = **Unavailable** (never 0/NaN).
A `coverage` map (season × family) is baked and read by an `<EvidenceBadge>` + `<MetricDrawer>`.

## 7. UI (new/changed components)

- `src/pages/SeasonPage.tsx` (or a new `TruthSuite` section) — the reframed standings table
  (PRD §5.1): sortable columns incl. PWR, xWins, Luck, Median, SOS, Mgmt%, Dec%; row-click → team
  luck timeline + schedule-replay + blunders.
- `src/components/PhaseToggle.tsx` (new), `src/components/EvidenceBadge.tsx` (new),
  `src/components/MetricDrawer.tsx` (new).
- `src/pages/RosterLab.tsx` / a `TradeChains` view — expandable trade-chain tree (PRD §5.2).
- `src/pages/RecordsBook.tsx` — Awards/superlatives additions.
- Keep the colorblind-safe palette; never encode luck/rank by color alone (WCAG 2.1 AA).

## 8. Supabase admin shell (auth only in v1)

- Public dashboard reads **static JSON** (no Supabase on the read path).
- A minimal **private admin** (commissioner desk): Supabase Auth (email/OTP) gating a page that
  triggers/audits the refresh and shows data-quality/coverage. Anon key + RLS for any public rows;
  **service key only in GitHub Actions secrets**. No player/pbp data in Supabase in v1 (that's v2).
- Gold marts authored with stable keys so they're Supabase-portable later (ADR-0001).

## 9. Testing & quality gates (must pass before deploy)

1. **Reconciliation:** Σ starter points == team-week total, all team-weeks with lineups (tol 0.01).
2. **Standings re-derivation:** final standings from the matchups table == ESPN `mStandings`, every
   season.
3. **Point Origins == PF** for every Verified team-season.
4. **No fabricated values:** unit test asserts missing inputs yield `Unavailable`, never `0`/`NaN`.
5. **Phase invariants:** reg + post (minus consolation) == combined totals.
6. **Trade-chain integrity:** every chain node's rolled-up +/- equals the recursive sum of its
   descendants' tenure points; no cycles escape the guard.
7. `npm run build` type-checks clean; page renders verified in a headless browser (as done for Roto
   Standings).

## 10. File-change map

| Area | Files |
|---|---|
| Metric compute | `scripts/build-data.mjs` (+ luck/median/SOS/PWR marts, coverage); new `src/lib/luck.ts`, `src/lib/schedule.ts`, `src/lib/phase.ts` |
| Management/decision | reuse `src/lib/idealLineup.ts`; new `src/lib/decisions.ts` |
| Trade chains | extend `src/lib/analysis.ts` (`reconstructTrades` → chains) |
| Types | `src/types.ts` (+ Phase, Evidence, metric/chain shapes) |
| UI | `src/pages/SeasonPage.tsx`, `RecordsBook.tsx`, `RosterLab.tsx`; new `PhaseToggle`, `EvidenceBadge`, `MetricDrawer` |
| Admin | new Supabase project + a gated admin route (v1: auth + refresh audit only) |
| Docs | this spec, `PRD.md`, `CONTEXT.md`, `ADR-0001` |
