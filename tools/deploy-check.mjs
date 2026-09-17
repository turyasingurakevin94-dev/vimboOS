/* Serves apps/console/dist exactly as vercel.json says: real files win,
   everything else gets index.html. Then loads a DEEP path and asserts the
   app boots — the case a relative base would have broken. */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

/**
 * This sandbox pre-installs Chromium at a fixed path and blocks the download;
 * CI installs it wherever Playwright's own cache lives. Name the sandbox path
 * only when it is actually there, and otherwise let Playwright resolve it —
 * a hardcoded path is green here and fails on the first CI run.
 */
const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launchOptions = existsSync(SANDBOX_CHROME)
  ? { executablePath: SANDBOX_CHROME }
  : {};

/**
 * Relative to this file, NOT an absolute path to one machine's checkout.
 *
 * It WAS absolute, and that is worse than a crash: run from any other clone
 * — CI, a fresh checkout, a verification that the thing about to deploy is
 * sound — it silently served a different `dist` and reported green about a
 * build it never opened.
 */
const ROOT = new URL('../apps/console/dist/', import.meta.url).pathname;
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const server = createServer(async (req, res) => {
  const p = normalize(decodeURI((req.url ?? '/').split('?')[0]));
  let file = p === '/' ? 'index.html' : p.slice(1);
  try { await readFile(join(ROOT, file)); }
  catch { file = 'index.html'; }          // the rewrite
  const body = await readFile(join(ROOT, file));
  res.writeHead(200, { 'content-type': T[extname(file)] ?? 'text/plain' });
  res.end(body);
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const b = await chromium.launch(launchOptions);
let bad = 0;

/**
 * The deployed page has to say which repository and commit built it.
 *
 * Without this, "the live site is not loading the new edits" can only be
 * argued from screenshots — and it once turned out that the domain was
 * serving a DIFFERENT repository's app, close enough to look like a stale
 * deploy. `/build.txt` settles it in one request.
 */
const stampRes = await fetch(base + '/build.txt');
const stamp = (await stampRes.text()).trim();
const expected = `${process.env.VERCEL_GIT_COMMIT_SHA ?? ''}`.slice(0, 7);
if (!stampRes.ok || !/^[^@\s]+@[0-9a-f]{7}/.test(stamp)) {
  console.log(`build stamp               MISSING — /build.txt was ${stampRes.status}: ${stamp.slice(0, 80)}`);
  bad += 1;
} else if (expected !== '' && !stamp.includes(`@${expected}`)) {
  console.log(`build stamp               WRONG COMMIT — served ${stamp}, building ${expected}`);
  bad += 1;
} else {
  console.log(`build stamp               ${stamp}`);
}
for (const path of ['/', '/customers', '/orders/OW-2291/lines']) {
  const ctx = await b.newContext({ viewport:{width:1440,height:900} });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e).slice(0,100)));
  pg.on('response', r => { if (!r.ok()) errs.push(`${r.status()} ${r.url().replace(base,'')}`); });
  await pg.goto(base + path, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(400);
  const booted = await pg.evaluate(() => !!document.querySelector('h1'));
  const railed = await pg.evaluate(() => !!document.querySelector('nav'));
  console.log(`${path.padEnd(28)} booted=${booted} rail=${railed} problems=${errs.length}` + (errs.length ? '\n   ' + errs.join('\n   ') : ''));
  if (!booted || !railed || errs.length) bad++;
  await ctx.close();
}
await b.close(); server.close();
process.exit(bad ? 1 : 0);
