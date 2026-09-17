/**
 * Look at a screen. Both designs, real widths, page errors surfaced.
 *
 * "You cannot judge a screen you have not looked at" — and a screen that
 * renders correctly but throws in the console is not correct. This fails
 * loudly on a page error rather than handing back a pretty screenshot of a
 * broken app.
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
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


const ROOT = new URL('../apps/console/dist/', import.meta.url).pathname;
const OUT = process.argv[2] ?? '/tmp/shots';
/** Which screen to shoot. Clicked by its visible name in the rail / tab bar. */
const SECTION = process.argv[3] ?? null;
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURI((req.url ?? '/').split('?')[0]));
  const file = path === '/' ? 'index.html' : path.slice(1);
  try {
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(launchOptions);

const VIEWS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1280', width: 1280, height: 850 },
  { name: 'phone-390',    width: 390,  height: 844 },
  { name: 'phone-390-full', width: 390, height: 844, full: true },
];

let failed = false;
for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    const t = m.text();
    const network = /ERR_CERT_AUTHORITY_INVALID|Failed to load resource/.test(t);
    if (m.type() === 'error' && !network) errors.push(t);
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  if (SECTION !== null) {
    // Not exact: a rail row's accessible name carries its count too.
    const tab = page.getByRole('button', { name: SECTION }).first();
    if ((await tab.count()) === 0) {
      console.log(`${v.name.padEnd(16)} SKIPPED — no "${SECTION}" in this design`);
      await ctx.close();
      continue;
    }
    await tab.click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: join(OUT, `${SECTION === null ? '' : SECTION.toLowerCase() + '-'}${v.name}.png`), fullPage: v.full === true });

  const design = await page.evaluate(() => {
    if (document.querySelector('nav[aria-label="Sections"] + header')) return 'desktop';
    return matchMedia('(min-width: 900px)').matches ? 'desktop' : 'phone';
  });
  console.log(`${v.name.padEnd(14)} design=${design.padEnd(8)} errors=${errors.length}`);
  if (errors.length) { failed = true; errors.forEach((e) => console.log('   !', e)); }
  await ctx.close();
}

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
