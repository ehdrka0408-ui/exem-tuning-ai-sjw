// ============================================================
// 알림 드롭다운 기획명세서용 Playwright 캡처
//
// 실행:  node scripts/spec-capture-notification.cjs
// 전제:  배포 서버 http://10.10.45.185:3003 에서 구동 중
// 출력:  public/spec-captures/nf-*.png
// ============================================================

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.EXEM_BASE || 'http://10.10.45.185:3003';
const OUT_DIR = path.resolve(__dirname, '../public/spec-captures');
const VIEWPORT = { width: 1440, height: 900 };

async function settle(page, ms = 800) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.log('  [pageerror]', err.message));

  try {
    // 1. 알림 벨 아이콘 (뱃지 포함) — 닫힌 상태
    console.log('\n[1] 알림 벨 아이콘 (닫힌 상태)');
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await settle(page, 1500);

    // TopBar 우측 영역 캡처
    const bellBtn = await page.$('button[aria-label="알림"]');
    if (bellBtn) {
      // 벨 아이콘 주변 영역 스크린샷
      await page.screenshot({
        path: path.join(OUT_DIR, 'nf-topbar-bell.png'),
        fullPage: false,
        clip: { x: 1200, y: 0, width: 240, height: 50 },
      });
      console.log('  -> nf-topbar-bell.png');
    }

    // 2. 알림 드롭다운 열린 상태
    console.log('\n[2] 알림 드롭다운 — 전체');
    if (bellBtn) {
      await bellBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(OUT_DIR, 'nf-dropdown-open.png'),
        fullPage: false,
      });
      console.log('  -> nf-dropdown-open.png');
    }

    // 3. 중지 확인 대화상자 — running_start 카드의 중지 버튼 클릭
    console.log('\n[3] 중지 확인 대화상자');
    const stopBtn = await page.$('button:has-text("중지")');
    if (stopBtn) {
      await stopBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, 'nf-stop-dialog.png'),
        fullPage: false,
      });
      console.log('  -> nf-stop-dialog.png');
      // ESC로 닫기
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    } else {
      console.log('  SKIP: 중지 버튼 못 찾음');
    }

    // 결과 요약
    console.log('\n================================================');
    const files = fs.readdirSync(OUT_DIR).filter((f) => f.startsWith('nf-'));
    console.log(`  알림 캡처 완료: 총 ${files.length}개`);
    files.sort().forEach((f) => {
      const s = fs.statSync(path.join(OUT_DIR, f)).size;
      console.log(`    ${f}  ${(s / 1024).toFixed(1)} KB`);
    });
    console.log('================================================');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
