import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  LabelList,
  ScatterChart,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from 'recharts';
import { useLeague } from '../data';
import { PageHead, SectionHead, StatTile, Card } from '../components/bits';
import { OwnerChip } from '../components/OwnerChip';
import { SortableTable, type Column } from '../components/SortableTable';
import { loadBoxscore, hasBoxscores, FIRST_BOX_YEAR } from '../lib/boxscores';
import { loadTransactions, type AcqEvent } from '../lib/transactions';
import { loadRosterAge } from '../lib/rosterAge';
import { computeSeasonAnalysis, type PickROI, type TeamRosterAnalysis, type Trade, type TradePlayer } from '../lib/analysis';
import { computeTeamPotential, type TeamPotential } from '../lib/idealLineup';
import { computeRbBuild, type RbBuildPoint } from '../lib/rbBuild';
import { clsx, fmt, fmt0, linreg, posColor } from '../lib/util';
import type { Season, SeasonBox, SeasonRosterAge } from '../types';

const axisTick = { fill: 'var(--ink-3)', fontSize: 12 };

const C_DRAFT = 'var(--s1)'; // blue
const C_TRADE = 'var(--s2)'; // orange
const C_WAIVER = 'var(--s7)'; // violet
const C_FA = 'var(--s3)'; // green

export function RosterLab() {
  const { league, ownerName } = useLeague();
  const boxYears = league.meta.seasons.filter(hasBoxscores);
  const [year, setYear] = useState(league.meta.lastSeason);
  const [box, setBox] = useState<SeasonBox | null>(null);
  const [tx, setTx] = useState<AcqEvent[]>([]);
  const [rosterAge, setRosterAge] = useState<SeasonRosterAge | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!hasBoxscores(year)) {
      setBox(null);
      setTx([]);
      setRosterAge(null);
      return;
    }
    setLoading(true);
    Promise.all([loadBoxscore(year), loadTransactions(year), loadRosterAge(year)]).then(([b, t, ra]) => {
      if (!alive) return;
      setBox(b);
      setTx(t?.events ?? []);
      setRosterAge(ra);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [year]);

  const season = league.seasons.find((s) => s.year === year);
  const analysis = useMemo(() => (box && season ? computeSeasonAnalysis(box, season, tx) : null), [box, season, tx]);
  const potential = useMemo(() => (box && season ? computeTeamPotential(box, season) : null), [box, season]);
  const rbBuild = useMemo(() => (box && season ? computeRbBuild(season, box) : null), [box, season]);

  return (
    <div className="page">
      <PageHead
        eyebrow="Draft × Scoreboard"
        title="Roster Lab"
        lede={
          <>
            Every rostered player is joined to the auction draft by player id, so we can see where each
            team's points came from — its own draft picks, players acquired from other managers, or free-agent
            pickups — and what each team's roster was worth at draft-day prices. Player-level data begins in {FIRST_BOX_YEAR}.
          </>
        }
      />

      <div className="year-strip" style={{ marginBottom: 16 }}>
        {boxYears.map((y) => (
          <button key={y} className={clsx('year-btn', y === year && 'active')} onClick={() => setYear(y)}>
            {y}
          </button>
        ))}
      </div>

      {loading && <div className="empty">Joining {year} rosters…</div>}

      {!loading && analysis && season && potential && rbBuild && (
        <RosterAnalysis
          analysis={analysis}
          potential={potential}
          rbBuild={rbBuild}
          rosterAge={rosterAge}
          season={season}
          year={year}
          ownerName={ownerName}
        />
      )}
    </div>
  );
}

function pctOf(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function RosterAnalysis({
  analysis,
  potential,
  rbBuild,
  rosterAge,
  season,
  year,
  ownerName,
}: {
  analysis: ReturnType<typeof computeSeasonAnalysis>;
  potential: TeamPotential[];
  rbBuild: RbBuildPoint[];
  rosterAge: SeasonRosterAge | null;
  season: Season;
  year: number;
  ownerName: (id: string) => string;
}) {
  const { teams, picks, trades } = analysis;

  // KPI highlights
  const selfMade = [...teams].sort((a, b) => pctOf(b.ptsDraft, b.starterPts) - pctOf(a.ptsDraft, a.starterPts))[0];
  const trader = [...teams].sort((a, b) => b.ptsTrade - a.ptsTrade)[0];
  const wireGM = [...teams].sort((a, b) => b.ptsWaiver + b.ptsFA - (a.ptsWaiver + a.ptsFA))[0];
  const valuePick = [...picks].filter((p) => p.bid >= 5 && p.ppd != null && !p.traded).sort((a, b) => (b.ppd ?? 0) - (a.ppd ?? 0))[0];

  // Values & busts are DRAFT-AND-KEEP outcomes only — players traded away are judged in the
  // Trades section (their production followed them to the new team, so a trade isn't a bust).
  const values = [...picks].filter((p) => p.bid >= 5 && p.ppd != null && !p.traded).sort((a, b) => (b.ppd ?? 0) - (a.ppd ?? 0)).slice(0, 12);
  const busts = [...picks].filter((p) => p.bid >= 15 && !p.traded).sort((a, b) => (a.ppd ?? 0) - (b.ppd ?? 0)).slice(0, 12);

  const rosterCols: Column<TeamRosterAnalysis>[] = [
    { key: 'team', header: 'Team', align: 'left', sortable: true, value: (t) => t.teamName, render: (t) => <OwnerChip id={t.ownerId} name={ownerName(t.ownerId)} team={t.teamName} /> },
    { key: 'spend', header: 'Draft $', sortable: true, value: (t) => t.draftSpend, render: (t) => <span className="tnum">${fmt0(t.draftSpend)}</span> },
    { key: 'finalCost', header: 'Final Roster $', sortable: true, value: (t) => t.finalRosterCost, render: (t) => <span className="tnum">${fmt0(t.finalRosterCost)}</span> },
    { key: 'retained', header: 'Kept', sortable: true, value: (t) => t.finalRosterDrafted, render: (t) => <span className="tnum">{t.finalRosterDrafted}/{t.finalRosterSize}</span> },
    { key: 'ptsDraft', header: 'Draft', sortable: true, value: (t) => t.ptsDraft, render: (t) => <span className="tnum">{fmt0(t.ptsDraft)}</span> },
    { key: 'ptsTrade', header: 'Trade', sortable: true, value: (t) => t.ptsTrade, render: (t) => <span className="tnum">{fmt0(t.ptsTrade)}</span> },
    { key: 'ptsWaiver', header: 'Waiver', sortable: true, value: (t) => t.ptsWaiver, render: (t) => <span className="tnum">{fmt0(t.ptsWaiver)}</span> },
    { key: 'ptsFA', header: 'Free Agent', sortable: true, value: (t) => t.ptsFA, render: (t) => <span className="tnum">{fmt0(t.ptsFA)}</span> },
  ];

  const maxTotal = Math.max(...teams.map((t) => t.starterPts), 1);

  return (
    <>
      <div className="grid cols-4">
        <StatTile label="Most Self-Made" value={ownerName(selfMade.ownerId).split(' ')[0]} accent="blue" sub={<><span className="em">{pctOf(selfMade.ptsDraft, selfMade.starterPts).toFixed(0)}%</span> of points from own draft picks</>} />
        <StatTile label="Best Trader" value={ownerName(trader.ownerId).split(' ')[0]} accent="gold" sub={<><span className="em">{fmt0(trader.ptsTrade)}</span> starting pts via trade</>} />
        <StatTile label="Waiver-Wire King" value={ownerName(wireGM.ownerId).split(' ')[0]} accent="green" sub={<><span className="em">{fmt0(wireGM.ptsWaiver + wireGM.ptsFA)}</span> pts off waivers & FA</>} />
        <StatTile label="Value of the Draft" value={valuePick ? `${valuePick.ppd}×` : '—'} sub={valuePick ? <>{valuePick.player} · ${valuePick.bid} → {fmt0(valuePick.pts)} pts</> : ''} />
      </div>

      {/* points source stacked bars */}
      <div className="section">
        <SectionHead title="Where the points came from" note="Share of each team's starting-lineup points by how the player joined the roster" />
        <div className="legend" style={{ marginBottom: 10 }}>
          <span className="legend-item"><span className="legend-sq" style={{ background: C_DRAFT }} /> Own draft pick</span>
          <span className="legend-item"><span className="legend-sq" style={{ background: C_TRADE }} /> Acquired via trade</span>
          <span className="legend-item"><span className="legend-sq" style={{ background: C_WAIVER }} /> Acquired via waiver</span>
          <span className="legend-item"><span className="legend-sq" style={{ background: C_FA }} /> Acquired via free agency</span>
        </div>
        <Card className="card-pad">
          {teams.map((t) => {
            const segs = [
              { p: pctOf(t.ptsDraft, t.starterPts), c: C_DRAFT, label: 'Draft', v: t.ptsDraft },
              { p: pctOf(t.ptsTrade, t.starterPts), c: C_TRADE, label: 'Trade', v: t.ptsTrade },
              { p: pctOf(t.ptsWaiver, t.starterPts), c: C_WAIVER, label: 'Waiver', v: t.ptsWaiver },
              { p: pctOf(t.ptsFA, t.starterPts), c: C_FA, label: 'Free agent', v: t.ptsFA },
            ];
            return (
              <div className="rl-row" key={t.teamId}>
                <OwnerChip id={t.ownerId} name={ownerName(t.ownerId)} team={t.teamName} size={22} />
                <div className="stack-bar" title={segs.map((s) => `${s.label} ${fmt0(s.v)}`).join(' · ')}>
                  {segs.map((s) => (
                    <div key={s.label} className="stack-seg" style={{ width: `${s.p}%`, background: s.c }} title={`${s.label}: ${fmt0(s.v)} pts (${s.p.toFixed(0)}%)`} />
                  ))}
                </div>
                <div className="rl-total" style={{ opacity: 0.55 + 0.45 * (t.starterPts / maxTotal) }}>{fmt0(t.starterPts)}</div>
              </div>
            );
          })}
        </Card>
      </div>

      <MaximumPotentialSection potential={potential} ownerName={ownerName} />
      <ManagementEfficiencySection potential={potential} season={season} ownerName={ownerName} />
      <AgeVsSuccessSection rosterAge={rosterAge} season={season} />

      {/* draft value retained */}
      <div className="section">
        <SectionHead title="Draft spend & roster value" note="What each team spent, what its season-ending roster was worth at draft prices, and its points by source" />
        <SortableTable columns={rosterCols} rows={teams} rowKey={(t) => t.teamId} initialSortKey="ptsDraft" minWidth={820} />
      </div>

      <BackfieldBuildSection rbBuild={rbBuild} year={year} />

      {/* draft ROI — draft-and-keep outcomes only */}
      <div className="section">
        <SectionHead title={`Draft-day ROI · ${year}`} note="Points a kept player scored as a starter for the manager who drafted him, per auction dollar. Players traded away are judged in Trades below — a trade isn't a bust." />
        <div className="two-col">
          <Card>
            <div className="card-head"><span className="card-title">Best Values</span><span className="card-hint">kept · min $5 · pts per $</span></div>
            <div className="card-pad" style={{ paddingTop: 4, paddingBottom: 6 }}>
              {values.map((p, i) => <RoiRow key={p.playerId} p={p} i={i} ownerName={ownerName} highlight />)}
            </div>
          </Card>
          <Card>
            <div className="card-head"><span className="card-title">Biggest Busts</span><span className="card-hint">kept · min $15 · fewest pts per $</span></div>
            <div className="card-pad" style={{ paddingTop: 4, paddingBottom: 6 }}>
              {busts.map((p, i) => <RoiRow key={p.playerId} p={p} i={i} ownerName={ownerName} />)}
            </div>
          </Card>
        </div>
      </div>

      {/* exact trades reconstructed from weekly rosters */}
      <div className="section">
        <SectionHead
          title={`Trades · ${year}`}
          note={`${trades.length} completed trade${trades.length === 1 ? '' : 's'}, reconstructed from the weekly rosters — each side shows the players it received and what they scored as starters afterward`}
        />
        {trades.length === 0 ? (
          <Card className="card-pad"><div className="empty">No trades this season.</div></Card>
        ) : (
          <div className="grid cols-2">
            {trades.map((tr, i) => <TradeCard key={i} tr={tr} ownerName={ownerName} />)}
          </div>
        )}
      </div>

      <div className="section">
        <p className="muted" style={{ fontSize: 12.5, maxWidth: '78ch' }}>
          <strong>Method:</strong> every starter's points are joined to the {year} auction and the season's
          transaction log by ESPN player id. Waiver claims and free-agent adds are read straight from the
          transaction feed; draft picks come from the auction. Because ESPN's executed-trade records are
          incomplete, a player on a roster he wasn't drafted to and has no waiver/FA claim for is inferred to have
          arrived via trade. Next: layering Next Gen Stats / combine data on the same player id.
        </p>
      </div>
    </>
  );
}

function MaximumPotentialSection({ potential, ownerName }: { potential: TeamPotential[]; ownerName: (id: string) => string }) {
  const sorted = [...potential].sort((a, b) => b.idealPts - a.idealPts);
  const top = sorted[0];
  const maxIdeal = Math.max(...sorted.map((t) => t.idealPts), 1);
  if (!top) return null;
  return (
    <div className="section">
      <SectionHead title="Maximum potential" note="Actual starting-lineup points vs. what an optimal lineup (starters + bench) could have scored, ranked by highest ideal-points total" />
      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <StatTile
          label="Highest Ideal Points"
          value={ownerName(top.ownerId)}
          accent="gold"
          sub={<><span className="em">{fmt0(top.idealPts)}</span> ideal pts · {fmt(top.pctOfIdeal, 1)}% captured</>}
        />
      </div>
      <div className="legend" style={{ marginBottom: 10 }}>
        <span className="legend-item"><span className="legend-sq" style={{ background: 'var(--win)' }} /> Actual points scored</span>
        <span className="legend-item"><span className="legend-sq" style={{ background: 'var(--surface-3)', border: '1px solid var(--line-strong)' }} /> Points left on table</span>
      </div>
      <Card className="card-pad">
        {sorted.map((t) => {
          const actualPct = t.idealPts > 0 ? (t.actualPts / t.idealPts) * 100 : 0;
          const leftPct = 100 - actualPct;
          return (
            <div className="rl-row" key={t.teamId}>
              <OwnerChip id={t.ownerId} name={ownerName(t.ownerId)} team={t.teamName} size={22} />
              <div className="stack-bar" title={`Actual ${fmt0(t.actualPts)} · Left on table ${fmt0(t.leftOnTable)}`}>
                <div className="stack-seg" style={{ width: `${actualPct}%`, background: 'var(--win)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {actualPct > 14 && <span style={{ fontSize: 11, fontWeight: 700, color: '#04231a' }}>{fmt0(t.actualPts)}</span>}
                </div>
                <div className="stack-seg" style={{ width: `${leftPct}%`, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {leftPct > 10 && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)' }}>{fmt0(t.leftOnTable)}</span>}
                </div>
              </div>
              <div className="rl-total" style={{ opacity: 0.55 + 0.45 * (t.idealPts / maxIdeal) }}>{fmt0(t.idealPts)}</div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

interface ManagementPoint extends TeamPotential {
  status: 'champion' | 'playoff' | 'out';
}

function EfficiencyTip({ active, payload, ownerName }: { active?: boolean; payload?: Array<{ payload: ManagementPoint }>; ownerName: (id: string) => string }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tooltip-card">
      <div className="tt-title">{p.teamName}</div>
      <div className="tooltip-row"><span className="muted">Manager</span><span>{ownerName(p.ownerId)}</span></div>
      <div className="tooltip-row"><span className="muted">Efficiency</span><span className="tnum">{fmt(p.pctOfIdeal, 1)}%</span></div>
      <div className="tooltip-row"><span className="muted">Points scored</span><span className="tnum">{fmt0(p.actualPts)}</span></div>
    </div>
  );
}

function ManagementEfficiencySection({ potential, season, ownerName }: { potential: TeamPotential[]; season: Season; ownerName: (id: string) => string }) {
  const teamStatus = new Map(season.teams.map((t) => [t.teamId, t]));
  const points: ManagementPoint[] = potential.map((t) => {
    const st = teamStatus.get(t.teamId);
    const status: ManagementPoint['status'] = st?.finalRank === 1 ? 'champion' : st?.madePlayoffs ? 'playoff' : 'out';
    return { ...t, status };
  });
  const champion = points.filter((p) => p.status === 'champion');
  const playoff = points.filter((p) => p.status === 'playoff');
  const out = points.filter((p) => p.status === 'out');
  const mostEfficient = [...points].sort((a, b) => b.pctOfIdeal - a.pctOfIdeal)[0];
  const leastEfficient = [...points].sort((a, b) => a.pctOfIdeal - b.pctOfIdeal)[0];
  if (!points.length) return null;

  return (
    <div className="section">
      <SectionHead title="Management efficiency" note="Actual points scored as a % of an optimal lineup's points, vs. season points scored" />
      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <StatTile
          label="Most Efficient"
          value={ownerName(mostEfficient.ownerId)}
          accent="green"
          sub={<><span className="em">{fmt(mostEfficient.pctOfIdeal, 1)}%</span> of ideal points captured</>}
        />
        <StatTile
          label="Least Efficient"
          value={ownerName(leastEfficient.ownerId)}
          sub={<><span className="em">{fmt(leastEfficient.pctOfIdeal, 1)}%</span> of ideal points captured</>}
        />
      </div>
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--line)" />
            <XAxis
              type="number"
              dataKey="pctOfIdeal"
              name="Efficiency"
              unit="%"
              domain={['dataMin - 1', 'dataMax + 1']}
              tick={axisTick}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={{ stroke: 'var(--line)' }}
            />
            <YAxis
              type="number"
              dataKey="actualPts"
              name="Points"
              domain={['dataMin - 40', 'dataMax + 40']}
              tick={axisTick}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={{ stroke: 'var(--line)' }}
              width={50}
            />
            <Tooltip content={<EfficiencyTip ownerName={ownerName} />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Champion" data={champion} fill="var(--gold)" />
            <Scatter name="Playoff" data={playoff} fill="var(--accent)" />
            <Scatter name="Non-Playoff" data={out} fill="var(--ink-3)" />
          </ScatterChart>
        </ResponsiveContainer>
        <div className="legend">
          <span className="legend-item"><span className="legend-sq" style={{ background: 'var(--gold)' }} /> Champion</span>
          <span className="legend-item"><span className="legend-sq" style={{ background: 'var(--accent)' }} /> Playoff team</span>
          <span className="legend-item"><span className="legend-sq" style={{ background: 'var(--ink-3)' }} /> Non-playoff</span>
        </div>
      </div>
    </div>
  );
}

function RbBuildTip({ active, payload }: { active?: boolean; payload?: Array<{ payload: RbBuildPoint }> }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  if (p.rbDollars == null) return null;
  return (
    <div className="tooltip-card">
      <div className="tt-title">{p.teamName}</div>
      <div className="tooltip-row"><span className="muted">RB auction $</span><span className="tnum">${fmt0(p.rbDollars)}</span></div>
      <div className="tooltip-row"><span className="muted">RB starter pts</span><span className="tnum">{fmt0(p.rbPoints)}</span></div>
    </div>
  );
}

function BackfieldBuildSection({ rbBuild, year }: { rbBuild: RbBuildPoint[]; year: number }) {
  const points = rbBuild.filter((p) => p.rbDollars > 0 || p.rbPoints > 0);
  if (points.length < 2) return null;
  const { slope, intercept } = linreg(points.map((p) => ({ x: p.rbDollars, y: p.rbPoints })));
  const maxX = Math.max(...points.map((p) => p.rbDollars));
  const trendData = [
    { rbDollars: 0, trend: intercept },
    { rbDollars: maxX, trend: intercept + slope * maxX },
  ];
  return (
    <div className="section">
      <SectionHead title="Backfield build" note={`RB auction $ spent vs. RB starter fantasy points, ${year}`} />
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--line)" />
            <XAxis
              type="number"
              dataKey="rbDollars"
              name="RB $"
              unit="$"
              domain={[0, 'dataMax + 10']}
              tick={axisTick}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={{ stroke: 'var(--line)' }}
            />
            <YAxis
              type="number"
              dataKey="rbPoints"
              name="RB pts"
              domain={[0, 'dataMax + 40']}
              tick={axisTick}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={{ stroke: 'var(--line)' }}
              width={46}
            />
            <Tooltip content={<RbBuildTip />} cursor={{ strokeDasharray: '3 3' }} />
            <Line
              data={trendData}
              dataKey="trend"
              type="linear"
              stroke="var(--ink-3)"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              dot={false}
              activeDot={false}
              legendType="none"
              isAnimationActive={false}
            />
            <Scatter name="Teams" data={points} dataKey="rbPoints" fill="var(--s3)">
              <LabelList dataKey="abbrev" position="top" fill="var(--ink-2)" fontSize={11} />
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface AgePoint {
  teamId: number;
  teamName: string;
  avgAge: number;
  powerPct: number;
  champion: boolean;
}

function AgeTip({ active, payload }: { active?: boolean; payload?: Array<{ payload: AgePoint }> }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tooltip-card">
      <div className="tt-title">{p.teamName}</div>
      <div className="tooltip-row"><span className="muted">Avg age</span><span className="tnum">{fmt(p.avgAge, 1)}</span></div>
      <div className="tooltip-row"><span className="muted">Power win %</span><span className="tnum">{fmt(p.powerPct, 1)}%</span></div>
    </div>
  );
}

function AgeVsSuccessSection({ rosterAge, season }: { rosterAge: SeasonRosterAge | null; season: Season }) {
  if (!rosterAge || !rosterAge.teams.length) return null;
  const teamStatus = new Map(season.teams.map((t) => [t.teamId, t]));
  const points: AgePoint[] = rosterAge.teams
    .map((ra): AgePoint | null => {
      const st = teamStatus.get(ra.teamId);
      if (!st) return null;
      return { teamId: ra.teamId, teamName: ra.teamName, avgAge: ra.avgAge, powerPct: st.powerPct * 100, champion: st.finalRank === 1 };
    })
    .filter((p): p is AgePoint => p != null);
  if (!points.length) return null;

  const oldest = [...rosterAge.teams].sort((a, b) => b.avgAge - a.avgAge)[0];
  const youngest = [...rosterAge.teams].sort((a, b) => a.avgAge - b.avgAge)[0];
  const champPoints = points.filter((p) => p.champion);
  const otherPoints = points.filter((p) => !p.champion);
  const firstName = (n: string) => n.split(' ')[0];

  return (
    <div className="section">
      <SectionHead
        title="Age is just a number"
        note="Average age of every distinct starter that season vs. season-long Power win % — does roster age correlate with winning?"
      />
      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <StatTile
          label={`Oldest Roster · ${oldest.teamName}`}
          value={`${fmt(oldest.avgAge, 1)} avg age`}
          sub={oldest.oldest.map((p) => `${p.name} (${p.age})`).join(' · ')}
        />
        <StatTile
          label={`Youngest Roster · ${youngest.teamName}`}
          value={`${fmt(youngest.avgAge, 1)} avg age`}
          accent="green"
          sub={youngest.youngest.map((p) => `${p.name} (${p.age})`).join(' · ')}
        />
      </div>
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--line)" />
            <XAxis
              type="number"
              dataKey="avgAge"
              name="Avg Age"
              domain={['dataMin - 0.5', 'dataMax + 0.5']}
              tick={axisTick}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={{ stroke: 'var(--line)' }}
            />
            <YAxis
              type="number"
              dataKey="powerPct"
              name="Power Win %"
              unit="%"
              domain={[0, 100]}
              tick={axisTick}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={{ stroke: 'var(--line)' }}
              width={46}
            />
            <Tooltip content={<AgeTip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Teams" data={otherPoints} dataKey="powerPct" fill="var(--accent)">
              <LabelList dataKey="teamName" position="top" fill="var(--ink-2)" fontSize={11} formatter={(v: unknown) => firstName(String(v))} />
            </Scatter>
            <Scatter name="Champion" data={champPoints} dataKey="powerPct" fill="var(--gold)">
              <LabelList dataKey="teamName" position="top" fill="var(--gold-2)" fontSize={11} formatter={(v: unknown) => firstName(String(v))} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div className="legend">
          <span className="legend-item"><span className="legend-sq" style={{ background: 'var(--gold)' }} /> Champion</span>
          <span className="legend-item"><span className="legend-sq" style={{ background: 'var(--accent)' }} /> Other teams</span>
        </div>
      </div>
    </div>
  );
}

function TradeCard({ tr, ownerName }: { tr: Trade; ownerName: (id: string) => string }) {
  const aWin = tr.aGot > tr.bGot + 1;
  const bWin = tr.bGot > tr.aGot + 1;
  return (
    <div className="card trade-card">
      <div className="trade-when">{tr.when}</div>
      <div className="trade-grid">
        {/* team A received the players B sent */}
        <TradeSide ownerId={tr.aOwnerId} name={ownerName(tr.aOwnerId)} team={tr.aName} got={tr.aGot} received={tr.bSends} win={aWin} />
        <div className="trade-swap">⇄</div>
        <TradeSide ownerId={tr.bOwnerId} name={ownerName(tr.bOwnerId)} team={tr.bName} got={tr.bGot} received={tr.aSends} win={bWin} />
      </div>
    </div>
  );
}

function TradeSide({ ownerId, name, team, got, received, win }: { ownerId: string; name: string; team: string; got: number; received: TradePlayer[]; win: boolean }) {
  return (
    <div className={clsx('trade-side', win && 'win')}>
      <div className="trade-side-head">
        <OwnerChip id={ownerId} name={name} team={team} size={22} />
        <span className="trade-got">{win && <span className="trade-crown">▲</span>}{fmt0(got)}<span className="trade-got-u"> pts got</span></span>
      </div>
      <div className="trade-players">
        {received.map((p) => (
          <div className="trade-player" key={p.pid}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span className="pos-dot" style={{ background: posColor(p.pos) }} />{p.name}
            </span>
            <span className="tnum" style={{ color: 'var(--ink-2)' }}>{fmt0(p.ptsForNewTeam)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoiRow({ p, i, ownerName, highlight }: { p: PickROI; i: number; ownerName: (id: string) => string; highlight?: boolean }) {
  return (
    <div className="record-row">
      <span className={clsx('record-rank', i === 0 && highlight && 'top')}>{i + 1}</span>
      <div className="record-main">
        <div style={{ fontWeight: 600 }}>
          <span className="pos-dot" style={{ background: posColor(p.pos) }} />
          {p.player}
        </div>
        <div className="record-sub">{p.ownerId ? ownerName(p.ownerId) : '—'} · ${p.bid} bid · {fmt0(p.pts)} pts</div>
      </div>
      <span className="record-val" style={{ color: highlight ? 'var(--gold-2)' : 'var(--ink)' }}>{p.ppd ?? '—'}<span style={{ fontSize: 12, color: 'var(--ink-3)' }}> /$</span></span>
    </div>
  );
}
