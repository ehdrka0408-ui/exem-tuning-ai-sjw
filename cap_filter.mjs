import { firefox } from 'playwright';
const browser = await firefox.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
const BASE = 'http://localhost:5173';
const wait = ms => new Promise(r => setTimeout(r, ms));

console.log('1. Perf popover...');
await page.goto(`${BASE}/work`, { waitUntil: 'networkidle' });
await wait(800);
const perfChip = page.locator('button:has-text("성능 기준")');
if (await perfChip.count() > 0) {
  await perfChip.first().click();
  await wait(500);
}
await page.screenshot({ path: '/tmp/fix_01_perf.png' });

console.log('Done!');
await browser.close();
