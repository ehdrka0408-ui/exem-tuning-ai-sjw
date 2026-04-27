import puppeteer from 'puppeteer'
const b = await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']})
const p = await b.newPage()
await p.setViewport({width:1720,height:1000})
await p.goto('http://10.10.45.185:3003/work',{waitUntil:'networkidle2'})
await new Promise(r=>setTimeout(r,1600))

// Click 튜닝중 chip
await p.evaluate(()=>{
  const btns=[...document.querySelectorAll('button')]
  const b=btns.find(x=>/^●?\s*튜닝중/.test(x.textContent?.trim()||'') && /\d/.test(x.textContent||''))
  b?.click()
})
await new Promise(r=>setTimeout(r,1200))

// Capture full page
await p.screenshot({path:'/tmp/cap_tuning_full.png', fullPage:false})

// Inspect rendered tr.tuning-row state
const info = await p.evaluate(()=>{
  const rows=[...document.querySelectorAll('tr.tuning-row')]
  return rows.map(r=>{
    const style=r.getAttribute('style')||''
    const cs=getComputedStyle(r)
    const before=getComputedStyle(r,'::before')
    const after=getComputedStyle(r,'::after')
    return {
      classes: r.className,
      inlineStyle: style,
      bg: cs.backgroundColor,
      position: cs.position,
      beforeContent: before.content,
      beforeBg: before.background.slice(0,80),
      beforeAnim: before.animationName + ' ' + before.animationDuration,
      afterContent: after.content,
      afterWidth: after.width,
      afterBg: after.background.slice(0,80),
      statusText: r.querySelector('td:nth-last-child(10)')?.textContent?.trim()||'',
    }
  })
})
console.log(JSON.stringify(info, null, 2))

// Crop just tuning rows area for a clean zoom-in
const rect = await p.evaluate(()=>{
  const r=document.querySelector('tr.tuning-row')
  if(!r) return null
  const b=r.getBoundingClientRect()
  return {x:Math.max(0,b.x-10), y:Math.max(0,b.y-40), w:Math.min(1720, b.width+20), h: 300}
})
if(rect){
  await p.screenshot({path:'/tmp/cap_tuning_zoom.png', clip:{x:rect.x,y:rect.y,width:rect.w,height:rect.h}})
}
await b.close()
