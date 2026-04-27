import { firefox } from 'playwright';
const b = await firefox.launch({headless:true});
const ctx = await b.newContext({viewport:{width:1440,height:900}});
const p = await ctx.newPage();
await p.goto('http://localhost:5173/',{waitUntil:'networkidle'});
await p.waitForTimeout(500);
await p.screenshot({path:'/tmp/dash.png'});
await b.close();
