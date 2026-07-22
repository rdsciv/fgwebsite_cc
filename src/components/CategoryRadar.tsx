import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import type { CatKey, TeamCategoryStats } from '../lib/categoryStats';
import { fmt } from '../lib/util';

export function SkillRadarPanel({
  team,
  leagueAvg,
  nTeams,
}: {
  team: TeamCategoryStats;
  leagueAvg: Record<CatKey, number>;
  nTeams: number;
}) {
  const data = team.categories.map((c) => ({
    label: c.label,
    team: Math.round(c.norm * 1000) / 1000,
    avg: Math.round((leagueAvg[c.key] ?? 0) * 1000) / 1000,
  }));
  const best = [...team.categories].sort((a, b) => a.rank - b.rank)[0];
  const worst = [...team.categories].sort((a, b) => b.rank - a.rank).slice(0, 2);

  return (
    <div className="chart-card">
      <div className="chart-title">Skill Radar</div>
      <div className="chart-sub">Per-category strength profile · {team.teamName} ranks {team.totalRank} of {nTeams}</div>
      <div className="skill-radar-grid">
        <div>
          <div className="skill-radar-cols">
            <div>
              <div className="skill-radar-label" style={{ color: 'var(--win)' }}>Strengths</div>
              <div className="skill-radar-row">
                <span className="legend-sq" style={{ background: 'var(--win)' }} />
                {best.label}
                <span className="muted" style={{ marginLeft: 'auto' }}>#{best.rank}/{nTeams}</span>
              </div>
            </div>
            <div>
              <div className="skill-radar-label" style={{ color: 'var(--loss)' }}>Weaknesses</div>
              {worst.map((w) => (
                <div className="skill-radar-row" key={w.key}>
                  <span className="legend-sq" style={{ background: 'var(--loss)' }} />
                  {w.label}
                  <span className="muted" style={{ marginLeft: 'auto' }}>#{w.rank}/{nTeams}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="var(--line)" />
            <PolarAngleAxis dataKey="label" tick={{ fill: 'var(--ink-3)', fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} tickCount={2} />
            <Radar name={team.teamName} dataKey="team" stroke="var(--s3)" fill="var(--s3)" fillOpacity={0.3} strokeWidth={2} />
            <Radar name="League Avg" dataKey="avg" stroke="var(--ink-3)" fill="none" strokeDasharray="4 4" strokeWidth={1.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        <span className="legend-item"><span className="legend-sw" style={{ background: 'var(--s3)' }} /> {team.teamName}</span>
        <span className="legend-item"><span className="legend-sw" style={{ background: 'var(--ink-3)', borderTop: '1px dashed var(--ink-3)' }} /> League avg</span>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
        Fine print: {fmt(best.value, best.key === 'compPct' ? 1 : 0)}{best.key === 'compPct' ? '%' : ''} in {best.label.toLowerCase()}, the league's best.
      </div>
    </div>
  );
}
