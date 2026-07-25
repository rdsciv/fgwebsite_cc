// Screenshot every route into shots/ so UI defects get caught before review.
// Uses the Chrome already on the machine — no extra dependencies.
//
//   npm run build && npm run preview &   # serve dist/ on :4173
//   npm run shots                        # writes shots/<width>-<route>.png
//
// Tall viewports are deliberate: headless --screenshot captures the viewport
// only, so the window is sized to swallow a whole page in one frame.

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const CHROME =
  process.env.CHROME ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = resolve('shots');

const OWNER = '{F232E20A-A84E-45FB-97BE-BBFC3BFC10DA}'; // Ryan Childress

const ROUTES = [
  ['overview', '/'],
  ['all-time', '/standings'],
  ['scoreboard', '/scoreboard'],
  ['head-to-head', '/head-to-head'],
  ['records', '/records'],
  ['season-2025', '/seasons/2025'],
  ['season-2014', '/seasons/2014'], // pre-boxscore era — thinner data
  ['drafts', '/drafts'],
  ['roster-lab', '/roster-lab'],
  ['roto-standings', '/roto-standings'],
  ['trends', '/trends'],
  ['owner', `/owners/${encodeURIComponent(OWNER)}`],
];

// [label, width, height] — height is generous so full pages land in one frame
const VIEWPORTS = [
  ['desktop', 1440, 3400],
  ['mobile', 390, 3400],
];

const only = process.argv.slice(2);
const routes = only.length ? ROUTES.filter(([n]) => only.includes(n)) : ROUTES;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const [vp, w, h] of VIEWPORTS) {
  for (const [name, route] of routes) {
    const file = `${OUT}/${vp}-${name}.png`;
    execFileSync(
      CHROME,
      [
        '--headless',
        '--disable-gpu',
        '--hide-scrollbars',
        `--window-size=${w},${h}`,
        `--screenshot=${file}`,
        '--virtual-time-budget=9000',
        `${BASE}/#${route}`,
      ],
      { stdio: 'ignore' },
    );
    console.log(`${vp.padEnd(7)} ${name}`);
  }
}

console.log(`\n${routes.length * VIEWPORTS.length} shots → ${OUT}`);
