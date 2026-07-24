# AFFL Analytics v1 — The League Truth Suite PRD
*Author: Commissioner (rdsciv) · 2026-07 · Status: In Review*

## 1. Summary

The AFFL history dashboard already shows **what happened** across 12 seasons — standings, scores,
drafts, trades. v1 adds the layer the league actually argues about: **what was deserved.** A
luck-adjusted / schedule-aware / decision-quality "truth suite," plus an honest **trade-chain
ledger**, that settles "I only lost because of my schedule" and "you got lucky" with numbers — and
never with fake ones. It ships on the existing free static site; no viewer needs an account.

## 2. Stakeholders & Sign-off

| Name | Role | Sign-off |
|---|---|---|
| Commissioner (rdsciv) | Product owner, data source of truth, alias-map author | ☐ |
| The managers (12) | Audience / users | n/a |
| Claude Code | Build | ☐ |

## 3. Problem & Customer Evidence

Fantasy league bragging rights run on two perennial arguments — **"I was unlucky"** and **"my
schedule was brutal"** — and today nobody can settle them, because the data lives where no one can
audit it and the one tool that tries is untrustworthy:

- **ESPN locks it away.** 12 seasons (2014–2025) of this league sit behind ESPN's private,
  cookie-authenticated API. There is no league-owned, auditable record; when ESPN changes an
  endpoint (it moved hosts once, ~Apr 2024) or a manager's memory, the argument has no referee.
- **The reference tool fabricates numbers.** Fantasy Genius's 2025 AFFL "Wrapped" shows **0 adds for
  every team and `NaN%` management efficiency** — because the underlying transaction/lineup data is
  missing and it coerces missing values to zero instead of admitting it. A stat that's confidently
  wrong is worse than no stat; it poisons the argument. *(This is the founding grievance of the
  project — see `docs/research/AFFL_FRESH_EYES.md` §7.)*
- **Our own site describes, but doesn't adjudicate.** `_cc` ships today with real analytics (optimal-
  lineup regret, trade reconstruction, roto, all-play *record*), but it stops short of the framing
  that ends arguments: it computes the all-play record yet never says "you were the 2nd-best team and
  finished 6th because of luck," never ranks schedule strength, never grades a trade three flips
  later.

The proof that people want this is the arguing itself — every draft night and every playoff seeding
reopens the same unfalsifiable claims. v1 makes them falsifiable.

## 4. Goals & Success Metrics

- **Primary outcome (adoption):** the truth suite is *used to argue* — opened during draft night and
  playoff seeding, screenshots posted to the league chat. **Instrumentation is a gap today** — there
  is no web analytics on the site. `[data pending — @commissioner to add a lightweight, cookieless
  counter (GoatCounter/Plausible) so "pages viewed during Aug–Jan" is measurable]`.
- **Correctness gates (hard, measurable now):**
  - Starter points reconcile to team-week total: **100%** where lineups exist (tol 0.01). *(Already
    verified for 1,580 team-weeks; v1 must not regress it.)*
  - Final standings re-derivable from the matchups table vs ESPN `mStandings`: **100%** of seasons.
  - Point Origins (Drafted+Traded+Waiver+FA) = PF for every **Verified** team-season: **100%**.
  - Zero fabricated values: **0** cells render `0`/`NaN` where the true state is "missing" (they
    render **Unavailable**).
- **Guardrail:** page weight / first load of the dashboard does not regress materially (static JSON
  budget) as new marts are added.
- **Non-goals (v1):** the whole-NFL player platform + player pages (v2); FAAB spend & waiver-regret
  (v2 — needs a `bidAmount` re-scrape); auth-gated *viewing* (dashboard stays public); any Fantasy
  Genius / PlayerProfiler UI or numbers.

## 5. Solution & User Flow

Two additions to the existing site, both phase-aware (Regular / Postseason / Combined) and
evidence-tagged.

**5.1 The Truth Suite** — a season view that reframes the standings:

```
┌ 2025 · Phase: [Regular ▸ Postseason · Combined] ─────────── Evidence: ✓Verified ─┐
│  TEAM            W-L   PF     PWR   xWins  LUCK   MEDIAN  SOS   MGMT%  DEC%        │
│  Alex Renney     9-5   1723   .612   8.6   +0.4   8-6     .518  91.2   84 ▸        │
│  Ryan Childress  10-4  1610   .544   7.6  +2.4↑   7-7     .560  88.0   79 ▸        │  ← "lucky"
│  Patrick O'Neill  7-7  1698   .590   8.3  -1.3↓   9-5     .471  86.5   82 ▸        │  ← "robbed"
│  …                                                                                 │
│  click a row → team's luck timeline, schedule replayed vs every rival, blunders    │
└────────────────────────────────────────────────────────────────────────────────┘
```

Primary flow: manager opens the season, flips to **Combined**, sorts by **Luck** → sees Childress
was +2.4 wins lucky and O'Neill −1.3 unlucky → clicks O'Neill → **"replayed against all 11 schedules,
he makes the playoffs in 9 of them."** Argument settled. Every number carries an evidence chip; a
metric-definition drawer explains PWR/Luck on hover.

**5.2 The Trade-Chain Ledger** — the distinctive feature. A trade is not judged on the day it
happened; it's judged by everything its pieces *became*:

```
Trade · 2021 wk3   Renney ⇄ Sanchez
  Renney received:  Player A  ── started 6 wks, 74.2 pts ──┐
     └▸ 2022 wk7  Player A traded → Player B ──────────────┤  chain +/-
            └▸ 2023 wk1 Player B traded → Player C ─────────┘  = +38.6 (rolls up whole lineage)
  Sanchez received: Player D  ── 41.1 pts, still rostered ── chain +/- = +41.1
```

Each received asset is expandable; if it was flipped again, the chain extends, and the **cumulative
+/- rolls up the entire lineage** (points its descendants scored for that team) rather than stopping
at the first hop. No standalone "winner" badge — the rolled-up chain value *is* the verdict, tagged
**Reconstructed** because it's inferred from roster movement.

## 6. Requirements

**Functional**
1. Compute, per team-season and **per phase** (Reg/Post/Combined, consolation excluded from Combined
   by default): PF/PA/diff, **PWR**, Expected Wins, **Luck Index / Lucky Wins / Unlucky Losses / Net
   Luck**, **median & all-play** standings, **SOS / schedule-imbalance**, **Management % / Points
   Left on Bench / Correct-Decision Rate**.
2. Reconstruct trades (extend existing `reconstructTrades`) into **trade chains**: link each received
   asset to its subsequent trade(s) and roll up cumulative +/- across the full lineage; expose an
   expandable chain UI.
3. Attribute started points to acquisition source (extend existing Point-Origins) and reconcile to PF.
4. An **Awards/superlatives** view aggregating the above (season "Emmys").
5. Every value renders an **evidence label** (Verified/Reconstructed/Partial/Unavailable) and a
   metric-definition drawer; a global **Phase** toggle.

**Non-functional**
1. Public dashboard stays **static JSON on GitHub Pages** (no server, no runtime creds). Supabase is
   introduced in v1 for **auth + private admin only** (commissioner desk / refresh).
2. Accessibility: keep the colorblind-safe categorical palette; luck/±/rank never encoded by color
   alone (WCAG 2.1 AA); tables sortable + keyboard-navigable.
3. Gold marts authored **Supabase-portable** (stable keys) from day one per ADR-0001.

**Edge cases & user states**
1. **2014–2017 (team-only, no player data):** phase/management/decision/roto render **Unavailable**
   with an unlock note — never 0. Luck/median/SOS still compute (score-based) and are **Verified**.
2. **Consolation games:** excluded from Combined by default; toggle to include.
3. **A traded asset never flipped again:** chain is depth-1 (just its own started points).
4. **A trade-chain asset later dropped, not traded:** chain terminates; points scored *after* the
   drop for a different team are shown as drop-context, not attributed up the chain.
5. **Duplicate ESPN accounts / renamed teams:** merged under one manager (D5); a season with an
   unresolved alias shows a "needs alias" flag, not a duplicate row.
6. **First-time viewer:** the Truth Suite defaults to the latest season, Combined phase, sorted by
   Luck, with the definition drawer one hover away.

## 7. Competitive Landscape

| Product | What it does here | Implication for us |
|---|---|---|
| **ESPN Fantasy** | Raw current-season data behind a private API; no history UI, no adjusted metrics | We own the archive + the adjudication ESPN never provides. |
| **Fantasy Genius** | Attempts Wrapped/luck/management, but shows **fake 0/NaN** on missing data | Reference for *which* metrics, anti-pattern for honesty — evidence labels are our wedge. |
| **Sleeper** | Best-in-class *linking* (one player ID, everything clickable) | Adopt the linking discipline (v2); not a competitor for 12-yr league truth. |

## 8. Tradeoffs & Risks

| Risk / downside | Likelihood | Mitigation | Owner |
|---|---|---|---|
| Served DB (Supabase) adds ops/cost to a hobby site | Med | v1 uses it for auth/admin only; public reads stay static; revisit no-server fallback if cost bites | Commissioner |
| Trade-chain +/- is inferred (roster-diff) → disputable | Med | Tag **Reconstructed**; show the full chain so it's auditable, not a black-box score | Build |
| ESPN cookie expiry breaks in-season refresh | High (annual) | Manual, commissioner-owned rotation; documented step; static site keeps serving last good data | Commissioner |
| "Truth" numbers reveal someone was *worse* than their record | High (by design) | That's the point — but frame luck neutrally (variance, not blame) | Product |
| Scope creep from v2 (whole-NFL) leaking into v1 | Med | Hard v1/v2 line in ADR-0001; player platform explicitly out | Product |

Honest downside: v1 will tell at least one manager their trophy was partly luck, and at least one
that they were the best team that never won. That friction is the feature, not a bug.

## 9. Dependencies, Timeline & Milestones

- **Dependencies:** existing `league.json` + boxscores (2018+) marts; a **canonical alias map** from
  the commissioner (Rood/Fairview, Commish/Grand Teton, Polliwogs/Pollywogs, Grand Teton/Teeton) —
  **blocks identity-correct history** `[@commissioner]`; Supabase project for admin/auth `[@commissioner]`.
- **Milestones (sequencing, not dates):**
  1. Luck suite + median/all-play + SOS (score-based, all seasons, Verified).
  2. Phase splits threaded through existing reducers.
  3. Correct-Decision Rate (reuses optimal-lineup solver).
  4. Trade-chain ledger.
  5. Awards view + evidence-label/metric-drawer polish.
  6. Supabase admin/auth shell.

## 10. Open Questions

1. `@commissioner` — supply the canonical **alias/identity map**; confirm history follows the
   **owner** (assumed) on every merge.
2. `@commissioner` — confirm **PF = standard Points For** (submitted-lineup points); if AFFL uses a
   custom PF, that one definition must change before build.
3. `@commissioner` — is **consolation-excluded-from-Combined** correct for AFFL's records?
4. `[data pending]` — add a cookieless view counter so the adoption metric is real, or accept
   adoption stays qualitative for v1?
5. `@commissioner` — Supabase region + who owns cookie rotation / the admin login.
