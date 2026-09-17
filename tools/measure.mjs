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
await pg.waitForTimeout(400);
const got = await pg.evaluate(() => {
  const r = (sel) => document.querySelector(sel)?.getBoundingClientRect();
  const cs = (sel, prop) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[prop] : null; };
  const nav = r('nav');
  const bar = document.querySelector('header');
  const h1 = document.querySelector('h1');
  const cards = document.querySelectorAll('section[aria-label="The position"] > div');
  return {
    railWidth: nav?.width,
    topBarHeight: bar?.getBoundingClientRect().height,
    pageTitleSize: h1 ? getComputedStyle(h1).fontSize : null,
    pageTitleWeight: h1 ? getComputedStyle(h1).fontWeight : null,
    metricCards: cards.length,
    metricRadius: cards[0] ? getComputedStyle(cards[0]).borderRadius : null,
    metricPadding: cards[0] ? getComputedStyle(cards[0]).padding : null,
    bodyFont: getComputedStyle(document.body).fontFamily.split(',')[0],
    bodyBg: getComputedStyle(document.body).backgroundColor,
    primaryBtnBg: cs('button[class*="btnPrimary"]', 'backgroundColor'),
  };
});
console.log(JSON.stringify(got, null, 2));
await b.close(); server.close();
