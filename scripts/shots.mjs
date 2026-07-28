// Screenshot every route into shots/ so UI defects get caught before review.
// Uses the Chrome already on the machine, driven over the DevTools Protocol —
// no extra dependencies (Node's WebSocket is built in).
//
//   npm run build && npm run preview &   # serve dist/ on :4173
//   npm run shots                        # writes shots/<width>-<route>.png
//
// Requires Node 22+ for the global WebSocket. Node 20 has it only behind
// --experimental-websocket, so the preflight below fails loudly there rather
// than letting connect()'s retry loop swallow a ReferenceError and blame Chrome.
//
// Why CDP and not `--headless --screenshot`: Chrome refuses to size a window
// below ~490 CSS px, so a `--window-size=390` run silently renders at 490 and
// crops the PNG to 390. Every "mobile" shot taken that way shows a desktop
// layout with its right edge cut off, which reads exactly like a layout bug.
// Emulation.setDeviceMetricsOverride sets a true viewport at any width, and
// captureBeyondViewport grabs the full page without faking a tall window.

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const CHROME =
  process.env.CHROME ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = resolve('shots');
const PORT = Number(process.env.CDP_PORT ?? 9333);

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

// [label, cssWidth, mobile] — height is nominal; full page is captured regardless
const VIEWPORTS = [
  ['desktop', 1440, false],
  ['mobile', 390, true],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((ok, err) => {
          ws.addEventListener('open', ok, { once: true });
          ws.addEventListener('error', err, { once: true });
        });
        return new CDP(ws);
      }
    } catch {
      /* chrome not up yet */
    }
    await sleep(200);
  }
  throw new Error(`Could not reach Chrome on :${PORT}`);
}

const only = process.argv.slice(2);
const routes = only.length ? ROUTES.filter(([n]) => only.includes(n)) : ROUTES;

// Preflight. Every prerequisite is checked BEFORE shots/ is wiped, so a missing one never costs
// you the previous run's screenshots and leaves nothing behind to compare against.
const die = (msg) => {
  console.error(`shots: ${msg}`);
  process.exit(1);
};

if (typeof WebSocket === 'undefined') {
  die(`needs a global WebSocket — Node 22+ (running ${process.version}).\n` +
      `       On Node 20, re-run as: node --experimental-websocket scripts/shots.mjs`);
}
if (!existsSync(CHROME)) {
  die(`Chrome not found at ${CHROME}\n       Set CHROME=/path/to/chrome to override.`);
}
if (!routes.length) {
  die(`no routes matched ${JSON.stringify(only)}\n       Known: ${ROUTES.map(([n]) => n).join(', ')}`);
}
try {
  await fetch(BASE, { signal: AbortSignal.timeout(3000) });
} catch {
  die(`nothing serving ${BASE}\n       Start it with: npm run build && npm run preview`);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const profile = `${tmpdir()}/affl-shots-${process.pid}`;
const chrome = execFile(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  'about:blank',
]);

let cdp;
try {
  cdp = await connect();
  await cdp.send('Page.enable');

  for (const [vp, width, mobile] of VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile,
    });

    for (const [name, route] of routes) {
      // A hash-only change does not reload the SPA, so reset between routes.
      await cdp.send('Page.navigate', { url: 'about:blank' });
      await sleep(120);
      await cdp.send('Page.navigate', { url: `${BASE}/#${route}` });
      await sleep(2600); // data fetch + chart layout

      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
      });
      writeFileSync(`${OUT}/${vp}-${name}.png`, Buffer.from(data, 'base64'));
      console.log(`${vp.padEnd(7)} ${name}`);
    }
  }
} finally {
  cdp?.ws.close();
  chrome.kill();
  await sleep(300); // let Chrome release its profile lock before removing it
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* temp dir; the OS will reap it */
  }
}

console.log(`\n${routes.length * VIEWPORTS.length} shots → ${OUT}`);
