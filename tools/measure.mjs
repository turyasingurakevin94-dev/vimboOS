import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const ROOT = new URL('../apps/console/dist/', import.meta.url).pathname;
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const server = createServer(async (req,res)=>{
  const p = normalize(decodeURI((req.url??'/').split('?')[0]));
  const file = p==='/'?'index.html':p.slice(1);
  try { const b = await readFile(join(ROOT, file));
    res.writeHead(200,{'content-type':T[extname(file)]??'text/plain'}); res.end(b);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r=>server.listen(0,r));
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await pg.goto(`http://127.0.0.1:${server.address().port}/`, {waitUntil:'networkidle'});
await pg.waitForTimeout(500);
pg.on('pageerror', e => console.log('PAGEERROR', String(e)));
pg.on('response', r => { if (!r.ok()) console.log('HTTP', r.status(), r.url()); });
console.log('ROOT =', ROOT);
console.log(await pg.evaluate(() => {
  const main = document.querySelector('main, [class*="main"]');
  const first = main?.firstElementChild;
  const cs = first ? getComputedStyle(first) : null;
  const h1 = document.querySelector('h1');
  return {
    firstChildClass: first?.className || '(none)',
    firstChildPadding: cs?.padding,
    firstChildOverflowY: cs?.overflowY,
    h1Left: h1?.getBoundingClientRect().left,
    railWidth: document.querySelector('nav')?.getBoundingClientRect().width,
    bodyHTML: document.body.innerHTML.slice(0, 200),
  };
}));
await b.close(); server.close();
