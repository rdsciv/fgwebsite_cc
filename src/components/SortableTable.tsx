import { useMemo, useState, type ReactNode } from 'react';
import { clsx } from '../lib/util';

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: 'left' | 'right';
  sortable?: boolean;
  /** numeric or string value used for sorting */
  value?: (row: T) => number | string;
  render: (row: T, i: number) => ReactNode;
  /** first click sorts descending (good for stat columns) */
  defaultDesc?: boolean;
}

export function SortableTable<T>({
  columns,
  rows,
  initialSortKey,
  rank = false,
  minWidth = 560,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  initialSortKey?: string;
  rank?: boolean;
  minWidth?: number;
  rowKey: (row: T, i: number) => string | number;
}) {
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey ?? null);
  const [desc, setDesc] = useState(true);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.value) return rows;
    const val = col.value;
    const arr = [...rows].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (typeof av === 'number' && typeof bv === 'number') return desc ? bv - av : av - bv;
      return desc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });
    return arr;
  }, [rows, columns, sortKey, desc]);

  function onSort(col: Column<T>) {
    if (!col.sortable || !col.value) return;
    if (sortKey === col.key) setDesc((d) => !d);
    else {
      setSortKey(col.key);
      setDesc(col.defaultDesc ?? true);
    }
  }

  return (
    <div className="table-wrap">
      <table className="data" style={{ minWidth }}>
        <thead>
          <tr>
            {rank && <th style={{ textAlign: 'right' }}>#</th>}
            {columns.map((c) => (
              <th
                key={c.key}
                className={clsx(c.sortable && c.value && 'sortable')}
                style={{ textAlign: c.align ?? 'right' }}
                onClick={() => onSort(c)}
              >
                {c.header}
                {sortKey === c.key && <span className="arr">{desc ? '▾' : '▴'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={rowKey(row, i)}>
              {rank && <td className={clsx('rank-cell', i === 0 && 'rank-1')} style={{ textAlign: 'right' }}>{i + 1}</td>}
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align ?? 'right' }}>
                  {c.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
