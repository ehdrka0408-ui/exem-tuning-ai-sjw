import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('http://10.10.45.185:3003/work/WI-2024-052?context=all&from=%2Fwork', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// 전체 비교 버튼 클릭
const allBtn = await page.locator('button', { hasText: '전체 비교' }).first();
if (await allBtn.isVisible()) {
  await allBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/fullscreen_before_format.png', fullPage: false });
  console.log('Screenshot 1: before format saved');

  // Format 버튼 클릭
  const formatBtn = await page.locator('button', { hasText: 'Format' }).first();
  if (await formatBtn.isVisible()) {
    await formatBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/fullscreen_after_format.png', fullPage: false });
    console.log('Screenshot 2: after format saved');
    
    // 실행계획 영역 높이 확인
    const dims = await page.evaluate(() => {
      const allDivs = [...document.querySelectorAll('div')];
      const sqlLabel = allDivs.find(d => d.textContent?.trim() === 'SQL 비교');
      const planLabel = allDivs.find(d => d.textContent?.trim() === '실행계획 비교');
      const results = {};
      if (sqlLabel) {
        const parent = sqlLabel.closest('div[style]');
        if (parent) results.sqlWrapper = { height: parent.getBoundingClientRect().height, style: parent.getAttribute('style') };
      }
      if (planLabel) {
        const parent = planLabel.closest('div[style]');
        if (parent) results.planWrapper = { height: parent.getBoundingClientRect().height, style: parent.getAttribute('style') };
      }
      // Also get viewport info
      results.viewport = { width: window.innerWidth, height: window.innerHeight };
      return results;
    });
    console.log('Dimensions:', JSON.stringify(dims, null, 2));
  }
} else {
  console.log('전체 비교 button not found');
  await page.screenshot({ path: '/tmp/no_button.png', fullPage: false });
}

await browser.close();
