import puppeteer from 'puppeteer'
const b = await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']})
const p = await b.newPage()
await p.setViewport({width:1600,height:900})
await p.goto('http://10.10.45.185:3003/work',{waitUntil:'networkidle2'})
await new Promise(r=>setTimeout(r,1500))
// click 튜닝중 chip
await p.evaluate(()=>{
  const btns=[...document.querySelectorAll('button')]
  const b=btns.find(x=>/^●?\s*튜닝중/.test(x.textContent?.trim()||'') && /\d/.test(x.textContent||''))
  b?.click()
})
await new Promise(r=>setTimeout(r,1200))
await p.screenshot({path:'/tmp/cap_gauge_tuning.png'})
// wait and capture again to show progress animation
await new Promise(r=>setTimeout(r,3500))
await p.screenshot({path:'/tmp/cap_gauge_tuning2.png'})
const info = await p.evaluate(()=>{
  const rows=[...document.querySelectorAll('tbody tr')]
  return rows.map(r=>{
    const t=r.querySelector('[title*="진행률"]')
    return t?.getAttribute('title')
  }).filter(Boolean)
})
console.log('progress:',JSON.stringify(info))
await b.close()
