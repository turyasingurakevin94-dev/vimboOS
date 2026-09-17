/* Serves apps/console/dist exactly as vercel.json says: real files win,
   everything else gets index.html. Then loads a DEEP path and asserts the
   app boots — the case a relative base would have broken. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const ROOT = '/home/user/vimboos/apps/console/dist';
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
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let bad = 0;
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
