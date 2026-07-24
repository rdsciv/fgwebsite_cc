# ADR-0001 — Data & serving architecture

- **Status:** Accepted (2026-07, from grilling)
- **Context docs:** `docs/research/AFFL_PLAYER_PLATFORM.md` §2, §7; `docs/CONTEXT.md` D2

## Context

`FGwebsite_cc` today is a static-JSON Vite/React SPA on GitHub Pages: a Node pipeline pulls ESPN
once at build time, bakes computed JSON into `public/data/`, the browser fetches it. No server, no
DB, no runtime credentials. The forward vision adds (a) a completed league-analytics suite, and
(b) a v2 PlayerProfiler-grade player database over the **whole NFL** (~4–6k players × 12 seasons of
weekly + play-by-play + Next Gen Stats), all **linked like Sleeper** via ESPN `playerId → gsis_id`.

The research recommended a no-server "refined option C" (DuckDB → static JSON shards + DuckDB-WASM).
The commissioner chose instead to **keep a served database in play for v1**, which — combined with
the whole-NFL universe (D3) and a private admin surface (D7) — a served Postgres serves better than
static shards alone.

## Decision

A three-layer architecture:

1. **DuckDB + Parquet offline warehouse** — the sole heavy-compute engine and source of truth.
   Medallion model (bronze raw / silver normalized entities / gold marts). The full NFL catalog
   (~350 MB Parquet, play-by-play ~70% of it) is **too large for Supabase's 500 MB free tier**, so
   **play-by-play and other play-grain data stay in Parquet**, queried by DuckDB where needed.
2. **Supabase (Postgres)** — holds only the **compact gold marts** (team metrics, `player_profile`,
   search index) to serve the whole-NFL player/query layer and to provide **auth** for the private
   admin (commissioner desk, refresh jobs, writes). Public reads via anon key + RLS; service key in
   CI secrets only.
3. **Static JSON on GitHub Pages** — the **public league dashboard** keeps its current static-JSON
   delivery (gold → `public/data/*.json`), unchanged. Free, fast, no auth needed for read.

**Join spine:** every AFFL reference keys on ESPN `playerId`; every NFL fact keys on `gsis_id`;
`player_xwalk` (from `ff_playerids`) is the only bridge. `teamId` is deliberately not a key.

**Secrets:** ESPN `SWID`/`espn_s2` live in `.env` locally + GitHub Actions encrypted secrets; never
shipped to the browser, never committed inside data. Refresh = backfill-once for frozen history +
in-season GitHub Actions cron for the current season only.

## v1 vs v2 boundary

- **v1** ships the league-analytics suite on the **static site** (no schema migration needed) and
  stands up **Supabase for auth + the private admin** only. Gold marts are authored to be
  **Supabase-portable from day one**.
- **v2** ingests the whole-NFL data into the DuckDB warehouse + Supabase gold marts and builds the
  player platform.

## Consequences

- **Pro:** public dashboard stays free/static; heavy NFL compute is $0 offline; auth + whole-NFL
  queries are first-class when v2 lands; evidence labels flow from `load_manifest` +
  `player_xwalk.match_status` into every gold row.
- **Con / accepted cost:** a served DB adds ops (Supabase project, region, key rotation, idle
  auto-pause awareness) and some cost risk beyond the free tier for a hobby league; two stores
  (Parquet + Postgres) to keep coherent; ESPN cookie expiry can break the in-season cron
  (manual rotation, commissioner-owned).
- **Revisit if:** hosting/bandwidth on Pages is exceeded (move static assets to object storage/CDN),
  or Supabase costs outgrow the league's appetite (fall back to the no-server refined-C for the
  public surface).
