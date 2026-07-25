import { Link } from 'react-router-dom';
import { useLeague } from '../data';
import { PageHead, SectionHead, StatTile, Card, Badge } from '../components/bits';
import { OwnerChip } from '../components/OwnerChip';
import { SortableTable, type Column } from '../components/SortableTable';
import { fmt, fmt0, recordStr, clsx, posColor } from '../lib/util';
import type { SeasonTeam, Podium } from '../types';

export function SeasonPage({ year }: { year: number }) {
  const { league, seasonByYear, ownerName } = useLeague();
  const season = seasonByYear.get(year);
  const years = league.meta.seasons;

  const strip = (
    <div className="year-strip">
      {years.map((y) => (
        <Link key={y} to={`/seasons/${y}`} className={clsx('year-btn', y === year && 'active')}>
          {y}
        </Link>
      ))}
    </div>
  );

  if (!season) {
    return (
      <div className="page">
        {strip}
        <PageHead eyebrow="Season" title={`${year} Season`} />
        <div className="empty">No data on file for the {year} season.</div>
      </div>
    );
  }

  const draftCap = season.draftType.charAt(0).toUpperCase() + season.draftType.slice(1);
  const hasDivisions = season.divisions.length > 0;

  // ---- luck helpers ----
  const pwrStr = (n: number) => n.toFixed(3).replace(/^(-?)0\./, '$1.');
  const luckWins = (t: SeasonTeam) => t.regWins - t.expectedWins; // actual − expected reg-season wins
  const signed = (n: number, d = 1) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(d);
  const byLuck = [...season.teams].sort((a, b) => luckWins(b) - luckWins(a));
  const luckiest = byLuck[0];
  const unluckiest = byLuck[byLuck.length - 1];

  // ---- playoff bracket ----
  const wb = season.matchups.filter((m) => m.tier === 'WINNERS_BRACKET');
  const roundMps = [...new Set(wb.map((m) => m.mp))].sort((a, b) => a - b);
  const rounds = roundMps.map((mp) => wb.filter((m) => m.mp === mp));
  const nRounds = rounds.length;
  const roundLabel = (i: number) => {
    const back = nRounds - 1 - i;
    if (back === 0) return 'Championship';
    if (back === 1) return 'Semifinals';
    if (back === 2) return 'Quarterfinals';
    return `Round ${i + 1}`;
  };
  const teamNameFor = (ownerId: string) =>
    season.teams.find((t) => t.ownerId === ownerId)?.teamName ?? ownerName(ownerId);

  // ---- draft teaser ----
  const picks = season.draft.picks;
  const isAuction = season.draft.type === 'auction';
  const draftRounds = picks.length ? Math.max(...picks.map((p) => p.round)) : 0;
  const topBid = isAuction && picks.length
    ? picks.reduce((best, p) => (p.bid > best.bid ? p : best), picks[0])
    : null;
  const firstOverall = picks.find((p) => p.overall === 1) ?? picks[0];

  // ---- final standings table ----
  const divCol: Column<SeasonTeam> = {
    key: 'div',
    header: 'Division',
    align: 'left',
    sortable: true,
    value: (t) => t.division ?? '',
    defaultDesc: false,
    render: (t) => <span className="muted">{t.division ?? '—'}</span>,
  };

  const columns: Column<SeasonTeam>[] = [
    {
      key: 'rank',
      header: 'Rk',
      align: 'left',
      sortable: true,
      defaultDesc: false,
      value: (t) => t.finalRank ?? 99,
      render: (t) => (
        <span className={clsx('tnum', t.finalRank === 1 && 'rank-1')} style={{ fontWeight: 700 }}>
          {t.finalRank ?? '—'}
        </span>
      ),
    },
    {
      key: 'team',
      header: 'Team',
      align: 'left',
      sortable: true,
      defaultDesc: false,
      value: (t) => t.teamName.toLowerCase(),
      render: (t) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{t.teamName}</div>
          <div style={{ marginTop: 3 }}>
            <OwnerChip id={t.ownerId} name={ownerName(t.ownerId)} size={20} />
          </div>
        </div>
      ),
    },
    ...(hasDivisions ? [divCol] : []),
    {
      key: 'record',
      header: 'Record',
      sortable: true,
      value: (t) => t.wins + t.ties * 0.5,
      render: (t) => <span className="tnum">{recordStr(t.wins, t.losses, t.ties)}</span>,
    },
    {
      key: 'pf',
      header: 'PF',
      sortable: true,
      value: (t) => t.pf,
      render: (t) => <span className="tnum">{fmt(t.pf)}</span>,
    },
    {
      key: 'pa',
      header: 'PA',
      sortable: true,
      value: (t) => t.pa,
      render: (t) => <span className="tnum muted">{fmt(t.pa)}</span>,
    },
    {
      key: 'pwr',
      header: 'PWR',
      sortable: true,
      value: (t) => t.regPowerPct,
      render: (t) => (
        <span className="tnum" title="All-play win % — as if each team played every other team every week">
          {pwrStr(t.regPowerPct)}
        </span>
      ),
    },
    {
      key: 'xw',
      header: 'xW',
      sortable: true,
      value: (t) => t.expectedWins,
      render: (t) => (
        <span className="tnum muted" title="Expected regular-season wins from all-play win %">
          {fmt(t.expectedWins, 1)}
        </span>
      ),
    },
    {
      key: 'luck',
      header: 'Luck',
      sortable: true,
      value: (t) => luckWins(t),
      render: (t) => {
        const lw = luckWins(t);
        const arrow = lw > 0.5 ? '▲' : lw < -0.5 ? '▼' : '';
        return (
          <span
            className="tnum"
            title={`Wins above/below expected · ${t.luckyWins} lucky win${t.luckyWins === 1 ? '' : 's'}, ${t.unluckyLosses} unlucky loss${t.unluckyLosses === 1 ? '' : 'es'}`}
          >
            {signed(lw)}
            {arrow && <span className="muted" style={{ fontSize: 11, marginLeft: 3 }}>{arrow}</span>}
          </span>
        );
      },
    },
    {
      key: 'seed',
      header: 'Seed',
      sortable: true,
      defaultDesc: false,
      value: (t) => t.playoffSeed ?? 99,
      render: (t) => <span className="tnum">{t.playoffSeed ?? '—'}</span>,
    },
    {
      key: 'badges',
      header: '',
      render: (t) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {t.finalRank === 1 && <Badge kind="champ">🏆 Champ</Badge>}
          {t.finalRank === 2 && <Badge kind="runner">Runner-Up</Badge>}
          {t.madePlayoffs && t.finalRank != null && t.finalRank > 2 && (
            <Badge kind="playoff">Playoffs</Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      {strip}

      <PageHead
        eyebrow="Season"
        title={`${year} Season`}
        lede={
          season.champion ? (
            <>
              {season.champion.teamName} captured the {year} title with the{' '}
              <span className="em-gold">{season.champion.teamName}</span> — a {season.nTeams}-team,{' '}
              {season.draftType}-draft campaign.
            </>
          ) : (
            <>A {season.nTeams}-team, {season.draftType}-draft campaign.</>
          )
        }
      />

      {/* season KPIs */}
      <div className="grid cols-4">
        <StatTile label="Teams" value={season.nTeams} sub="franchises" />
        <StatTile label="Regular Season" value={`${season.regWeeks} wks`} sub={`then ${nRounds || '—'}-round playoffs`} />
        <StatTile label="Draft" value={draftCap} accent="gold" sub={`${picks.length} picks · ${draftRounds} rounds`} />
        {season.highestScorer && (
          <StatTile
            label="Points-For Leader"
            value={fmt0(season.highestScorer.pf)}
            accent="green"
            sub={ownerName(season.highestScorer.ownerId)}
          />
        )}
      </div>

      {/* podium */}
      <div className="section">
        <SectionHead title="Final Podium" note="Where the season was decided" />
        <div className="podium">
          <PodiumCard podium={season.champion} medal="🥇" place="Champion" p1 ownerName={ownerName} />
          <PodiumCard podium={season.runnerUp} medal="🥈" place="Runner-Up" ownerName={ownerName} />
          <PodiumCard podium={season.third} medal="🥉" place="Third" ownerName={ownerName} />
        </div>

        <div className="grid cols-2" style={{ marginTop: 14 }}>
          {season.regSeasonChamp && (
            <Card className="card-pad">
              <div className="stat-label">Regular-Season #1</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
                <OwnerChip
                  id={season.regSeasonChamp.ownerId}
                  name={ownerName(season.regSeasonChamp.ownerId)}
                  team={season.regSeasonChamp.teamName}
                  size={30}
                />
                <span className="pill">
                  🥇 {recordStr(season.regSeasonChamp.wins, season.regSeasonChamp.losses, season.regSeasonChamp.ties)}
                </span>
              </div>
            </Card>
          )}
          {season.sacko && (
            <Card className="card-pad">
              <div className="stat-label">
                <Badge kind="sacko">Last Place 💩</Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
                <OwnerChip
                  id={season.sacko.ownerId}
                  name={ownerName(season.sacko.ownerId)}
                  team={season.sacko.teamName}
                  size={30}
                />
                <span className="pill">
                  {recordStr(season.sacko.wins, season.sacko.losses, season.sacko.ties)}
                </span>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* final standings */}
      <div className="section">
        <SectionHead
          title="Final Standings"
          note={`All ${season.nTeams} teams · PWR = all-play win %, xW = expected wins, Luck = wins above/below expected`}
        />
        <SortableTable
          columns={columns}
          rows={season.teams}
          rowKey={(t) => t.teamId}
          minWidth={hasDivisions ? 900 : 820}
        />
      </div>

      {/* luck report */}
      {luckiest && unluckiest && luckiest.teamId !== unluckiest.teamId && (
        <div className="section">
          <SectionHead title="Luck Report" note="Who the schedule flattered — and who it robbed" />
          <div className="grid cols-2">
            <LuckCard team={luckiest} kind="lucky" ownerName={ownerName} luckWins={luckWins(luckiest)} signed={signed} pwrStr={pwrStr} />
            <LuckCard team={unluckiest} kind="unlucky" ownerName={ownerName} luckWins={luckWins(unluckiest)} signed={signed} pwrStr={pwrStr} />
          </div>
        </div>
      )}

      {/* playoff bracket */}
      {wb.length > 0 && (
        <div className="section">
          <SectionHead title="Playoff Bracket" note="Winners bracket" />
          <div className="bracket">
            {rounds.map((round, i) => (
              <div className="bracket-round" key={roundMps[i]}>
                <h4>{roundLabel(i)}</h4>
                {round.map((m) => {
                  const homeWin = m.winner === 'HOME';
                  const awayWin = m.winner === 'AWAY';
                  return (
                    <div className="matchup" key={`${m.mp}-${m.home.teamId}-${m.away.teamId}`}>
                      <div className={clsx('team', homeWin && 'win')}>
                        <span className="mt-name">{teamNameFor(m.home.ownerId)}</span>
                        <span className="mt-score">{fmt(m.home.score)}</span>
                      </div>
                      <div className={clsx('team', awayWin && 'win')}>
                        <span className="mt-name">{teamNameFor(m.away.ownerId)}</span>
                        <span className="mt-score">{fmt(m.away.score)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* division standings */}
      {hasDivisions && (
        <div className="section">
          <SectionHead title="Division Standings" note="By regular-season finish" />
          <div className="two-col">
            {season.divisions.map((div) => {
              const divTeams = season.teams
                .filter((t) => t.division === div)
                .sort((a, b) => (a.regRank ?? 99) - (b.regRank ?? 99));
              return (
                <Card key={div}>
                  <div className="card-head">
                    <span className="card-title">{div} Division</span>
                    <span className="card-hint">{divTeams.length} teams</span>
                  </div>
                  <div className="card-pad" style={{ paddingTop: 6, paddingBottom: 6 }}>
                    {divTeams.map((t, i) => (
                      <div key={t.teamId} className="record-row">
                        <span className={clsx('record-rank', i === 0 && 'top')}>{i + 1}</span>
                        <div className="record-main">
                          <OwnerChip id={t.ownerId} name={ownerName(t.ownerId)} team={t.teamName} />
                        </div>
                        <span className="tnum muted" style={{ fontSize: 13 }}>
                          {recordStr(t.regWins, t.regLosses, t.regTies)}
                        </span>
                        <span className="tnum" style={{ fontWeight: 600, marginLeft: 14 }}>
                          {fmt0(t.pf)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* draft teaser */}
      {picks.length > 0 && (
        <div className="section">
          <SectionHead
            title="Draft"
            note={`${draftCap} · ${picks.length} picks · ${draftRounds} rounds`}
            right={<Link to="/drafts" className="link-arrow">Full draft board →</Link>}
          />
          <Card className="card-pad">
            {isAuction && topBid ? (
              <>
                <div className="stat-label">Top Auction Bid</div>
                <div className="record-val" style={{ fontSize: 30, marginTop: 6 }}>${topBid.bid}</div>
                <div className="record-sub" style={{ marginTop: 4 }}>
                  <span className="pos-dot" style={{ background: posColor(topBid.pos) }} />
                  {topBid.playerName} · {topBid.pos}
                  {topBid.ownerId ? <> · {ownerName(topBid.ownerId)}</> : null}
                </div>
              </>
            ) : firstOverall ? (
              <>
                <div className="stat-label">First Overall Pick</div>
                <div className="record-val" style={{ fontSize: 30, marginTop: 6 }}>{firstOverall.playerName}</div>
                <div className="record-sub" style={{ marginTop: 4 }}>
                  <span className="pos-dot" style={{ background: posColor(firstOverall.pos) }} />
                  {firstOverall.pos}
                  {firstOverall.ownerId ? <> · {ownerName(firstOverall.ownerId)}</> : null}
                </div>
              </>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}

function PodiumCard({
  podium,
  medal,
  place,
  p1,
  ownerName,
}: {
  podium: Podium | null;
  medal: string;
  place: string;
  p1?: boolean;
  ownerName: (id: string) => string;
}) {
  return (
    <div className={clsx('podium-card', p1 && 'p1')}>
      <div className="podium-medal">{medal}</div>
      <div className="podium-place">{place}</div>
      {podium ? (
        <>
          <div className="podium-name">{ownerName(podium.ownerId)}</div>
          <div className="podium-team">{podium.teamName}</div>
          <div style={{ marginTop: 10 }}>
            <span className="pill">{recordStr(podium.wins, podium.losses, podium.ties)}</span>
          </div>
        </>
      ) : (
        <div className="podium-name muted">—</div>
      )}
    </div>
  );
}

function LuckCard({
  team,
  kind,
  ownerName,
  luckWins,
  signed,
  pwrStr,
}: {
  team: SeasonTeam;
  kind: 'lucky' | 'unlucky';
  ownerName: (id: string) => string;
  luckWins: number;
  signed: (n: number, d?: number) => string;
  pwrStr: (n: number) => string;
}) {
  return (
    <Card className="card-pad">
      <div className="stat-label">{kind === 'lucky' ? 'Luckiest Team 🍀' : 'Unluckiest Team 💔'}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
        <OwnerChip id={team.ownerId} name={ownerName(team.ownerId)} team={team.teamName} size={30} />
        <span className="pill">{signed(luckWins)} vs expected</span>
      </div>
      <div className="record-sub" style={{ marginTop: 10 }}>
        {recordStr(team.regWins, team.regLosses, team.regTies)} actual · {fmt(team.expectedWins, 1)} expected · PWR {pwrStr(team.regPowerPct)}
        {kind === 'lucky' && team.luckyWins > 0 && <> · {team.luckyWins} lucky win{team.luckyWins === 1 ? '' : 's'}</>}
        {kind === 'unlucky' && team.unluckyLosses > 0 && <> · {team.unluckyLosses} unlucky loss{team.unluckyLosses === 1 ? '' : 'es'}</>}
      </div>
    </Card>
  );
}
