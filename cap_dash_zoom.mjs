import { firefox } from 'playwright';
const browser = await firefox.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const wait = ms => new Promise(r => setTimeout(r, ms));
await page.goto('http://10.10.45.185:3003/', { waitUntil: 'networkidle' });
await wait(1500);

// zoom into right column (todo cards)
await page.screenshot({
  path: '/tmp/zoom_todo_column.png',
  clip: { x: 900, y: 50, width: 1000, height: 600 },
});

// zoom into ai status (left)
await page.screenshot({
  path: '/tmp/zoom_ai_card.png',
  clip: { x: 230, y: 50, width: 700, height: 600 },
});

// zoom into status line strip (top)
await page.screenshot({
  path: '/tmp/zoom_status_line.png',
  clip: { x: 230, y: 40, width: 1000, height: 80 },
});

await browser.close();
console.log('done');
