// ============================================================
// 환경설정 화면 기획명세서용 Playwright 캡처 (OpsLayout 4탭)
//
// 실행:  node scripts/spec-capture-settings.cjs
// 전제:  배포 서버 http://10.10.45.185:3003 에서 구동 중
// 출력:  public/spec-captures/st-*.png
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
    // 1. 인스턴스 연결 탭
    console.log('\n[1] 인스턴스 연결');
    await page.goto(`${BASE}/ops/integration/instances`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1500);
    await page.screenshot({
      path: path.join(OUT_DIR, 'st-instances.png'),
      fullPage: true,
    });
    console.log('  -> st-instances.png');

    // 2. 인스턴스 추가/편집 대화상자
    console.log('\n[2] 인스턴스 편집 대화상자');
    const editBtn = await page.$('button:has(.lucide-settings)');
    if (editBtn) {
      await editBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, 'st-instance-dialog.png'),
        fullPage: false,
      });
      console.log('  -> st-instance-dialog.png');
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    } else {
      console.log('  SKIP: 편집 버튼 못 찾음');
    }

    // 3. 사용자/권한 탭
    console.log('\n[3] 사용자/권한');
    await page.goto(`${BASE}/ops/users`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    await page.screenshot({
      path: path.join(OUT_DIR, 'st-users.png'),
      fullPage: true,
    });
    console.log('  -> st-users.png');

    // 4. 그룹 관리 대화상자
    console.log('\n[4] 그룹 관리 대화상자');
    const groupBtn = await page.$('button:has-text("그룹 관리")');
    if (groupBtn) {
      await groupBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(OUT_DIR, 'st-group-dialog.png'),
        fullPage: false,
      });
      console.log('  -> st-group-dialog.png');
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    } else {
      console.log('  SKIP: 그룹 관리 버튼 못 찾음');
    }

    // 5. MaxGauge 연동 탭
    console.log('\n[5] MaxGauge 연동');
    await page.goto(`${BASE}/ops/integration/maxgauge`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    await page.screenshot({
      path: path.join(OUT_DIR, 'st-maxgauge.png'),
      fullPage: true,
    });
    console.log('  -> st-maxgauge.png');

    // 6. 예외 SQL 목록 탭
    console.log('\n[6] 예외 SQL 목록');
    await page.goto(`${BASE}/ops/integration/exceptions`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    await page.screenshot({
      path: path.join(OUT_DIR, 'st-exceptions.png'),
      fullPage: true,
    });
    console.log('  -> st-exceptions.png');

    // 7. 예외 해제 대화상자
    console.log('\n[7] 예외 해제 대화상자');
    const trashBtn = await page.$('button[title="예외 해제"]');
    if (trashBtn) {
      await trashBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, 'st-exception-dialog.png'),
        fullPage: false,
      });
      console.log('  -> st-exception-dialog.png');
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    } else {
      console.log('  SKIP: 해제 버튼 못 찾음');
    }

    // 결과 요약
    console.log('\n================================================');
    const files = fs.readdirSync(OUT_DIR).filter((f) => f.startsWith('st-'));
    console.log(`  환경설정 캡처 완료: 총 ${files.length}개`);
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
