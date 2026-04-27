import puppeteer from 'puppeteer'
const b = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
})
const p = await b.newPage()
await p.setViewport({width:1280,height:900})
await p.goto('http://10.10.45.185:3003/work',{waitUntil:'networkidle2'})
await new Promise(r=>setTimeout(r,1500))
await p.screenshot({path:'/tmp/cap_group_initial.png'})
// find 그룹 toggle button
const toggled = await p.evaluate(()=>{
  const el=[...document.querySelectorAll('button')].find(e=>/그룹/.test(e.textContent||''))
  if(el){el.click();return el.textContent.trim()}
  return null
})
console.log('toggle:',toggled)
await new Promise(r=>setTimeout(r,800))
await p.screenshot({path:'/tmp/cap_group_groupview.png'})
// click first row
const clicked = await p.evaluate(()=>{
  const r=document.querySelector('tbody tr')
  if(r){r.click();return r.textContent.slice(0,60)}
  return null
})
console.log('row:',clicked)
await new Promise(r=>setTimeout(r,800))
await p.screenshot({path:'/tmp/cap_group_expanded.png'})
const m=await p.evaluate(()=>{
  const tables=[...document.querySelectorAll('table')]
  return tables.map((t,i)=>({
    i,
    w:t.offsetWidth,scrollW:t.scrollWidth,
    parentW:t.parentElement?.offsetWidth,
    parentScrollW:t.parentElement?.scrollWidth,
    cols:(t.querySelector('thead tr')||t.querySelector('tbody tr'))?.children.length,
    hasOverflow:t.scrollWidth>t.parentElement?.offsetWidth,
  }))
})
console.log('tables:',JSON.stringify(m,null,2))
await b.close()
