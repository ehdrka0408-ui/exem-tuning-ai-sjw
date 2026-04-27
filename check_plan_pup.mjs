import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });

await page.goto('http://10.10.45.185:3003/work/WI-2024-052?context=all&from=%2Fwork', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1500));

// 전체 비교 버튼 클릭
const [allBtn] = await page.$$('xpath/.//button[contains(text(), "전체 비교")]');
if (allBtn) {
  await allBtn.click();
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: '/tmp/fullscreen_before_format.png' });
  console.log('Screenshot 1: before format');

  // Format 버튼 클릭
  const buttons = await page.$$('button');
  let formatBtn = null;
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Format')) { formatBtn = btn; break; }
  }
  if (formatBtn) {
    await formatBtn.click();
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: '/tmp/fullscreen_after_format.png' });
    console.log('Screenshot 2: after format');

    // 영역 크기 확인
    const dims = await page.evaluate(() => {
      const allDivs = [...document.querySelectorAll('div[style]')];
      const sqlDiv = allDivs.find(d => d.getAttribute('style')?.includes('flex: 4'));
      const planDiv = allDivs.find(d => d.getAttribute('style')?.includes('flex: 6'));
      return {
        sql: sqlDiv ? { h: sqlDiv.getBoundingClientRect().height, oh: sqlDiv.offsetHeight } : null,
        plan: planDiv ? { h: planDiv.getBoundingClientRect().height, oh: planDiv.offsetHeight } : null,
      };
    });
    console.log('Dimensions:', JSON.stringify(dims, null, 2));
  }
} else {
  console.log('전체 비교 button NOT found');
  await page.screenshot({ path: '/tmp/no_button.png' });
}

await browser.close();
