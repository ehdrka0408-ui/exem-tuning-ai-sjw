import { firefox } from 'playwright';
const browser = await firefox.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
const BASE = 'http://localhost:5173';
const wait = ms => new Promise(r => setTimeout(r, ms));

// 1. WorkPipeline
console.log('1. WorkPipeline...');
await page.goto(`${BASE}/work`, { waitUntil: 'networkidle' });
await wait(800);
await page.screenshot({ path: '/tmp/r2_01_pipeline.png' });

// 2. SlidePanel
console.log('2. SlidePanel...');
await page.locator('table tbody tr').first().click();
await wait(1500);
await page.screenshot({ path: '/tmp/r2_02_panel_top.png' });

// 3. 패널 스크롤 다운
console.log('3. Panel scrolled...');
await page.evaluate(() => {
  const scrollables = document.querySelectorAll('[class*="overflow"]');
  for (const el of scrollables) {
    if (el.scrollHeight > el.clientHeight && el.clientHeight > 200) {
      el.scrollTo(0, el.scrollHeight);
      break;
    }
  }
});
await wait(800);
await page.screenshot({ path: '/tmp/r2_03_panel_bottom.png' });

// 4. 전체 비교 모달
console.log('4. FullCompare...');
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const btn = btns.find(b => b.textContent?.includes('전체 비교'));
  if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); }
});
await wait(1500);
await page.screenshot({ path: '/tmp/r2_04_fullcompare.png' });
await page.keyboard.press('Escape');
await wait(500);

// 5. Full page WorkDetail
console.log('5. WorkDetail full page...');
await page.goto(`${BASE}/work/WI-2024-004`, { waitUntil: 'networkidle' });
await wait(1500);
await page.screenshot({ path: '/tmp/r2_05_detail_top.png' });

// 스크롤다운
await page.evaluate(() => window.scrollTo(0, 500));
await wait(500);
await page.screenshot({ path: '/tmp/r2_06_detail_mid.png' });

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await wait(500);
await page.screenshot({ path: '/tmp/r2_07_detail_bottom.png' });

console.log('Done!');
await browser.close();
