// ============================================================
// 작업상세 화면 기획명세서용 Playwright 캡처
//
// 실행:  node scripts/spec-capture-taskdetail.cjs
// 전제:  dev server (vite) http://localhost:3004 에서 구동 중
// 출력:  public/spec-captures/td-*.png
// ============================================================

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.EXEM_BASE || 'http://localhost:3004';
const OUT_DIR = path.resolve(__dirname, '../public/spec-captures');
const VIEWPORT = { width: 1440, height: 900 };

// 대상 4종 workId (memory: reference_exem_capture_sqlids)
const FULLPAGE = [
  { name: 'td-fp-pending',         workId: 'WI-2026-T03', sqlId: 't01_sql_003',     state: 'pending' },
  { name: 'td-fp-tuning',          workId: 'WI-2024-016', sqlId: 'b1c2d3e4f5g6h',   state: 'tuning' },
  { name: 'td-fp-approval-single', workId: 'WI-2024-025', sqlId: 'ss9tt0uu1',       state: 'approval_pending (단일안)' },
  { name: 'td-fp-approval-multi',  workId: 'WI-2024-021', sqlId: 'gg7hh8ii9',       state: 'approval_pending (복수안)' },
];

async function settle(page, ms = 800) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

async function captureFullpage(page, { name, workId, sqlId, state }) {
  const url = `${BASE}/work/${workId}`;
  console.log(`\n[fullpage] ${name}  ${state}  ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await settle(page, 1200);

  const out = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: out, fullPage: true });
  const size = fs.statSync(out).size;
  console.log(`  -> ${out}  (${(size / 1024).toFixed(1)} KB)`);
}

async function captureModal(page, { name, triggerSelector, waitSelector, description }) {
  console.log(`\n[modal] ${name}  (${description})`);
  try {
    await page.waitForSelector(triggerSelector, { timeout: 3000 });
    await page.click(triggerSelector);
    if (waitSelector) {
      await page.waitForSelector(waitSelector, { timeout: 3000 });
    }
    await page.waitForTimeout(400);

    const out = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: out, fullPage: false });
    console.log(`  -> ${out}`);

    // ESC로 닫기
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  } catch (e) {
    console.log(`  SKIP: ${e.message.split('\n')[0]}`);
  }
}

async function captureSlidePanel(page) {
  console.log('\n[slidepanel] 목록 → 행 클릭 → narrow');
  await page.goto(`${BASE}/work`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1000);

  // 단일안 행 클릭 (ss9tt0uu1 = WI-2024-025)
  const rowSelectors = [
    'tbody tr',
    '[role="row"]',
    'table tr:nth-child(2)',
  ];
  let clicked = false;
  for (const sel of rowSelectors) {
    try {
      await page.click(sel, { timeout: 1500 });
      clicked = true;
      console.log(`  clicked: ${sel}`);
      break;
    } catch {}
  }
  if (!clicked) {
    console.log('  SKIP: 행 찾기 실패');
    return;
  }
  await settle(page, 800);

  const narrow = path.join(OUT_DIR, 'td-sp-narrow.png');
  await page.screenshot({ path: narrow, fullPage: false });
  console.log(`  -> ${narrow}`);

  // 펼치기 버튼 시도
  const expandSelectors = [
    'button[aria-label*="펼치"]',
    'button[title*="펼치"]',
    'button[aria-label*="expand" i]',
    'button:has-text("전체 보기")',
  ];
  for (const sel of expandSelectors) {
    try {
      await page.click(sel, { timeout: 1500 });
      await settle(page, 600);
      const exp = path.join(OUT_DIR, 'td-sp-expanded.png');
      await page.screenshot({ path: exp, fullPage: false });
      console.log(`  -> ${exp}`);
      break;
    } catch {}
  }
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.log('  [pageerror]', err.message));

  try {
    // 1. Fullpage 4종
    for (const cap of FULLPAGE) {
      await captureFullpage(page, cap);
    }

    // 2. 모달 — approval_pending 단일안 기준
    await page.goto(`${BASE}/work/WI-2024-025`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);

    await captureModal(page, {
      name: 'td-md-confirm',
      triggerSelector: 'button:has-text("확인")',
      waitSelector: 'text=/확인 처리하시겠|확인하시겠/',
      description: '확인 대화상자',
    });

    await page.goto(`${BASE}/work/WI-2024-025`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    await captureModal(page, {
      name: 'td-md-reject',
      triggerSelector: 'button:has-text("반려")',
      waitSelector: 'textarea',
      description: '반려 사유 모달',
    });

    await page.goto(`${BASE}/work/WI-2024-025`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    await captureModal(page, {
      name: 'td-md-retune',
      triggerSelector: 'button:has-text("재튜닝")',
      waitSelector: 'input[type="checkbox"]',
      description: '재튜닝 요청 모달',
    });

    // 3. 전체화면 비교 (단일안 기준)
    await page.goto(`${BASE}/work/WI-2024-025`, { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    await captureModal(page, {
      name: 'td-ix-fullscreen-all',
      triggerSelector: 'button:has-text("전체 비교")',
      waitSelector: '.fixed',
      description: 'SQL+Plan 통합 전체화면',
    });

    // 4. 슬라이드 패널 (narrow/expanded)
    await captureSlidePanel(page);

    console.log('\n================================================');
    console.log('  캡처 완료');
    const files = fs.readdirSync(OUT_DIR).filter((f) => f.startsWith('td-'));
    console.log(`  총 ${files.length}개:`);
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
