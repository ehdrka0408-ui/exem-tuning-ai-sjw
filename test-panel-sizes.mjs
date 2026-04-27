import { chromium } from 'playwright';

const URL = 'http://10.10.45.185:3003/work';
const WIDTHS = [500, 600, 700, 800, 900, 1000];

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click first tuned item row to open slide panel
  const rows = page.locator('tr.cursor-pointer');
  const rowCount = await rows.count();
  console.log(`Found ${rowCount} clickable rows`);

  // Find a tuned item
  let clicked = false;
  for (let i = 0; i < rowCount; i++) {
    const text = await rows.nth(i).textContent();
    if (text.includes('튜닝완료')) {
      await rows.nth(i).click();
      clicked = true;
      console.log(`Clicked row ${i}: tuned item`);
      break;
    }
  }

  if (!clicked) {
    // Just click first row
    await rows.first().click();
    console.log('Clicked first row');
  }

  await page.waitForTimeout(500);

  // Now capture at different panel widths by resizing the panel drag handle
  // The panel opens at 40% = ~768px on 1920 viewport
  // We'll use page.evaluate to directly set panel width and capture

  for (const w of WIDTHS) {
    // Set panel width via DOM manipulation
    await page.evaluate((width) => {
      const panel = document.querySelector('.fixed.inset-y-0.right-0.z-50');
      if (panel) {
        panel.style.width = width + 'px';
        // Trigger resize observer
        window.dispatchEvent(new Event('resize'));
      }
    }, w);

    await page.waitForTimeout(600); // Wait for ResizeObserver + re-render

    await page.screenshot({
      path: `panel-${w}px.png`,
      fullPage: false,
    });
    console.log(`Captured panel at ${w}px`);
  }

  await browser.close();
  console.log('Done!');
})();
