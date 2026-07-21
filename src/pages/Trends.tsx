import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { useLeague } from '../data';
import { PageHead, SectionHead } from '../components/bits';
import { fmt, ordinal, SERIES, clsx } from '../lib/util';

const firstName = (n: string) => n.trim().split(/\s+/)[0];
const MAX_TRAJ = 6;

interface TipItem {
  value?: number | null;
  name?: string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}
interface TipProps {
  active?: boolean;
  payload?: TipItem[];
  label?: string | number;
}

function ScoringTip({ active, payload, label }: TipProps) {
  if (!active || !payload || !payload.length) return null;
  const v = payload[0]?.value;
  if (v == null) return null;
  return (
    <div className="tooltip-card">
      <div className="tt-title">{label} season</div>
      <div className="tooltip-row">
        <span>Avg points / team / week</span>
        <span className="tnum">{fmt(v)}</span>
      </div>
    </div>
  );
}

function TitleTip({ active, payload }: TipProps) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const v = item?.value;
  if (v == null) return null;
  const name = (item?.payload?.name as string | undefined) ?? '';
  return (
    <div className="tooltip-card">
      <div className="tt-title">{name}</div>
      <div className="tooltip-row">
        <span>Championships</span>
        <span className="tnum">{v}</span>
      </div>
    </div>
  );
}

function CareerTip({ active, payload }: TipProps) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const v = item?.value;
  if (v == null) return null;
  const name = (item?.payload?.name as string | undefined) ?? '';
  return (
    <div className="tooltip-card">
      <div className="tt-title">{name}</div>
      <div className="tooltip-row">
        <span>Points / week (career)</span>
        <span className="tnum">{fmt(v)}</span>
      </div>
    </div>
  );
}

function TrajTip({ active, payload, label }: TipProps) {
  if (!active || !payload || !payload.length) return null;
  const rows = payload
    .filter((p) => p.value != null)
    .sort((a, b) => (a.value as number) - (b.value as number));
  if (!rows.length) return null;
  return (
    <div className="tooltip-card">
      <div className="tt-title">{label} finish</div>
      {rows.map((p, i) => (
        <div className="tooltip-row" key={i}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 3, borderRadius: 2, background: p.color }} />
            {p.name}
          </span>
          <span className="tnum">{ordinal(p.value as number)}</span>
        </div>
      ))}
    </div>
  );
}

export function Trends() {
  const { league, ownerName } = useLeague();
  const { seasons, owners } = league;

  const axisTick = { fill: 'var(--ink-3)', fontSize: 12 };

  // 1 — scoring by season: era-consistent league average weekly team score
  // (regular-season single-NFL-week scores; avoids the 2-week playoff distortion of older years)
  const scoringData = useMemo(
    () =>
      [...seasons]
        .sort((a, b) => a.year - b.year)
        .map((s) => ({ year: s.year, ppg: s.avgScore })),
    [seasons],
  );
  const scoreDomain = useMemo<[number, number]>(() => {
    const vals = scoringData.map((d) => d.ppg);
    return [Math.floor(Math.min(...vals) - 4), Math.ceil(Math.max(...vals) + 4)];
  }, [scoringData]);

  // 2 — championship pedigree: managers with titles, desc
  const titleData = useMemo(
    () =>
      owners
        .filter((o) => o.allTime.championships > 0)
        .map((o) => ({ name: o.name, titles: o.allTime.championships }))
        .sort((a, b) => b.titles - a.titles),
    [owners],
  );

  // 4 — career scoring: all-time ppg by manager, desc
  const careerData = useMemo(
    () =>
      owners
        .filter((o) => o.allTime.gamesPlayed > 0)
        .map((o) => ({ name: o.name, ppg: o.allTime.ppg }))
        .sort((a, b) => b.ppg - a.ppg),
    [owners],
  );

  // 3 — finish trajectory (interactive)
  const years = useMemo(
    () => [...new Set(seasons.map((s) => s.year))].sort((a, b) => a - b),
    [seasons],
  );
  const rankByOwnerYear = useMemo(() => {
    const m = new Map<string, Map<number, number | null>>();
    for (const o of owners) {
      const ym = new Map<number, number | null>();
      for (const s of o.seasons) ym.set(s.year, s.finalRank);
      m.set(o.id, ym);
    }
    return m;
  }, [owners]);

  // owners ordered by pedigree so the marquee names lead the toggle row
  const rankedOwners = useMemo(
    () =>
      [...owners].sort(
        (a, b) =>
          b.allTime.championships - a.allTime.championships ||
          b.allTime.wins - a.allTime.wins,
      ),
    [owners],
  );

  const [selected, setSelected] = useState<string[]>(() =>
    rankedOwners.slice(0, 3).map((o) => o.id),
  );

  const colorOf = (id: string) => {
    const i = selected.indexOf(id);
    return i >= 0 ? SERIES[i % SERIES.length] : 'var(--ink-3)';
  };

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_TRAJ) return prev;
      return [...prev, id];
    });
  }

  const trajData = useMemo(
    () =>
      years.map((y) => {
        const row: Record<string, number | null> = { year: y };
        for (const id of selected) {
          const r = rankByOwnerYear.get(id)?.get(y);
          row[id] = r == null ? null : r;
        }
        return row;
      }),
    [years, selected, rankByOwnerYear],
  );

  const atCap = selected.length >= MAX_TRAJ;
  const careerHeight = Math.max(340, careerData.length * 30 + 40);

  return (
    <div className="page">
      <PageHead
        eyebrow="Analytics"
        title="League Trends"
        lede={
          <>
            Twelve seasons of the AFFL, visualized. How weekly scoring has shifted, who has
            stacked titles, whose fortunes rose and fell, and who has been the most
            productive across a career.
          </>
        }
      />

      {/* scoring inflation + championship pedigree */}
      <div className="section">
        <div className="grid cols-2">
          <div className="chart-card">
            <div className="chart-title">How the league scores</div>
            <div className="chart-sub">Average points per team, per regular-season week</div>
            <ResponsiveContainer width="100%" height={264}>
              <LineChart data={scoringData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={axisTick}
                  axisLine={{ stroke: 'var(--line)' }}
                  tickLine={{ stroke: 'var(--line)' }}
                />
                <YAxis
                  domain={scoreDomain}
                  tick={axisTick}
                  axisLine={{ stroke: 'var(--line)' }}
                  tickLine={{ stroke: 'var(--line)' }}
                  width={44}
                />
                <Tooltip content={<ScoringTip />} cursor={{ stroke: 'var(--line-strong)' }} />
                <Line
                  type="monotone"
                  dataKey="ppg"
                  stroke="var(--s1)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'var(--s1)', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <div className="chart-title">Championship pedigree</div>
            <div className="chart-sub">Titles won, managers with at least one</div>
            <ResponsiveContainer width="100%" height={264}>
              <BarChart data={titleData} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickFormatter={firstName}
                  interval={0}
                  tick={axisTick}
                  axisLine={{ stroke: 'var(--line)' }}
                  tickLine={{ stroke: 'var(--line)' }}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, 'dataMax + 1']}
                  tick={axisTick}
                  axisLine={{ stroke: 'var(--line)' }}
                  tickLine={{ stroke: 'var(--line)' }}
                  width={28}
                />
                <Tooltip content={<TitleTip />} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="titles" fill="var(--gold)" radius={[5, 5, 0, 0]} maxBarSize={54}>
                  <LabelList
                    dataKey="titles"
                    position="top"
                    fill="var(--gold-2)"
                    fontSize={13}
                    fontWeight={700}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* finish trajectory — interactive centerpiece */}
      <div className="section">
        <SectionHead
          title="Finish trajectory"
          note="Final standings by season — pick managers to compare"
          right={<span className="muted" style={{ fontSize: 13 }}>{selected.length}/{MAX_TRAJ} selected</span>}
        />
        <div className="chart-card">
          <div className="chip-row" style={{ marginBottom: 14 }}>
            {rankedOwners.map((o) => {
              const on = selected.includes(o.id);
              const disabled = !on && atCap;
              return (
                <button
                  key={o.id}
                  className={clsx('owner-toggle', on && 'on')}
                  onClick={() => toggle(o.id)}
                  disabled={disabled}
                  style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                  aria-pressed={on}
                >
                  <span className="sw" style={{ background: colorOf(o.id) }} />
                  {firstName(o.name)}
                </button>
              );
            })}
          </div>

          <div className="chart-title">Who rose, who fell</div>
          <div className="chart-sub">
            Lower is better — 1st place sits at the top. Gaps are seasons a manager sat out.
          </div>
          <ResponsiveContainer width="100%" height={370}>
            <LineChart data={trajData} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis
                dataKey="year"
                tick={axisTick}
                axisLine={{ stroke: 'var(--line)' }}
                tickLine={{ stroke: 'var(--line)' }}
              />
              <YAxis
                reversed
                domain={[1, 12]}
                allowDecimals={false}
                tickFormatter={(v: number) => ordinal(v)}
                tick={axisTick}
                axisLine={{ stroke: 'var(--line)' }}
                tickLine={{ stroke: 'var(--line)' }}
                width={44}
              />
              <Tooltip content={<TrajTip />} cursor={{ stroke: 'var(--line-strong)' }} />
              {selected.map((id) => (
                <Line
                  key={id}
                  type="linear"
                  dataKey={id}
                  name={ownerName(id)}
                  stroke={colorOf(id)}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: colorOf(id), strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {selected.length > 0 ? (
            <div className="legend">
              {selected.map((id) => (
                <span className="legend-item" key={id}>
                  <span className="legend-sw" style={{ background: colorOf(id) }} />
                  {ownerName(id)}
                </span>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              Select a manager above to chart their finishes.
            </div>
          )}
        </div>
      </div>

      {/* career scoring */}
      <div className="section">
        <div className="chart-card">
          <div className="chart-title">Points per week, for a career</div>
          <div className="chart-sub">All-time average score across every week played</div>
          <ResponsiveContainer width="100%" height={careerHeight}>
            <BarChart
              data={careerData}
              layout="vertical"
              margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
            >
              <CartesianGrid stroke="var(--line)" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 'dataMax + 6']}
                tick={axisTick}
                axisLine={{ stroke: 'var(--line)' }}
                tickLine={{ stroke: 'var(--line)' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fill: 'var(--ink-2)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--line)' }}
                tickLine={{ stroke: 'var(--line)' }}
              />
              <Tooltip content={<CareerTip />} cursor={{ fill: 'var(--surface-2)' }} />
              <Bar dataKey="ppg" fill="var(--s3)" radius={[0, 5, 5, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
