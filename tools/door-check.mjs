/**
 * The boot with no `?demo=1`.
 *
 * Every other harness here opens the app with `?demo=1`, which skips the
 * door, skips `resume()` and skips every query — so all of them were green
 * on the day the live path did not exist at all. This one boots the way the
 * shop will: it asks the database who is signed in, gets nobody, and must
 * land on a door that says which database it asked.
 *
 * It does NOT prove a query works. This sandbox cannot reach Supabase, so
 * the network error below is expected and the run says so rather than
 * pretending the link is fine. What it proves is that the app reaches a
 * readable screen instead of a white page when the database is unreachable
 * — which is the failure mode a person on a bad link actually meets.
 *
 *   node tools/door-check.mjs
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launchOptions = existsSync(SANDBOX_CHROME) ? { executablePath: SANDBOX_CHROME } : {};

/** Relative to this file, so a clean clone serves the clone's own build. */
const ROOT = new URL('../apps/console/dist/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain', '.svg': 'image/svg+xml' };

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(`no build at ${ROOT} — run \`pnpm build\` first`);
  process.exit(1);
}

const server = createServer(async (req, res) => {
  const path = normalize(decodeURI((req.url ?? '/').split('?')[0]));
  const file = path === '/' ? 'index.html' : path.slice(1);
  try {
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    // The console is one page; an unknown path is a route, not a 404.
    res.writeHead(200, { 'content-type': 'text/html' }).end(await readFile(join(ROOT, 'index.html')));
  }
});

await new Promise((resolve) => server.listen(0, resolve));
const origin = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(launchOptions);

/**
 * Whether a failed request was the app's own file or someone else's server.
 *
 * Classifying by message text would have been shorter and wrong: a build
 * that ships a missing chunk logs "Failed to load resource" too, and a rule
 * matching `net::ERR_` would file the one failure this harness exists to
 * catch under "expected". The ORIGIN decides. Anything served from here is
 * the build and must load; anything else — the database, Google's fonts —
 * is a link this sandbox does not have, and the app is supposed to survive
 * losing it. Both of those are exactly what a shop on a bad day gets.
 */
const ours = (url, origin) => url.startsWith(origin);

let bad = 0;
for (const [name, viewport] of [
  ['desktop-1440', { width: 1440, height: 900 }],
  ['phone-390', { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  let offline = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => {
    if (ours(r.url(), origin)) {
      errors.push(`${r.failure()?.errorText ?? 'request failed'} ${r.url()}`);
    } else {
      offline += 1;
    }
  });
  page.on('console', (m) => {
    // The browser logs its own line for a failed request; the handler above
    // already has that one, with a URL to judge it by.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) {
      errors.push(m.text());
    }
  });

  await page.goto(origin, { waitUntil: 'load' });
  // `resume()` has to lose its race with the network before the door shows.
  await page.getByRole('button', { name: 'Sign in' }).waitFor({ timeout: 15_000 }).catch(() => {});

  const door = await page.getByRole('button', { name: 'Sign in' }).count();
  const says = (await page.locator('body').innerText()).split('\n').filter(Boolean);
  const reading = says.find((l) => l.startsWith('Reading the')) ?? '(does not say which database)';
  if (door === 0 || errors.length > 0) bad += 1;
  console.log(
    `${name.padEnd(14)} door=${door > 0} ${reading.padEnd(34)} errors=${errors.length}` +
      (offline > 0 ? ` (+${offline} off-site, unreachable from this sandbox)` : ''),
  );
  for (const e of errors.slice(0, 5)) console.log('   ', e.slice(0, 200));
  await page.close();
}

await browser.close();
server.close();
process.exit(bad === 0 ? 0 : 1);
