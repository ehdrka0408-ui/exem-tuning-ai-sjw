import { firefox } from 'playwright';
const browser = await firefox.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
const wait = ms => new Promise(r => setTimeout(r, ms));

await page.goto('http://localhost:5173/work?_=' + Date.now(), { waitUntil: 'networkidle' });
await wait(1500);

await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table tbody tr')];
  for (const row of rows) {
    if ((row.textContent || '').includes('튜닝중')) { row.click(); break; }
  }
});
await wait(1500);
await page.keyboard.press('f');
await wait(1000);

// 모든 row + 노드 + connector rect 측정
const info = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('div.rounded-lg.border')];
  for (const c of cards) {
    if (c.querySelector('.w-\\[260px\\]')) {
      const psb = c.querySelector('.flex.flex-col.w-full');
      const rows = [...psb.querySelectorAll(':scope > div')];
      return rows.map((row, i) => {
        const nodeCol = row.querySelector(':scope > div');
        const node = nodeCol.querySelector('span');
        const connector = nodeCol.querySelector('div');
        const nr = node.getBoundingClientRect();
        const rr = row.getBoundingClientRect();
        const cr = connector?.getBoundingClientRect();
        return {
          i,
          rowTop: rr.top, rowBottom: rr.bottom, rowH: rr.height,
          nodeTop: nr.top, nodeBottom: nr.bottom,
          connectorTop: cr?.top, connectorBottom: cr?.bottom, connectorH: cr?.height,
        };
      });
    }
  }
  return null;
});
console.log(JSON.stringify(info, null, 2));

await browser.close();
