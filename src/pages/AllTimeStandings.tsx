import { useLeague } from '../data';
import { PageHead, SectionHead, StatTile } from '../components/bits';
import { OwnerChip } from '../components/OwnerChip';
import { SortableTable, type Column } from '../components/SortableTable';
import { fmt, fmt0, ordinal, pct, recordStr } from '../lib/util';
import type { Owner } from '../types';

const FAR = Number.POSITIVE_INFINITY;

export function AllTimeStandings() {
  const { league } = useLeague();
  const owners = league.owners;
  const currentSeason = league.meta.lastSeason;

  // Career leaders for the KPI row.
  const winningest = [...owners].sort((a, b) => b.allTime.wins - a.allTime.wins)[0];
  const bestPct = [...owners]
    .filter((o) => o.allTime.gamesPlayed >= 40)
    .sort((a, b) => b.allTime.pct - a.allTime.pct)[0];
  const mostPoints = [...owners].sort((a, b) => b.allTime.pf - a.allTime.pf)[0];
  const mostTitles = [...owners].sort(
    (a, b) => b.allTime.championships - a.allTime.championships || b.allTime.wins - a.allTime.wins,
  )[0];

  const titleCount = mostTitles.allTime.championships;

  const columns: Column<Owner>[] = [
    {
      key: 'name',
      header: 'Manager',
      align: 'left',
      sortable: true,
      defaultDesc: false,
      value: (o) => o.name,
      render: (o) => {
        const first = o.seasonsPlayed[0];
        const last = o.seasonsPlayed[o.seasonsPlayed.length - 1];
        const active = last === currentSeason;
        const franchise = o.teamNames[o.teamNames.length - 1];
        return (
          <OwnerChip
            id={o.id}
            name={o.name}
            tag={active ? undefined : <span className="badge former">Former</span>}
            team={active ? franchise : `${franchise} · ${first}–${last}`}
          />
        );
      },
    },
    {
      key: 'seasons',
      header: 'Seasons',
      sortable: true,
      value: (o) => o.nSeasons,
      render: (o) => <span className="tnum">{o.nSeasons}</span>,
    },
    {
      key: 'record',
      header: 'Record',
      sortable: true,
      value: (o) => o.allTime.wins,
      render: (o) => <RecordCell o={o} />,
    },
    {
      key: 'pct',
      header: 'Win %',
      sortable: true,
      value: (o) => o.allTime.pct,
      render: (o) => (
        <span className="tnum" style={{ fontWeight: 600 }}>
          {pct(o.allTime.pct)}
        </span>
      ),
    },
    {
      key: 'pf',
      header: 'PF',
      sortable: true,
      value: (o) => o.allTime.pf,
      render: (o) => <span className="tnum">{fmt0(o.allTime.pf)}</span>,
    },
    {
      key: 'pa',
      header: 'PA',
      sortable: true,
      value: (o) => o.allTime.pa,
      render: (o) => (
        <span className="tnum" style={{ color: 'var(--ink-2)' }}>
          {fmt0(o.allTime.pa)}
        </span>
      ),
    },
    {
      key: 'ppg',
      header: 'PPG',
      sortable: true,
      value: (o) => o.allTime.ppg,
      render: (o) => <span className="tnum">{fmt(o.allTime.ppg)}</span>,
    },
    {
      key: 'titles',
      header: 'Titles',
      sortable: true,
      value: (o) => o.allTime.championships,
      render: (o) => {
        const n = o.allTime.championships;
        if (n <= 0) return <span className="muted">0</span>;
        return (
          <span
            className="tnum"
            title={`${n} championship${n > 1 ? 's' : ''}`}
            style={{ color: 'var(--gold-2)', fontWeight: 600 }}
          >
            {'🏆'.repeat(Math.min(n, 5))}
            {n > 5 ? ` ${n}` : ''}
          </span>
        );
      },
    },
    {
      key: 'playoffApps',
      header: 'Playoffs',
      sortable: true,
      value: (o) => o.allTime.playoffApps,
      render: (o) => <span className="tnum">{o.allTime.playoffApps}</span>,
    },
    {
      key: 'best',
      header: 'Best',
      sortable: true,
      defaultDesc: false,
      value: (o) => o.allTime.bestFinish ?? FAR,
      render: (o) => {
        const b = o.allTime.bestFinish;
        return (
          <span
            className="tnum"
            style={b === 1 ? { color: 'var(--gold-2)', fontWeight: 700 } : undefined}
          >
            {ordinal(b)}
          </span>
        );
      },
    },
    {
      key: 'avgFinish',
      header: 'Avg Finish',
      sortable: true,
      defaultDesc: false,
      value: (o) => o.allTime.avgFinish ?? FAR,
      render: (o) => (
        <span className="tnum" style={{ color: 'var(--ink-2)' }}>
          {o.allTime.avgFinish == null ? '—' : fmt(o.allTime.avgFinish, 1)}
        </span>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHead
        eyebrow="Career Records"
        title="All-Time Standings"
        lede={
          <>
            The Ledger — every manager's complete career, combining regular season and playoff
            results across all {league.meta.nSeasons} seasons ({league.meta.firstSeason}–
            {league.meta.lastSeason}). Sort any column to crown a new king.
          </>
        }
      />

      <div className="grid cols-4">
        <StatTile
          label="Winningest Manager"
          accent="green"
          small
          value={winningest.name}
          sub={
            <>
              <span className="em">{recordStr(winningest.allTime.wins, winningest.allTime.losses, winningest.allTime.ties)}</span>{' '}
              · {pct(winningest.allTime.pct)} win%
            </>
          }
        />
        <StatTile
          label="Best Win % · 40+ GP"
          accent="gold"
          small
          value={bestPct.name}
          sub={
            <>
              <span className="em">{pct(bestPct.allTime.pct)}</span> ·{' '}
              {recordStr(bestPct.allTime.wins, bestPct.allTime.losses, bestPct.allTime.ties)}
            </>
          }
        />
        <StatTile
          label="Most Points"
          small
          value={mostPoints.name}
          sub={
            <>
              <span className="em">{fmt0(mostPoints.allTime.pf)}</span> pts · {fmt(mostPoints.allTime.ppg)} PPG
            </>
          }
        />
        <StatTile
          label="Most Titles"
          accent="gold"
          small
          value={mostTitles.name}
          sub={
            <>
              <span className="em">{'🏆'.repeat(Math.min(titleCount, 5))}</span> {titleCount} title
              {titleCount > 1 ? 's' : ''}
              {mostTitles.allTime.titles.length > 0 ? ` · ${mostTitles.allTime.titles.join(', ')}` : ''}
            </>
          }
        />
      </div>

      <div className="section">
        <SectionHead
          title="The Ledger"
          note={`All ${owners.length} managers, ranked by career wins. Click any column header to re-sort.`}
        />
        <SortableTable<Owner>
          columns={columns}
          rows={owners}
          rank
          initialSortKey="record"
          minWidth={980}
          rowKey={(o) => o.id}
        />
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12, maxWidth: '75ch' }}>
          PF and PA include playoff and consolation games; win % counts ties as half. Best and Avg
          Finish are based on each season's final standing.
        </p>
      </div>
    </div>
  );
}

function RecordCell({ o }: { o: Owner }) {
  const { wins, losses, ties } = o.allTime;
  return (
    <span className="tnum">
      <span className="wl-w">{wins}</span>
      <span style={{ color: 'var(--ink-3)' }}>–</span>
      <span className="wl-l">{losses}</span>
      {ties > 0 && (
        <>
          <span style={{ color: 'var(--ink-3)' }}>–</span>
          <span style={{ color: 'var(--tie)' }}>{ties}</span>
        </>
      )}
    </span>
  );
}
