import { firefox } from 'playwright';

const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// 작업함
await page.goto('http://10.10.45.185:3003/work', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/work-pipeline.png', fullPage: true });
console.log('1. work-pipeline.png');

// 작업상세 - 첫번째 행 클릭
const firstRow = page.locator('table tbody tr').first();
await firstRow.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/work-detail.png' });
console.log('2. work-detail.png');

await browser.close();
