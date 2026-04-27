import { firefox } from 'playwright';
const browser = await firefox.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
const BASE = 'http://10.10.45.185:3003';
const wait = ms => new Promise(r => setTimeout(r, ms));

console.log('1. WorkPipeline (작업함)...');
await page.goto(`${BASE}/work`, { waitUntil: 'networkidle' });
await wait(1500);
await page.screenshot({ path: '/tmp/check_01_pipeline_full.png', fullPage: false });

// Zoom into table area
const tableArea = await page.locator('table').first().boundingBox();
if (tableArea) {
  await page.screenshot({
    path: '/tmp/check_02_table_only.png',
    clip: {
      x: Math.max(0, tableArea.x - 20),
      y: Math.max(0, tableArea.y - 60),
      width: Math.min(1920, tableArea.width + 40),
      height: Math.min(700, tableArea.height + 80),
    },
  });
}

// Sidebar zoom
await page.screenshot({
  path: '/tmp/check_03_sidebar.png',
  clip: { x: 0, y: 0, width: 230, height: 400 },
});

// Dashboard
console.log('2. Dashboard...');
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await wait(1200);
await page.screenshot({ path: '/tmp/check_04_dashboard.png', fullPage: false });

console.log('Done.');
await browser.close();
