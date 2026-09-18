/**
 * Look at a screen on the shop's OWN books.
 *
 * `shoot.mjs` runs every screen on example data, which is the right default
 * — it needs no credentials and it is the same picture on every machine.
 * But three bugs on Today and four on the board existed ONLY against
 * production: a total that used the wrong lens, a badge drawn for zero, a
 * lane holding a month where it is drawn for a day, a dock saying `Nothing
 * to fetch` beside a card saying two lines are outstanding. None of them
 * could be seen in the example data, because the example data was written
 * by somebody who already knew what the screen was for.
 *
 * It serves `apps/console/dist` and signs in as a real user, so build first,
 * and build with the target you mean to look at:
 *
 *     VITE_OW_TARGET=production VITE_OW_SUPABASE_KEY=… pnpm build
 *     OW_EMAIL=… OW_PASSWORD=… node tools/live-peek.mjs "Order tracking" out.png
 *
 * **It reads.** Nothing here presses a control that writes, and the account
 * it signs in as should be one that cannot — the books it is looking at are
 * a business's real books, not a fixture.
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = new URL('../apps/console/dist/', import.meta.url).pathname;
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
};

const server = createServer(async (req, res) => {
  let path = (req.url ?? '/').split('?')[0];
  if (path === '/' || extname(path) === '') path = '/index.html';
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;

const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
/**
 * This sandbox reaches the network through a proxy that re-signs TLS. The CA
 * is pinned by the key hash the proxy publishes rather than by turning
 * verification off — a peek at the real books is not worth a habit of
 * accepting any certificate at all.
 */
const PROXY_CA_SPKI = process.env.OW_PROXY_CA_SPKI ?? '';
const launchOptions = {
  ...(existsSync(SANDBOX_CHROME) ? { executablePath: SANDBOX_CHROME } : {}),
  ...(PROXY_CA_SPKI === ''
    ? {}
    : { args: [`--ignore-certificate-errors-spki-list=${PROXY_CA_SPKI}`] }),
};

const browser = await chromium.launch(launchOptions);
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 950 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(500);
await page.fill('#ow-email', process.env.OW_EMAIL ?? '');
await page.fill('#ow-password', process.env.OW_PASSWORD ?? '');
await page.click('button[type=submit]');
await page.waitForTimeout(4000);

const row = process.argv[2];
if (row !== undefined) {
  const tab = page.getByRole('button', { name: new RegExp(`^${row}`) });
  if ((await tab.count()) === 0) console.log(`--- no rail row "${row}" ---`);
  else {
    await tab.first().click();
    await page.waitForTimeout(3500);
  }
}

console.log(await page.locator('body').innerText());
console.log(`PAGE ERRORS ${errors.length}`, errors.slice(0, 3));
if (process.argv[3] !== undefined) await page.screenshot({ path: process.argv[3] });

await browser.close();
server.close();
