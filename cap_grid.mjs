import { firefox } from 'playwright'
const browser = await firefox.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const page = await ctx.newPage()
const BASE = 'http://10.10.45.185:3003'
const wait = ms => new Promise(r => setTimeout(r, ms))

await page.goto(BASE, { waitUntil: 'networkidle' })
await wait(500)

// 1. WorkPipeline
console.log('1. WorkPipeline...')
await page.locator('text=튜닝안 검토').first().click()
await wait(1500)
await page.screenshot({ path: '/tmp/cap_grid_01_work.png' })

// 2. TopSql — click 대상 선정, then Top SQL
console.log('2. TopSql...')
await page.locator('text=대상 선정').first().click()
await wait(500)
await page.locator('text=Top SQL').first().click()
await wait(1500)
await page.screenshot({ path: '/tmp/cap_grid_02_topsql.png' })

// 3. AnomalyDetection — click Scatter View
console.log('3. AnomalyDetection...')
await page.locator('text=Scatter View').first().click()
await wait(1500)
await page.screenshot({ path: '/tmp/cap_grid_03_anomaly.png' })

console.log('Done!')
await browser.close()
