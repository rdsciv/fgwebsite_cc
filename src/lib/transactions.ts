// Loader for per-season acquisition events (public/data/transactions/{year}.json).
export type AcqMethod = 'W' | 'F' | 'T'; // waiver, free agent, trade
export interface AcqEvent {
  pid: number;
  team: number;
  m: AcqMethod;
  sp: number;
}
export interface SeasonTx {
  year: number;
  events: AcqEvent[];
}

const cache = new Map<number, Promise<SeasonTx | null>>();

export function loadTransactions(year: number): Promise<SeasonTx | null> {
  if (!cache.has(year)) {
    cache.set(
      year,
      fetch(`./data/transactions/${year}.json`)
        .then((r) => (r.ok ? (r.json() as Promise<SeasonTx>) : null))
        .catch(() => null),
    );
  }
  return cache.get(year)!;
}
