// ============================================================
// 대시보드 화면 기획명세서용 Playwright 캡처
//
// 실행:  node scripts/spec-capture-dashboard.cjs
// 전제:  배포 서버 http://10.10.45.185:3003 에서 구동 중
// 출력:  public/spec-captures/db-*.png
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
    // 1. 대시보드 전체 (실행 중 상태)
    console.log('\n[1] 대시보드 전체 — 실행 중 상태');
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await settle(page, 1500);
    await page.screenshot({
      path: path.join(OUT_DIR, 'db-full-running.png'),
      fullPage: true,
    });
    console.log('  -> db-full-running.png');

    // 2. 상태 라인 영역만 크롭
    console.log('\n[2] 상태 라인 (StatusLine)');
    const statusLine = await page.$('.flex.items-center.gap-3.rounded-lg.border');
    if (statusLine) {
      await statusLine.screenshot({ path: path.join(OUT_DIR, 'db-statusline.png') });
      console.log('  -> db-statusline.png');
    } else {
      console.log('  SKIP: StatusLine 셀렉터 못 찾음');
    }

    // 3. AI 히어로 카드 (좌측)
    console.log('\n[3] AI 실행 상태 히어로');
    const heroCard = await page.$('.animate-ai-glow');
    if (heroCard) {
      await heroCard.screenshot({ path: path.join(OUT_DIR, 'db-ai-hero.png') });
      console.log('  -> db-ai-hero.png');
    } else {
      // fallback: 그리드 첫번째 자식
      const gridFirst = await page.$('.grid > :first-child');
      if (gridFirst) {
        await gridFirst.screenshot({ path: path.join(OUT_DIR, 'db-ai-hero.png') });
        console.log('  -> db-ai-hero.png (fallback)');
      } else {
        console.log('  SKIP: AI 히어로 셀렉터 못 찾음');
      }
    }

    // 4. 할 일 카드 영역 (우측)
    console.log('\n[4] 할 일 카드 (튜닝완료 + 반영대기)');
    const todoArea = await page.$('.grid > :nth-child(2)');
    if (todoArea) {
      await todoArea.screenshot({ path: path.join(OUT_DIR, 'db-todo-cards.png') });
      console.log('  -> db-todo-cards.png');
    } else {
      console.log('  SKIP: Todo 영역 못 찾음');
    }

    // 5. 대상 선정 바로가기 섹션
    console.log('\n[5] 대상 선정 바로가기');
    const shortcuts = await page.$('section');
    if (shortcuts) {
      await shortcuts.screenshot({ path: path.join(OUT_DIR, 'db-shortcuts.png') });
      console.log('  -> db-shortcuts.png');
    } else {
      console.log('  SKIP: 바로가기 섹션 못 찾음');
    }

    // 결과 요약
    console.log('\n================================================');
    const files = fs.readdirSync(OUT_DIR).filter((f) => f.startsWith('db-'));
    console.log(`  대시보드 캡처 완료: 총 ${files.length}개`);
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
