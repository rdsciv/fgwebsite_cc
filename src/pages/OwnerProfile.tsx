import { Link, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLeague } from '../data';
import { PageHead, SectionHead, StatTile, Card, Badge, TrophyRow } from '../components/bits';
import { OwnerChip, Avatar } from '../components/OwnerChip';
import { SortableTable, type Column } from '../components/SortableTable';
import { RosterConstructionChart } from '../components/RosterConstructionChart';
import { BoxPlotRow } from '../components/BoxPlotRow';
import { computeRosterConstruction } from '../lib/rosterConstruction';
import {
  distribution,
  histogram,
  mean,
  ownerScores,
  seasonDistributions,
  sharedDomain,
  stdev,
} from '../lib/scoreDist';
import { fmt, fmt0, ordinal, pct, posColor, recordStr } from '../lib/util';
import type { H2HCell, League } from '../types';

const POS_LEGEND = ['QB', 'RB', 'WR', 'TE', 'D/ST', 'K'];

const axisTick = { fill: 'var(--ink-3)', fontSize: 12 };

interface FinishPoint {
  year: number;
  rank: number | null;
  teamName: string;
}

interface Rival {
  id: string;
  name: string;
  w: number;
  l: number;
  t: number;
  pf: number;
  pa: number;
  games: number;
}

function FinishTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: FinishPoint }>;
}) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  if (p.rank == null) return null;
  return (
    <div className="tooltip-card">
      <div className="tt-title">
        {p.year} · {p.teamName}
      </div>
      <div className="tooltip-row">
        <span className="muted">Finished</span>
        <span className="em-gold">{ordinal(p.rank)}</span>
      </div>
    </div>
  );
}

export function OwnerProfile() {
  const { id } = useParams();
  const ownerId = decodeURIComponent(id ?? '');
  const { league, ownerById, seasonByYear, ownerName } = useLeague();
  const owner = ownerById.get(ownerId);

  if (!owner) {
    return (
      <div className="page">
        <PageHead
          eyebrow="Manager Profile"
          title="Manager not found"
          lede="We couldn't find a franchise with that id."
        />
        <Card className="card-pad">
          <div className="empty">
            No manager matches this profile.{' '}
            <Link to="/standings" className="link-arrow">
              Back to standings →
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const at = owner.allTime;
  const seasonsAsc = [...owner.seasons].sort((a, b) => a.year - b.year);
  const years = owner.seasonsPlayed;
  const minYr = years.length ? Math.min(...years) : null;
  const maxYr = years.length ? Math.max(...years) : null;

  // Finish trajectory — 1st sits at the top (YAxis reversed).
  const finishData: FinishPoint[] = seasonsAsc.map((s) => ({
    year: s.year,
    rank: s.finalRank,
    teamName: s.teamName,
  }));
  const ranks = seasonsAsc
    .map((s) => s.finalRank)
    .filter((n): n is number => n != null);
  const nTeamsList = seasonsAsc
    .map((s) => seasonByYear.get(s.year)?.nTeams)
    .filter((n): n is number => n != null);
  const maxTeams = Math.max(12, ...ranks, ...nTeamsList);

  // Rivalries — head-to-head vs every opponent this manager has faced.
  const h2h: Record<string, H2HCell> = league.headToHead[owner.id] ?? {};
  const rivals: Rival[] = Object.entries(h2h)
    .map(([oppId, c]) => ({
      id: oppId,
      name: ownerName(oppId),
      w: c.w,
      l: c.l,
      t: c.t,
      pf: c.pf,
      pa: c.pa,
      games: c.w + c.l + c.t,
    }))
    .filter((r) => r.games > 0);
  const favorite = rivals.length
    ? rivals.reduce((best, r) => (r.w > best.w ? r : best))
    : null;
  const nemesis = rivals.length
    ? rivals.reduce((worst, r) => (r.l > worst.l ? r : worst))
    : null;
  const topRivals = [...rivals]
    .sort((a, b) => b.games - a.games || b.w - a.w)
    .slice(0, 8);

  const titlesAsc = [...at.titles].sort((a, b) => a - b);
  const goldTint = 'rgba(246, 199, 68, 0.07)';

  const rosterConstruction = computeRosterConstruction(owner, league.seasons);

  const rivalCols: Column<Rival>[] = [
    {
      key: 'opp',
      header: 'Opponent',
      align: 'left',
      sortable: true,
      value: (r) => r.name,
      render: (r) => <OwnerChip id={r.id} name={r.name} />,
    },
    {
      key: 'rec',
      header: 'Record',
      sortable: true,
      defaultDesc: true,
      value: (r) => (r.games ? r.w / r.games : 0),
      render: (r) => (
        <span>
          <span className="wl-w">{r.w}</span>
          <span className="muted">-</span>
          <span className="wl-l">{r.l}</span>
          {r.t > 0 && <span className="muted">-{r.t}</span>}
        </span>
      ),
    },
    {
      key: 'games',
      header: 'Games',
      sortable: true,
      defaultDesc: true,
      value: (r) => r.games,
      render: (r) => r.games,
    },
    {
      key: 'pf',
      header: 'PF',
      sortable: true,
      defaultDesc: true,
      value: (r) => r.pf,
      render: (r) => <span className="tnum">{fmt(r.pf)}</span>,
    },
    {
      key: 'pa',
      header: 'PA',
      sortable: true,
      defaultDesc: true,
      value: (r) => r.pa,
      render: (r) => <span className="tnum">{fmt(r.pa)}</span>,
    },
  ];

  return (
    <div className="page">
      {/* ---------- hero header ---------- */}
      <header className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <Avatar id={owner.id} name={owner.teamNames[owner.teamNames.length - 1] ?? owner.name} size={60} />
          <div style={{ minWidth: 0 }}>
            <div className="page-eyebrow">Franchise</div>
            <h1 className="page-title" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {owner.teamNames[owner.teamNames.length - 1] ?? owner.name}
              {maxYr != null && maxYr < league.meta.lastSeason && (
                <span className="badge former" style={{ fontSize: 12 }}>
                  Former · last played {maxYr}
                </span>
              )}
            </h1>
            <div className="page-lede" style={{ marginTop: 6 }}>
              Manager: {owner.name}
              {owner.teamNames.length > 1 ? ` · also known as ${owner.teamNames.slice(0, -1).join(' · ')}` : ''}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            {at.championships > 0 && (
              <div style={{ fontSize: 30, lineHeight: 1 }}>
                <TrophyRow n={at.championships} />
              </div>
            )}
            {minYr != null && maxYr != null && (
              <div className="stat-label" style={{ marginTop: at.championships > 0 ? 8 : 0 }}>
                {owner.nSeasons} season{owner.nSeasons > 1 ? 's' : ''} · {minYr}–{maxYr}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ---------- career KPIs ---------- */}
      <div className="grid cols-3">
        <StatTile
          label="All-Time Record"
          value={recordStr(at.wins, at.losses, at.ties)}
          sub={`${fmt0(at.gamesPlayed)} games played`}
        />
        <StatTile
          label="Win Percentage"
          value={pct(at.pct)}
          accent="green"
          sub="regular season + playoffs"
        />
        <StatTile
          label="Championships"
          value={at.championships}
          accent="gold"
          sub={at.runnerUps > 0 ? `${at.runnerUps} runner-up${at.runnerUps > 1 ? 's' : ''}` : 'title runs'}
        />
        <StatTile
          label="Playoff Apps"
          value={at.playoffApps}
          sub={`of ${owner.nSeasons} season${owner.nSeasons > 1 ? 's' : ''}`}
        />
        <StatTile
          label="Points For"
          value={fmt0(at.pf)}
          sub={`${fmt(at.ppg)} pts / game`}
        />
        <StatTile
          label="Best Finish"
          value={ordinal(at.bestFinish)}
          accent="gold"
          sub={at.avgFinish != null ? `${ordinal(Math.round(at.avgFinish))} average` : 'no finishes yet'}
        />
      </div>

      {/* ---------- trophy case ---------- */}
      {titlesAsc.length > 0 && (
        <div className="section">
          <SectionHead
            title="Trophy Case"
            note={`${at.championships} championship${at.championships > 1 ? 's' : ''} in ${owner.name}'s cabinet`}
          />
          <div className="chip-row">
            {titlesAsc.map((y) => (
              <Link key={y} to={`/seasons/${y}`}>
                <Badge kind="champ">🏆 {y}</Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ---------- scoring distribution: shape of every week, career and by season ---------- */}
      <ScoringDistribution league={league} ownerId={owner.id} />

      {/* ---------- season by season ---------- */}
      <div className="section">
        <SectionHead title="Season by Season" note="Every campaign, in order" />
        <div className="table-wrap">
          <table className="data" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Year</th>
                <th style={{ textAlign: 'left' }}>Team</th>
                <th>Record</th>
                <th>Finish</th>
                <th>Reg Rank</th>
                <th>PF</th>
                <th>PPG</th>
                <th>Playoffs</th>
              </tr>
            </thead>
            <tbody>
              {seasonsAsc.map((s) => {
                const tint = s.champion ? { backgroundColor: goldTint } : undefined;
                return (
                  <tr key={s.year}>
                    <td style={{ textAlign: 'left', ...tint }}>
                      <Link to={`/seasons/${s.year}`} style={{ fontWeight: 600 }}>
                        {s.year}
                      </Link>
                    </td>
                    <td style={{ textAlign: 'left', ...tint }}>{s.teamName}</td>
                    <td style={tint}>{recordStr(s.wins, s.losses, s.ties)}</td>
                    <td style={tint}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          justifyContent: 'flex-end',
                        }}
                      >
                        {ordinal(s.finalRank)}
                        {s.champion ? (
                          <Badge kind="champ">🏆</Badge>
                        ) : s.runnerUp ? (
                          <Badge kind="runner">2nd</Badge>
                        ) : s.last ? (
                          <Badge kind="sacko">Sacko</Badge>
                        ) : null}
                      </span>
                    </td>
                    <td style={tint}>{ordinal(s.regRank)}</td>
                    <td style={{ ...tint }} className="tnum">
                      {fmt(s.pf)}
                    </td>
                    <td style={{ ...tint }} className="tnum">
                      {fmt(s.ppg)}
                    </td>
                    <td style={tint}>
                      {s.madePlayoffs ? (
                        <span style={{ color: 'var(--win)', fontWeight: 700 }}>✓</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- roster construction (auction $ by year) ---------- */}
      {rosterConstruction.length > 0 && (
        <div className="section">
          <SectionHead
            title="Roster Construction"
            note="Every player drafted, sized by auction $ — solid = price-implied starter, faded = bench"
          />
          <div className="legend" style={{ marginBottom: 12 }}>
            {POS_LEGEND.map((pos) => (
              <span className="legend-item" key={pos}>
                <span className="legend-sq" style={{ background: posColor(pos) }} /> {pos}
              </span>
            ))}
          </div>
          <RosterConstructionChart years={rosterConstruction} />
        </div>
      )}

      {/* ---------- finish trajectory ---------- */}
      <div className="section">
        <div className="chart-card">
          <div className="chart-title">Where they finished</div>
          <div className="chart-sub">Final placement each season — higher on the axis is better.</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={finishData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: 'var(--ink-3)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--line)' }}
                tickLine={{ stroke: 'var(--line)' }}
              />
              <YAxis
                reversed
                domain={[1, maxTeams]}
                allowDecimals={false}
                width={46}
                tickFormatter={(v: number) => ordinal(v)}
                tick={{ fill: 'var(--ink-3)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--line)' }}
                tickLine={{ stroke: 'var(--line)' }}
              />
              <Tooltip content={<FinishTooltip />} cursor={{ stroke: 'var(--line-strong)' }} />
              <Line
                type="monotone"
                dataKey="rank"
                isAnimationActive={false}
                stroke="var(--gold)"
                strokeWidth={2.5}
                connectNulls
                dot={{ r: 4, fill: 'var(--gold)', stroke: 'var(--bg)', strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: 'var(--gold-2)', stroke: 'var(--bg)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ---------- rivalries ---------- */}
      {rivals.length > 0 && (
        <div className="section">
          <SectionHead title="Rivalries" note="Head-to-head across every opponent faced" />
          {(favorite || nemesis) && (
            <div className="grid cols-2" style={{ marginBottom: 16 }}>
              {favorite && (
                <Card className="card-pad">
                  <div className="stat-label" style={{ color: 'var(--win)' }}>Favorite Victim</div>
                  <div style={{ marginTop: 12 }}>
                    <OwnerChip id={favorite.id} name={favorite.name} size={32} />
                  </div>
                  <div className="record-sub" style={{ marginTop: 10 }}>
                    {recordStr(favorite.w, favorite.l, favorite.t)} all-time · {fmt0(favorite.pf)}–
                    {fmt0(favorite.pa)} pts
                  </div>
                </Card>
              )}
              {nemesis && (
                <Card className="card-pad">
                  <div className="stat-label" style={{ color: 'var(--loss)' }}>Nemesis</div>
                  <div style={{ marginTop: 12 }}>
                    <OwnerChip id={nemesis.id} name={nemesis.name} size={32} />
                  </div>
                  <div className="record-sub" style={{ marginTop: 10 }}>
                    {recordStr(nemesis.w, nemesis.l, nemesis.t)} all-time · {fmt0(nemesis.pf)}–
                    {fmt0(nemesis.pa)} pts
                  </div>
                </Card>
              )}
            </div>
          )}
          <SortableTable
            columns={rivalCols}
            rows={topRivals}
            initialSortKey="games"
            minWidth={560}
            rowKey={(r) => r.id}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Scoring distribution — the shape of a manager's weeks, not just the total.
 * Career histogram with median/mean markers, plus one box plot per season on a
 * shared domain so the seasons are visually comparable.
 */
function ScoringDistribution({ league, ownerId }: { league: League; ownerId: string }) {
  const all = ownerScores(league, ownerId);
  const career = distribution(all);
  if (!career) return null;

  const bySeason = seasonDistributions(league, ownerId);
  const domain = sharedDomain([career, ...bySeason.map((s) => s.dist)]);
  const bins = histogram(all, career.min, career.max, 10);
  const avg = mean(all);
  const sd = stdev(all);

  return (
    <div className="section">
      <SectionHead
        title="Scoring Distribution"
        note={`All ${career.n} single-week scores this franchise has posted · multi-week playoff aggregates excluded`}
      />

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <StatTile label="Median Week" value={fmt(career.median, 1)} accent="gold" sub={`half of weeks landed above this`} />
        <StatTile label="Average Week" value={fmt(avg, 1)} sub={`± ${fmt(sd, 1)} typical swing`} />
        <StatTile label="Middle 50%" value={`${fmt(career.q1, 1)}–${fmt(career.q3, 1)}`} accent="blue" sub="interquartile range" />
        <StatTile label="Full Range" value={`${fmt(career.min, 1)}–${fmt(career.max, 1)}`} accent="green" sub="worst to best week" />
      </div>

      <div className="chart-card">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={bins} margin={{ top: 12, right: 20, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="lo"
              tickFormatter={(v: number) => String(v)}
              tick={axisTick}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={{ stroke: 'var(--line)' }}
            />
            <YAxis
              allowDecimals={false}
              tick={axisTick}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={{ stroke: 'var(--line)' }}
              width={36}
            />
            <Tooltip content={<HistTip />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
            <ReferenceLine
              x={Math.floor(career.median / 10) * 10}
              stroke="var(--gold)"
              strokeDasharray="4 4"
              label={{ value: `median ${career.median.toFixed(1)}`, fill: 'var(--gold-2)', fontSize: 11, position: 'insideTopRight' }}
            />
            <Bar dataKey="count" fill="var(--s1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        <div className="chart-caption">Each bar counts weeks scoring within a 10-point band.</div>
      </div>

      <div style={{ marginTop: 20 }}>
        <SectionHead title="By Season" note="Box = middle 50% · line = median · whiskers = best and worst week · all seasons share one scale" />
        <Card className="card-pad">
          {bySeason.map((s) => (
            <div key={s.year} className="dist-row">
              <Link to={`/seasons/${s.year}`} className="dist-year">{s.year}</Link>
              <BoxPlotRow dist={s.dist} domain={domain} />
              <span className="dist-med tnum">{fmt(s.dist.median, 1)}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function HistTip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { lo: number; hi: number; count: number } }> }) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  return (
    <div className="tooltip-card">
      <div className="tt-title">{b.lo}–{b.hi} points</div>
      <div className="tooltip-row">
        <span className="muted">Weeks</span>
        <span className="tnum">{b.count}</span>
      </div>
    </div>
  );
}
