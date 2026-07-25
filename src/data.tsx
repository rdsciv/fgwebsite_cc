import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { League, Owner, Season } from './types';

interface Ctx {
  league: League;
  ownerById: Map<string, Owner>;
  seasonByYear: Map<number, Season>;
  /** Public-facing franchise / team label (preferred everywhere on the site). */
  ownerName: (id: string) => string;
  /** Legal manager name for owner tracking / profile headers. */
  managerName: (id: string) => string;
  /** Most recent (or year-specific) team name for an owner. */
  teamLabel: (id: string, year?: number) => string;
}

const LeagueContext = createContext<Ctx | null>(null);

function latestTeamName(o: Owner | undefined, year?: number): string | null {
  if (!o) return null;
  if (year != null) {
    const s = o.seasons.find((x) => x.year === year);
    if (s?.teamName) return s.teamName;
  }
  const sorted = [...o.seasons].sort((a, b) => b.year - a.year);
  if (sorted[0]?.teamName) return sorted[0].teamName;
  if (o.teamNames?.length) return o.teamNames[o.teamNames.length - 1];
  return null;
}

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [league, setLeague] = useState<League | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('./data/league.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: League) => setLeague(d))
      .catch((e) => setError(String(e)));
  }, []);

  const value = useMemo<Ctx | null>(() => {
    if (!league) return null;
    const ownerById = new Map(league.owners.map((o) => [o.id, o]));
    const seasonByYear = new Map(league.seasons.map((s) => [s.year, s]));
    const managerName = (id: string) =>
      league.ownerNames[id] ?? ownerById.get(id)?.displayName ?? ownerById.get(id)?.name ?? 'Unknown Manager';
    const teamLabel = (id: string, year?: number) => {
      const o = ownerById.get(id);
      return latestTeamName(o, year) ?? managerName(id);
    };
    // Site-wide default display is franchise/team name; owner ids still track managers.
    const ownerName = (id: string) => teamLabel(id);
    return { league, ownerById, seasonByYear, ownerName, managerName, teamLabel };
  }, [league]);

  if (error) {
    return (
      <div className="load-state">
        <div className="load-card">
          <h1>Couldn't load league data</h1>
          <p>{error}</p>
          <p className="muted">Run <code>npm run refresh</code> to regenerate the data file.</p>
        </div>
      </div>
    );
  }
  if (!value) {
    return (
      <div className="load-state">
        <div className="loader" aria-label="Loading league history">
          <div className="loader-ball" />
          <p>Loading league history…</p>
        </div>
      </div>
    );
  }
  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}

export function useLeague(): Ctx {
  const ctx = useContext(LeagueContext);
  if (!ctx) throw new Error('useLeague must be used within LeagueProvider');
  return ctx;
}
