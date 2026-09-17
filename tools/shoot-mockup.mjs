import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const ROOT = process.argv[2];
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const server = createServer(async (req,res)=>{
  const p = normalize(decodeURI((req.url??'/').split('?')[0]));
  const file = p === '/' ? 'Dashboard.dc.html' : p.slice(1);
  try { const b = await readFile(join(ROOT, file));
    res.writeHead(200,{'content-type':T[extname(file)]??'text/plain'}); res.end(b);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise(r=>server.listen(0,r));
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport:{width:1560,height:1000}, deviceScaleFactor:2 });
const pg = await ctx.newPage();
await pg.goto(`http://127.0.0.1:${server.address().port}/`, {waitUntil:'domcontentloaded', timeout:15000});
await pg.waitForTimeout(2500);
const el = await pg.$('#\\32 a');
if (el) { await el.screenshot({ path: join(process.argv[3], 'MOCKUP-desktop.png') }); console.log('captured 2a'); }
else { console.log('could not find #2a; full page instead'); await pg.screenshot({path: join(process.argv[3],'MOCKUP-desktop.png'), fullPage:true}); }
const el2 = await pg.$('#\\32 b');
if (el2) { await el2.screenshot({ path: join(process.argv[3], 'MOCKUP-phone.png') }); console.log('captured 2b'); }
await b.close(); server.close();
