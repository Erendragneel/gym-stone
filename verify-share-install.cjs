const {chromium}=require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const URL='https://erendragneel.github.io/gym-stone/';
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(()=>document.querySelectorAll('.exercise-card').length>140);
  await page.getByRole('button',{name:'Share Game'}).click();
  assert.equal(await page.locator('#share-url').inputValue(),URL);
  const qr=await page.evaluate(()=>{const c=document.getElementById('share-qr'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {w:c.width,h:c.height,dark:[...d].some((v,i)=>i%4===0&&v<20)}});
  assert(qr.w>200&&qr.w===qr.h&&qr.dark);
  await page.getByRole('button',{name:'Copy Link',exact:true}).click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),URL);
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download QR',exact:true}).click();
  const download=await downloaded;assert.equal(download.suggestedFilename(),'gym-stone-qr.png');await download.saveAs('share-qr-review.png');
  await page.evaluate(()=>{window.shared=null;Object.defineProperty(navigator,'share',{configurable:true,value:async data=>window.shared=data});});
  await page.getByRole('button',{name:'Share',exact:true}).click();assert.equal(await page.evaluate(()=>window.shared.url),URL);
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('cancelled','AbortError')}}));
  await page.getByRole('button',{name:'Share',exact:true}).click();assert.match(await page.locator('#share-status').textContent(),/cancelled/);
  await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async()=>{throw Error('denied')}});document.execCommand=()=>false;});
  await page.getByRole('button',{name:'Copy Link',exact:true}).click();assert.match(await page.locator('#share-status').textContent(),/copy command/);
  await page.screenshot({path:'share-desktop-review.png'});
  await page.getByRole('button',{name:'Close share game'}).click();
  await page.getByRole('button',{name:'Download App'}).click();
  assert.match(await page.locator('#install-steps').textContent(),/Chrome or Edge/);
  assert.equal(await page.locator('#official-game-link').getAttribute('href'),URL);
  await page.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});window.promptCalled=0;e.prompt=async()=>window.promptCalled++;e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e);});
  await page.getByRole('button',{name:'Install App',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.promptCalled),1);assert.match(await page.locator('#install-status').textContent(),/dismissed/);
  await page.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e);});
  await page.getByRole('button',{name:'Install App',exact:true}).click();assert.match(await page.locator('#install-status').textContent(),/requested/);
  await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));assert(await page.locator('#download-app').isDisabled());assert.match(await page.locator('#install-status').textContent(),/installed/);
  await page.getByRole('button',{name:'Close app installation'}).click();
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Share Game'}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'share-mobile-review.png'});
  await page.getByRole('button',{name:'Close share game'}).click();
  // Real service-worker and record persistence check, rather than mocked offline responses.
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  await page.locator('#search').fill('Jumping Jack');await page.getByRole('button',{name:'Add to selected day: Jumping Jack',exact:true}).click();
  await page.locator('.check').first().click();await page.getByRole('spinbutton',{name:'Minutes spent on Jumping Jack'}).fill('30');await page.getByRole('spinbutton',{name:'Minutes spent on Jumping Jack'}).press('Tab');
  await page.waitForFunction(()=>document.querySelector('.save-label').textContent.startsWith('●'));
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.exercise-card').length>140);
  assert.equal(await page.locator('#day-hours').textContent(),'0.5 h');assert.equal(await page.locator('.daily-row').count(),1);
  await page.getByRole('button',{name:'Share Game'}).click();assert.equal(await page.locator('#share-url').inputValue(),URL);
  await context.setOffline(false);
  for(const [ua,expected] of [
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',/Safari.*Share.*Add to Home Screen/s],
    ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',/Samsung Internet.*Install app/s]
  ]){const mobile=await browser.newContext({viewport:{width:390,height:844},userAgent:ua});const p=await mobile.newPage();await p.goto('http://127.0.0.1:5173');await p.getByRole('button',{name:'Download App'}).click();assert.match(await p.locator('#install-steps').textContent(),expected);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.close();}
  assert.deepEqual(errors,[]);await browser.close();
  console.log('PASS: public QR/link, clipboard fallback, native share and cancellation, QR download, install prompt accepted/dismissed/installed states, device instructions, mobile layout, real offline calendar and saved progress.');
})().catch(error=>{console.error(error);process.exit(1)});
