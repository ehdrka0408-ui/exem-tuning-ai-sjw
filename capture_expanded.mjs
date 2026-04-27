import { firefox } from 'playwright';
const browser = await firefox.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
const wait = ms => new Promise(r => setTimeout(r, ms));

await page.goto('http://localhost:5173/work?_=' + Date.now(), { waitUntil: 'networkidle' });
await wait(1500);

// 튜닝중(tuning) 행 찾기 — '튜닝중' 라벨이 있는 행 클릭
const found = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table tbody tr')];
  for (const row of rows) {
    const txt = row.textContent || '';
    if (txt.includes('튜닝중')) {
      row.scrollIntoView({ block: 'center' });
      return true;
    }
  }
  return false;
});
console.log('found tuning row:', found);

if (found) {
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('table tbody tr')];
    for (const row of rows) {
      if ((row.textContent || '').includes('튜닝중')) {
        row.click();
        break;
      }
    }
  });
} else {
  // 첫 행 클릭
  await page.locator('table tbody tr').first().click();
}
await wait(1500);
await page.screenshot({ path: '/tmp/expanded_01_slide.png' });

// F 키로 maximized 토글
await page.keyboard.press('f');
await wait(800);
await page.screenshot({ path: '/tmp/expanded_02_max.png', fullPage: false });

// 패널 내부만 캡처 (BOUND box of TuningInProgressCard)
const cardBox = await page.evaluate(() => {
  // .border-border 가진 카드 중 ProgressStepBar 있는 것
  const cards = [...document.querySelectorAll('div.rounded-lg.border')];
  for (const c of cards) {
    // expanded variant: w-[260px] 좌측 column 존재
    if (c.querySelector('.w-\\[260px\\]')) {
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }
  }
  return null;
});
console.log('card box:', cardBox);
if (cardBox) {
  const ts = Date.now();
  await page.screenshot({
    path: `/tmp/expanded_card_${ts}.png`,
    clip: { x: cardBox.x, y: cardBox.y, width: cardBox.w, height: cardBox.h },
  });
  console.log('saved:', `/tmp/expanded_card_${ts}.png`);

  // 좌측 progress bar 영역 줌인 캡처
  await page.screenshot({
    path: `/tmp/expanded_left_${ts}.png`,
    clip: { x: cardBox.x, y: cardBox.y, width: 320, height: cardBox.h },
  });
  console.log('saved:', `/tmp/expanded_left_${ts}.png`);
}

console.log('Done');
await browser.close();
