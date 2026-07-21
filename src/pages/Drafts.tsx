import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLeague } from '../data';
import { PageHead, SectionHead, StatTile, Card } from '../components/bits';
import { OwnerChip } from '../components/OwnerChip';
import { SortableTable, type Column } from '../components/SortableTable';
import { fmt, fmt0, posColor } from '../lib/util';
import type { DraftPick } from '../types';

const POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'D/ST', 'K'];

function PosDot({ pos, size = 8 }: { pos: string; size?: number }) {
  return (
    <span
      className="pos-dot"
      style={{ background: posColor(pos), width: size, height: size }}
    />
  );
}

function SpendBar({
  leading,
  amount,
  max,
  color,
  labelWidth = 150,
  highlight = false,
}: {
  leading: ReactNode;
  amount: number;
  max: number;
  color: string;
  labelWidth?: number;
  highlight?: boolean;
}) {
  const w = max > 0 ? Math.max((amount / max) * 100, 2) : 0;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${labelWidth}px 1fr 64px`,
        alignItems: 'center',
        gap: 12,
        padding: '7px 0',
      }}
    >
      <div style={{ minWidth: 0 }}>{leading}</div>
      <div className="bar-track" style={{ height: 12 }}>
        <div className="bar-fill" style={{ width: `${w}%`, background: color }} />
      </div>
      <span
        className="tnum"
        style={{ textAlign: 'right', fontWeight: 600, color: highlight ? 'var(--gold-2)' : 'var(--ink)' }}
      >
        ${fmt0(amount)}
      </span>
    </div>
  );
}

export function Drafts() {
  const { league, seasonByYear, ownerName } = useLeague();
  const { meta, records } = league;

  const [year, setYear] = useState<number>(meta.lastSeason);

  // All-time auction facts across every auction season.
  const allTime = useMemo(() => {
    let totalSpend = 0;
    let auctionSeasons = 0;
    let firstAuction = Infinity;
    const posSpend: Record<string, number> = {};
    for (const s of league.seasons) {
      if (s.draft.type !== 'auction') continue;
      auctionSeasons++;
      firstAuction = Math.min(firstAuction, s.year);
      for (const p of s.draft.picks) {
        totalSpend += p.bid;
        posSpend[p.pos] = (posSpend[p.pos] ?? 0) + p.bid;
      }
    }
    const priciest = Object.entries(posSpend).sort((a, b) => b[1] - a[1])[0] ?? ['—', 0];
    return {
      totalSpend,
      auctionSeasons,
      firstAuction: Number.isFinite(firstAuction) ? firstAuction : meta.firstSeason,
      priciestPos: priciest[0],
      priciestPosSpend: priciest[1],
    };
  }, [league.seasons, meta.firstSeason]);

  const s = seasonByYear.get(year);
  const picks: DraftPick[] = s?.draft.picks ?? [];

  // Per-season spending aggregation (auction only).
  const auctionAgg = useMemo(() => {
    if (!s || s.draft.type !== 'auction') return null;
    const p = s.draft.picks;
    const total = p.reduce((a, x) => a + x.bid, 0);
    const topBid = p.reduce((a, x) => (x.bid > a.bid ? x : a), p[0]);

    const byOwnerMap = new Map<string, number>();
    for (const x of p) {
      if (!x.ownerId) continue;
      byOwnerMap.set(x.ownerId, (byOwnerMap.get(x.ownerId) ?? 0) + x.bid);
    }
    const byManager = [...byOwnerMap.entries()]
      .map(([id, sum]) => ({ id, name: ownerName(id), total: sum }))
      .sort((a, b) => b.total - a.total);

    const byPos = POS_ORDER.map((pos) => {
      const rows = p.filter((x) => x.pos === pos);
      return { pos, total: rows.reduce((a, x) => a + x.bid, 0), count: rows.length };
    }).filter((r) => r.count > 0);

    return {
      total,
      avg: p.length ? total / p.length : 0,
      topBid,
      byManager,
      maxManager: byManager[0]?.total ?? 0,
      byPos,
      maxPos: Math.max(...byPos.map((r) => r.total), 0),
      topSpender: byManager[0],
    };
  }, [s, ownerName]);

  const topBids = records.biggestBids.slice(0, 15);

  const auctionCols: Column<DraftPick>[] = [
    {
      key: 'player',
      header: 'Player',
      align: 'left',
      render: (p) => (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <PosDot pos={p.pos} />
          <span className="owner-nm" style={{ fontWeight: 500 }}>{p.playerName}</span>
          <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{p.pos}</span>
        </span>
      ),
    },
    {
      key: 'manager',
      header: 'Manager',
      align: 'left',
      sortable: true,
      value: (p) => (p.ownerId ? ownerName(p.ownerId) : ''),
      render: (p) =>
        p.ownerId ? (
          <OwnerChip id={p.ownerId} name={ownerName(p.ownerId)} size={22} />
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      key: 'round',
      header: 'Round',
      sortable: true,
      value: (p) => p.round,
      render: (p) => <span className="tnum">{p.round}</span>,
    },
    {
      key: 'bid',
      header: '$ Bid',
      sortable: true,
      defaultDesc: true,
      value: (p) => p.bid,
      render: (p) => (
        <span className="tnum" style={{ fontWeight: 600 }}>${p.bid}</span>
      ),
    },
    {
      key: 'keeper',
      header: 'Keeper',
      render: (p) => (p.keeper ? '🔒' : <span className="muted">—</span>),
    },
  ];

  const snakeCols: Column<DraftPick>[] = [
    {
      key: 'player',
      header: 'Player',
      align: 'left',
      render: (p) => (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <PosDot pos={p.pos} />
          <span className="owner-nm" style={{ fontWeight: 500 }}>{p.playerName}</span>
          <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{p.pos}</span>
        </span>
      ),
    },
    {
      key: 'manager',
      header: 'Manager',
      align: 'left',
      sortable: true,
      value: (p) => (p.ownerId ? ownerName(p.ownerId) : ''),
      render: (p) =>
        p.ownerId ? (
          <OwnerChip id={p.ownerId} name={ownerName(p.ownerId)} size={22} />
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      key: 'pick',
      header: 'Round · Pick',
      render: (p) => (
        <span className="tnum">
          {p.round}.{String(p.roundPick).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'overall',
      header: 'Overall',
      sortable: true,
      defaultDesc: false,
      value: (p) => p.overall,
      render: (p) => <span className="tnum" style={{ fontWeight: 600 }}>{p.overall}</span>,
    },
  ];

  return (
    <div className="page">
      <PageHead
        eyebrow="Auction & Draft"
        title="Draft Room"
        lede={
          <>
            Every draft-day gamble since {meta.firstSeason} — record auction bids, spending
            splits by manager and position, and the full board for all {meta.nSeasons} seasons.
          </>
        }
      />

      <div className="grid cols-4">
        <StatTile
          label="Drafts on Record"
          value={meta.nSeasons}
          sub={`${meta.firstSeason}–${meta.lastSeason}`}
        />
        <StatTile
          label="Auction Era"
          value={allTime.auctionSeasons}
          accent="green"
          sub={`seasons since ${allTime.firstAuction}`}
        />
        <StatTile
          label="Record Bid"
          value={`$${records.biggestBids[0]?.bid ?? 0}`}
          accent="gold"
          sub={`${records.biggestBids[0]?.player} · ${records.biggestBids[0]?.year}`}
        />
        <StatTile
          label="Priciest Position"
          value={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <PosDot pos={allTime.priciestPos} size={14} />
              {allTime.priciestPos}
            </span>
          }
          sub={`$${fmt0(allTime.priciestPosSpend)} bid all-time`}
        />
      </div>

      {/* ---- All-time biggest bids ---- */}
      <div className="section">
        <SectionHead
          title="Biggest Auction Bids — All-Time"
          note="The steepest single-player prices across every draft (year shown per row)"
        />
        <div className="table-wrap">
          <table className="data" style={{ minWidth: 680 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'right' }}>#</th>
                <th style={{ textAlign: 'left' }}>Player</th>
                <th style={{ textAlign: 'right' }}>$ Bid</th>
                <th style={{ textAlign: 'left' }}>Manager</th>
                <th style={{ textAlign: 'right' }}>Year</th>
              </tr>
            </thead>
            <tbody>
              {topBids.map((b, i) => (
                <tr key={`${b.year}-${b.player}-${b.bid}`}>
                  <td className={i === 0 ? 'rank-cell rank-1' : 'rank-cell'} style={{ textAlign: 'right' }}>
                    {i + 1}
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <PosDot pos={b.pos} />
                      <span className="owner-nm" style={{ fontWeight: 500 }}>{b.player}</span>
                      <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{b.pos}</span>
                    </span>
                  </td>
                  <td
                    className="tnum"
                    style={{
                      textAlign: 'right',
                      fontWeight: 700,
                      color: i === 0 ? 'var(--gold-2)' : 'var(--ink)',
                    }}
                  >
                    ${b.bid}
                  </td>
                  <td style={{ textAlign: 'left', color: 'var(--ink-2)' }}>{b.owner}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/seasons/${b.year}`} className="em-gold" style={{ fontWeight: 600 }}>
                      {b.year}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Season selector ---- */}
      <div className="section">
        <SectionHead
          title="Season Draft Boards"
          note="Pick a year to explore its draft and spending"
        />
        <div className="year-strip">
          {meta.seasons.map((y) => (
            <button
              key={y}
              className={y === year ? 'year-btn active' : 'year-btn'}
              onClick={() => setYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Selected season ---- */}
      {!s ? (
        <div className="section">
          <div className="empty">No draft data for {year}.</div>
        </div>
      ) : s.draft.type === 'auction' && auctionAgg ? (
        <div className="section">
          <SectionHead
            title={`${year} Auction Draft`}
            note={`${s.nTeams} managers · ${picks.length} players drafted`}
            right={
              <Link to={`/seasons/${year}`} className="link-arrow">
                Season page →
              </Link>
            }
          />

          <div className="grid cols-4">
            <StatTile
              label="Total Spent"
              value={`$${fmt0(auctionAgg.total)}`}
              accent="green"
              sub="across all rosters"
            />
            <StatTile
              label="Highest Bid"
              value={`$${auctionAgg.topBid.bid}`}
              accent="gold"
              sub={`${auctionAgg.topBid.playerName} (${auctionAgg.topBid.pos})`}
            />
            <StatTile
              label="Avg Winning Bid"
              value={`$${fmt(auctionAgg.avg, 1)}`}
              sub={`${picks.length} players`}
            />
            {auctionAgg.topSpender && (
              <StatTile
                label="Top Spender"
                value={auctionAgg.topSpender.name}
                small
                sub={`$${fmt0(auctionAgg.topSpender.total)} committed`}
              />
            )}
          </div>

          <div className="two-col" style={{ marginTop: 16 }}>
            <Card>
              <div className="card-head">
                <span className="card-title">Spending by Manager</span>
                <span className="card-hint">total auction dollars</span>
              </div>
              <div className="card-pad" style={{ paddingTop: 8, paddingBottom: 12 }}>
                {auctionAgg.byManager.map((m, i) => (
                  <SpendBar
                    key={m.id}
                    leading={<OwnerChip id={m.id} name={m.name} size={22} />}
                    amount={m.total}
                    max={auctionAgg.maxManager}
                    color="var(--accent)"
                    highlight={i === 0}
                  />
                ))}
              </div>
            </Card>

            <Card>
              <div className="card-head">
                <span className="card-title">Spending by Position</span>
                <span className="card-hint">where the money went</span>
              </div>
              <div className="card-pad" style={{ paddingTop: 8, paddingBottom: 12 }}>
                {auctionAgg.byPos.map((r) => (
                  <SpendBar
                    key={r.pos}
                    labelWidth={96}
                    leading={
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontWeight: 600 }}>
                        <PosDot pos={r.pos} size={11} />
                        {r.pos}
                        <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>
                          {r.count}
                        </span>
                      </span>
                    }
                    amount={r.total}
                    max={auctionAgg.maxPos}
                    color={posColor(r.pos)}
                  />
                ))}
              </div>
            </Card>
          </div>

          <div style={{ marginTop: 16 }}>
            <SortableTable
              columns={auctionCols}
              rows={picks}
              initialSortKey="bid"
              minWidth={760}
              rowKey={(p) => p.overall}
            />
          </div>
        </div>
      ) : (
        <div className="section">
          <SectionHead
            title={`${year} Snake Draft`}
            note={`${s.nTeams} managers · ${picks.length} picks`}
            right={
              <Link to={`/seasons/${year}`} className="link-arrow">
                Season page →
              </Link>
            }
          />
          <Card className="card-pad">
            <p className="muted" style={{ margin: 0 }}>
              The AFFL ran a traditional <span className="em-gold">snake draft</span> in{' '}
              {meta.firstSeason}–{meta.firstSeason + 1} before switching to an auction format in{' '}
              {allTime.firstAuction}. Bid dollars were not tracked in these seasons.
            </p>
          </Card>
          <div style={{ marginTop: 16 }}>
            <SortableTable
              columns={snakeCols}
              rows={picks}
              minWidth={640}
              rowKey={(p) => p.overall}
            />
          </div>
        </div>
      )}
    </div>
  );
}
