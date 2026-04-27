import puppeteer from 'puppeteer';
const b = await puppeteer.launch({headless:'new'});
const p = await b.newPage();
await p.setViewport({width:1440,height:900});
await p.goto('http://localhost:5173/',{waitUntil:'networkidle0'});
await p.screenshot({path:'/tmp/dash.png'});
await b.close();
