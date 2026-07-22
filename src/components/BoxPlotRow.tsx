import type { ScoreDistribution } from '../types';
import { fmt } from '../lib/util';

export function BoxPlotRow({ dist, domain }: { dist: ScoreDistribution; domain: [number, number] }) {
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  const pos = (v: number) => ((v - lo) / span) * 100;

  const minP = pos(dist.min);
  const maxP = pos(dist.max);
  const q1P = pos(dist.q1);
  const q3P = pos(dist.q3);
  const medP = pos(dist.median);

  const title = `Min ${fmt(dist.min, 1)}\nQ1 ${fmt(dist.q1, 1)}\nMedian ${fmt(dist.median, 1)}\nQ3 ${fmt(dist.q3, 1)}\nMax ${fmt(dist.max, 1)}\nGames ${dist.n}`;

  return (
    <div className="boxplot-track" title={title}>
      <div className="boxplot-whisker" style={{ left: `${minP}%`, width: `${maxP - minP}%` }} />
      <div className="boxplot-tick" style={{ left: `${minP}%` }} />
      <div className="boxplot-tick" style={{ left: `${maxP}%` }} />
      <div className="boxplot-box" style={{ left: `${q1P}%`, width: `${Math.max(q3P - q1P, 1)}%` }}>
        <div className="boxplot-median" style={{ left: `${((medP - q1P) / (q3P - q1P || 1)) * 100}%` }} />
      </div>
    </div>
  );
}
