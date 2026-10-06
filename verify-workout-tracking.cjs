const {chromium}=require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1100},timezoneId:'Asia/Tokyo'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await context.route('**/cloud-config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.GYM_STONE_CLOUD_CONFIG={url:'',key:''}"}));
 await page.goto('http://127.0.0.1:5173');await page.locator('#account-preview').click();await page.waitForFunction(()=>document.querySelectorAll('.exercise-card').length===149);
 await page.locator('.app-nav [data-screen=exercises]').click();await page.locator('#search').fill('Push Up');await page.getByRole('button',{name:'Add to selected day: Push Up',exact:true}).click();await page.locator('#view-workout').click();
 await page.locator('.workout-details summary').first().click();
 assert.equal(await page.getByLabel('Tracking mode for Push Up',{exact:true}).inputValue(),'reps');
 await page.getByLabel('Sets for Push Up',{exact:true}).fill('3');await page.getByLabel('Sets for Push Up',{exact:true}).press('Tab');
 await page.getByLabel('Reps per set for Push Up',{exact:true}).fill('12');await page.getByLabel('Reps per set for Push Up',{exact:true}).press('Tab');
 assert.equal(await page.locator('#day-reps').textContent(),'0');await page.getByRole('button',{name:'Complete: Push Up',exact:true}).click();
 assert.equal(await page.locator('#day-sets').textContent(),'3');assert.equal(await page.locator('#day-reps').textContent(),'36');assert.equal(await page.locator('#day-hours').textContent(),'0 h');
 assert.equal(await page.getByLabel('Minutes spent on Push Up',{exact:true}).count(),0);assert.doesNotMatch(await page.locator('#time-note').textContent(),/needs a duration/);
 await page.locator('.app-nav [data-screen=exercises]').click();await page.locator('#mode-done').click();await page.locator('#add-activity').click();await page.locator('#manual-activity-name').fill('Running');await page.getByRole('button',{name:'Add activity',exact:true}).click();
 await page.locator('.workout-details summary').last().click();
 assert.equal(await page.getByLabel('Tracking mode for Running').inputValue(),'time');await page.getByLabel('Minutes spent on Running').fill('30');await page.getByLabel('Minutes spent on Running').press('Tab');
 assert.equal(await page.locator('#day-hours').textContent(),'0.5 h');assert.equal(await page.locator('#day-reps').textContent(),'36');
 await page.getByLabel('Tracking mode for Push Up',{exact:true}).selectOption('time');await page.getByLabel('Minutes spent on Push Up',{exact:true}).fill('10');await page.getByLabel('Minutes spent on Push Up',{exact:true}).press('Tab');
 await page.getByLabel('Tracking mode for Push Up',{exact:true}).selectOption('reps');assert.equal(await page.locator('#day-hours').textContent(),'0.5 h');assert.equal(await page.getByLabel('Sets for Push Up',{exact:true}).inputValue(),'3');
 assert.equal(await page.evaluate(()=>GymTracking.mode({minutes:15},{name:'Push Up'})),'time');assert.equal(await page.evaluate(()=>GymTracking.count(-1)),null);assert.equal(await page.evaluate(()=>GymTracking.count(1.5)),null);
 await page.evaluate(()=>GymScreenshotStore.whenIdle());const saved=await page.evaluate(()=>GymScreenshotStore.getRecords());assert(Object.values(saved).flat().some(r=>r.sets===3&&r.reps===12&&r.tracking==='reps'));
 await page.reload();await page.locator('#account-preview').click();await page.waitForFunction(()=>document.querySelectorAll('.exercise-card').length===149);assert.equal(await page.locator('#day-reps').textContent(),'36');assert.equal(await page.locator('#day-hours').textContent(),'0.5 h');
 await page.screenshot({path:'workout-tracking-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'workout-tracking-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: planned/completed sets and reps, cardio, mode switching, legacy durations, totals, persistence and mobile layout.');
})().catch(e=>{console.error(e);process.exit(1)});


