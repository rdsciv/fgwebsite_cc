import { useEffect, useMemo, useState } from 'react';
import { useLeague } from '../data';
import { PageHead, SectionHead, Card } from '../components/bits';
import { OwnerChip, Avatar } from '../components/OwnerChip';
import { SkillRadarPanel } from '../components/CategoryRadar';
import { CategoryBreakdownTable, GROUP_COLOR } from '../components/CategoryBreakdown';
import { loadBoxscore, hasBoxscores } from '../lib/boxscores';
import { computeCategoryStats, leagueAverageNorm, type CatKey, type CategoryValue } from '../lib/categoryStats';
import { clsx } from '../lib/util';
import type { SeasonBox } from '../types';

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
  const { league, ownerName } = useLeague();
  const boxYears = league.meta.seasons.filter(hasBoxscores);
  const [year, setYear] = useState(league.meta.lastSeason);
  const [box, setBox] = useState<SeasonBox | null>(null);
  const [teamId, setTeamId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadBoxscore(year).then((b) => {
      if (alive) setBox(b);
    });
    return () => {
      alive = false;
    };
  }, [year]);

  const season = league.seasons.find((s) => s.year === year);
  const teams = useMemo(() => (box && season ? computeCategoryStats(box, season) : []), [box, season]);
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

      {!box || !teams.length ? (
        <div className="empty">Loading {year} category stats…</div>
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
                <SectionHead title={`Category Breakdown · ${selected.teamName}`} note={`${year} season`} />
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
