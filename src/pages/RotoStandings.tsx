import { useEffect, useMemo, useState } from 'react';
import { useLeague } from '../data';
import { PageHead, SectionHead, Card } from '../components/bits';
import { OwnerChip, Avatar } from '../components/OwnerChip';
import { SkillRadarPanel } from '../components/CategoryRadar';
import { CategoryBreakdownTable, GROUP_COLOR } from '../components/CategoryBreakdown';
import { loadBoxscore, hasBoxscores } from '../lib/boxscores';
import { computeCategoryStats, leagueAverageNorm, type CatKey, type CategoryValue } from '../lib/categoryStats';
import { buildRotoCareer, type RotoCareerResult } from '../lib/rotoCareer';
import { PHASE_LABEL, type Phase } from '../lib/phase';
import { clsx, ordinal } from '../lib/util';
import type { SeasonBox } from '../types';

const PHASES: Phase[] = ['reg', 'post', 'combined'];

// Rank-based cell shading (1 = best), mirroring HeadToHead.tsx's win%-based cellBg().
function rankCellBg(rank: number, nTeams: number): string {
  const p = nTeams > 1 ? 1 - (rank - 1) / (nTeams - 1) : 0.5;
  const d = Math.abs(p - 0.5);
  if (d < 1e-6) return 'var(--surface-2)';
  const a = Math.min(0.85, 0.12 + d * 0.7);
  return p > 0.5 ? `rgba(55,207,131,${a})` : `rgba(236,106,106,${a})`;
}

function formatCatValue(c: { key: CatKey; value: number }) {
  if (c.key === 'compPct') return `${c.value.toFixed(1)}%`;
  if (c.key === 'ypc' || c.key === 'ypr') return c.value.toFixed(2);
  return Math.round(c.value).toLocaleString();
}

export function RotoStandings() {
  const { league, ownerName, isFormer, showFormer } = useLeague();
  const boxYears = league.meta.seasons.filter(hasBoxscores);
  const [year, setYear] = useState(league.meta.lastSeason);
  const [phase, setPhase] = useState<Phase>('reg');
  const [box, setBox] = useState<SeasonBox | null>(null);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [career, setCareer] = useState<RotoCareerResult | null>(null);

  useEffect(() => {
    let alive = true;
    loadBoxscore(year).then((b) => {
      if (alive) setBox(b);
    });
    return () => {
      alive = false;
    };
  }, [year]);

  // Career roto: every boxscore season re-scored, then averaged per manager. A year that fails to
  // load is carried through as a coverage gap rather than being folded in as an empty season.
  useEffect(() => {
    let alive = true;
    Promise.all(
      boxYears.map(async (y) => ({
        year: y,
        season: league.seasons.find((x) => x.year === y),
        box: await loadBoxscore(y),
      })),
    ).then((loads) => {
      if (alive) setCareer(buildRotoCareer(loads, phase));
    });
    return () => {
      alive = false;
    };
  }, [league, boxYears.join(), phase]);

  // The career table lists franchises as a set, so it honors the site-wide archive toggle. The
  // season detail below is year-scoped and always shows whoever actually played that year.
  const careerRows = useMemo(
    () => (!career ? [] : showFormer ? career.rows : career.rows.filter((c) => !isFormer(c.ownerId))),
    [career, showFormer, isFormer],
  );

  const season = league.seasons.find((s) => s.year === year);
  const teams = useMemo(() => (box && season ? computeCategoryStats(box, season, phase) : []), [box, season, phase]);
  const leagueAvg = useMemo(() => leagueAverageNorm(teams), [teams]);
  const selected = teams.find((t) => t.teamId === teamId) ?? teams[0] ?? null;
  const nTeams = teams.length;
  const cols: CategoryValue[] = selected ? selected.categories : [];

  return (
    <div className="page">
      <PageHead
        eyebrow="Category Analytics"
        title="Roto Standings"
        lede={
          <>
            AFFL is a head-to-head points league, but every team's underlying NFL production also scores
            the way a 10-category rotisserie league would — passing, rushing, and receiving stats ranked
            across the league, each category worth 1 (worst) to {nTeams || 12} (best) points. Player-level
            data begins in 2018.
          </>
        }
      />

      {/* Phase governs both tables below. Regular is the default because it is the only phase where
          every team plays the same number of games — see the note under the toggle. */}
      <div className="year-strip" style={{ marginBottom: 8 }}>
        {PHASES.map((p) => (
          <button key={p} className={clsx('year-btn', p === phase && 'active')} onClick={() => setPhase(p)}>
            {PHASE_LABEL[p]}
          </button>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 0, marginBottom: 20, fontSize: 13 }}>
        {phase === 'reg'
          ? 'Regular season only — every team plays the same number of games, so category totals are directly comparable.'
          : phase === 'post'
            ? 'Winners-bracket games only. Teams play unequal numbers of playoff games (byes, 2- vs 3-game paths), so totals are not directly comparable — the games column shows each team’s sample.'
            : 'Regular season + winners bracket. Consolation games are excluded. Playoff teams play more games than eliminated ones, so counting totals favor deeper runs.'}
      </p>

      {/* career view: who is consistently good in category terms, not just this year */}
      {career && careerRows.length > 0 && (
        <div className="section section-lead">
          <SectionHead
            title="Average Roto Finish"
            note={`Mean roto placement across ${career.scoredYears.length} scored season${career.scoredYears.length === 1 ? '' : 's'} (${career.scoredYears[0]}–${career.scoredYears[career.scoredYears.length - 1]}) · lower is better`}
          />
          {career.evidence === 'Partial' && (
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--loss)' }}>
              <span className="badge sacko">Partial</span>{' '}
              {career.missingYears.join(', ')} could not be loaded and {career.missingYears.length === 1 ? 'is' : 'are'} excluded
              from every average and ranking below. These are data gaps, not seasons anyone sat out.
            </p>
          )}
          <div className="chart-table">
            <table>
              <thead>
                <tr>
                  <th className="left">Manager</th>
                  <th>Seasons</th>
                  <th>Avg finish</th>
                  <th>Best</th>
                  <th>Worst</th>
                  <th>Avg pts</th>
                  {career.scoredYears.map((y) => <th key={y}>{String(y).slice(2)}</th>)}
                  {career.missingYears.map((y) => (
                    <th key={y} className="muted" title={`${y} data unavailable`}>{String(y).slice(2)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {careerRows.map((c) => (
                  <tr key={c.ownerId}>
                    <td className="left">{ownerName(c.ownerId)}</td>
                    <td className="tnum">{c.seasons}</td>
                    <td className="tnum" style={{ color: 'var(--gold-2)', fontWeight: 700 }}>{c.avgRank.toFixed(2)}</td>
                    <td className="tnum">{ordinal(c.bestRank)}</td>
                    <td className="tnum">{ordinal(c.worstRank)}</td>
                    <td className="tnum">{c.avgPts.toFixed(1)}</td>
                    {career.scoredYears.map((y) => {
                      const cell = c.byYear.get(y);
                      return (
                        <td key={y} className="tnum" style={cell ? { background: rankCellBg(cell.rank, cell.nTeams) } : undefined}>
                          {cell ? cell.rank : <span className="muted" title="Did not play this season">—</span>}
                        </td>
                      );
                    })}
                    {career.missingYears.map((y) => (
                      <td key={y} className="tnum muted" title={`${y} data unavailable — not counted in this average`}>?</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {career && career.evidence === 'Unavailable' && (
        <div className="section section-lead">
          <SectionHead title="Average Roto Finish" note="Career rollup" />
          <div className="empty">Career roto is unavailable — no season boxscores could be loaded.</div>
        </div>
      )}

      <div className="section">
        <SectionHead title="Season Detail" note="Full category table for a single year" />
      </div>

      <div className="year-strip" style={{ marginBottom: 16 }}>
        {boxYears.map((y) => (
          <button
            key={y}
            className={clsx('year-btn', y === year && 'active')}
            onClick={() => {
              setYear(y);
              setTeamId(null);
            }}
          >
            {y}
          </button>
        ))}
      </div>

      {!box ? (
        <div className="empty">Loading {year} category stats…</div>
      ) : !teams.length ? (
        <div className="empty">No {PHASE_LABEL[phase].toLowerCase()} games scored for {year}.</div>
      ) : (
        <>
          <div className="section">
            <SectionHead
              title="Roto Standings"
              note="Cells colored by category rank (green = best, red = worst) · Pts reflects category rank · click a row to inspect that team"
            />
            <div className="table-wrap">
              <table className="data" style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Team</th>
                    <th title="Eligible games in this phase — totals are only comparable when these match">G</th>
                    {cols.map((c) => (
                      <th key={c.key} title={`${c.group} · ${c.label}`} style={{ color: GROUP_COLOR[c.group] }}>
                        {c.label}
                      </th>
                    ))}
                    <th>Total Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr
                      key={t.teamId}
                      onClick={() => setTeamId(t.teamId)}
                      style={{ cursor: 'pointer', backgroundColor: t.teamId === selected?.teamId ? 'var(--surface-2)' : undefined }}
                    >
                      <td style={{ textAlign: 'left' }}>
                        <OwnerChip id={t.ownerId} name={ownerName(t.ownerId)} size={20} link={false} />
                      </td>
                      <td className="tnum muted">{t.games}</td>
                      {t.categories.map((c) => (
                        <td key={c.key} style={{ background: rankCellBg(c.rank, nTeams) }} title={`${c.label}: ${formatCatValue(c)} · rank #${c.rank}/${nTeams}`}>
                          {formatCatValue(c)}
                        </td>
                      ))}
                      <td style={{ fontWeight: 700, color: 'var(--gold-2)' }}>{t.totalPts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="section">
            <SectionHead title="Teams" note="Pick a team for its full skill profile" />
            <div className="roto-teams-grid">
              {teams.map((t) => (
                <button
                  key={t.teamId}
                  className={clsx('roto-team-card', t.teamId === selected?.teamId && 'active')}
                  onClick={() => setTeamId(t.teamId)}
                >
                  <Avatar id={t.ownerId} name={t.teamName} size={28} />
                  <span className="roto-team-rank">#{t.totalRank}</span>
                  <span className="roto-team-name">{t.teamName}</span>
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <>
              <div className="section">
                <SkillRadarPanel team={selected} leagueAvg={leagueAvg} nTeams={nTeams} />
              </div>
              <div className="section">
                <SectionHead title={`Category Breakdown · ${selected.teamName}`} note={`${year} · ${PHASE_LABEL[phase]}`} />
                <Card className="card-pad">
                  <CategoryBreakdownTable team={selected} nTeams={nTeams} />
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
