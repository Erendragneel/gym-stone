const {chromium}=require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const url=process.env.GYM_TEST_URL||'http://127.0.0.1:5173';
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1100},timezoneId:'Asia/Tokyo'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/assets/*.webp',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUVsAAAAASUVORK5CYII=','base64')}));
  await context.route('**/cloud-config.js',route=>route.fulfill({contentType:'application/javascript',body:"window.GYM_STONE_CLOUD_CONFIG={url:'',key:''}"}));
  await page.goto(url);await page.locator('#account-preview').click();await page.waitForFunction(()=>exercises.length===425);
  const fixture=await page.evaluate(async()=>{
    const exercise=exercises.find(item=>item.name==='Standing Dumbbell Curl'),yesterday=new Date(today+'T12:00:00');yesterday.setDate(yesterday.getDate()-1);const earlier=dateKey(yesterday);
    records={[earlier]:[{id:exercise.id,done:true,tracking:'reps',sets:3,reps:10,weight:16,weightUnit:'kg',minutes:0,time:''},{id:'run-earlier',name:'Running',group:'Cardio & activity',done:true,tracking:'time',minutes:30,distance:{value:5,unit:'km'},time:''}],
      [today]:[{id:exercise.id,done:false,tracking:'reps',sets:3,reps:10,weight:null,minutes:0,time:''},{id:'run-today',name:'Running',group:'Cardio & activity',done:false,tracking:'time',minutes:25,time:''}]};
    await GymScreenshotStore.putRecords(records);render();return {id:exercise.id,today,earlier};
  });
  async function edit(label,value){await page.getByLabel(label,{exact:true}).fill(value);await page.getByLabel(label,{exact:true}).dispatchEvent('change');await page.evaluate(()=>GymScreenshotStore.whenIdle())}
  async function screen(name){await page.locator('.app-nav [data-screen='+name+']').click()}
  await screen('calendar');await page.locator('.workout-details[data-id="'+fixture.id+'"] summary').click();
  await edit('Weight for Standing Dumbbell Curl','20');assert.equal(await page.evaluate(()=>progressSnapshot.bonusXP),0);
  await page.evaluate(()=>{const put=GymScreenshotStore.putRecords;GymScreenshotStore.putRecords=(...args)=>new Promise(resolve=>{window.releasePRWrite=()=>{GymScreenshotStore.putRecords=put;return put(...args).then(resolve)}})});
  await page.getByRole('button',{name:'Complete: Standing Dumbbell Curl',exact:true}).click();
  await page.evaluate(()=>render());await page.evaluate(()=>releasePRWrite());await page.evaluate(()=>GymScreenshotStore.whenIdle());
  assert.equal(await page.locator('#day-xp').textContent(),'+75 XP');assert.match(await page.locator('.daily-record-badge').textContent(),/New max.*50 bonus XP/);
  await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('New max: 20 kg'));
  await screen('progress');await page.getByLabel('Exercise or activity for progress').selectOption('exercise:'+fixture.id);await page.getByLabel('Progress metric').selectOption('weight');
  assert.match(await page.locator('#latest-result').textContent(),/20 kg.*New max.*50 bonus XP/);
  assert.match(await page.locator('#result-comparisons').textContent(),/16 kg.*\+4 kg \(\+25%\)/);
  assert.match(await page.locator('#last-different-result').textContent(),/16 kg.*\+4 kg/);
  assert.equal(await page.locator('#result-chart svg').count(),1);assert.match(await page.locator('#recent-records').textContent(),/New max: 20 kg/);
  assert.equal(await page.evaluate(()=>progressSnapshot.bonusXP),50);
  await screen('calendar');await edit('Weight for Standing Dumbbell Curl','22');assert.equal(await page.evaluate(()=>progressSnapshot.bonusXP),50);
  await page.getByRole('button',{name:'Mark incomplete: Standing Dumbbell Curl',exact:true}).click();assert.equal(await page.evaluate(()=>progressSnapshot.bonusXP),0);
  await page.getByRole('button',{name:'Complete: Standing Dumbbell Curl',exact:true}).click();await page.evaluate(()=>GymScreenshotStore.whenIdle());assert.equal(await page.evaluate(()=>progressSnapshot.bonusXP),50);
  await page.locator('.workout-details[data-id="run-today"] summary').click();
  assert.deepEqual(await page.getByLabel('Distance unit for Running',{exact:true}).locator('option').allTextContents(),['Kilometers (km)','Miles (mi)','Meters (m)']);
  await edit('Distance for Running','5');await page.getByRole('button',{name:'Complete: Running',exact:true}).click();await page.evaluate(()=>GymScreenshotStore.whenIdle());
  assert.equal(await page.evaluate(()=>progressSnapshot.bonusXP),100);assert.match(await page.locator('#level').textContent(),/02/);
  await screen('progress');await page.getByLabel('Exercise or activity for progress').selectOption('activity:running');await page.getByLabel('Progress metric').selectOption('speed');
  assert.match(await page.locator('#latest-result').textContent(),/12 km\/h.*5:00 \/km.*New fastest average/);
  assert.match(await page.locator('#result-comparisons').textContent(),/10 km\/h.*\+2 km\/h \(\+20%\)/);
  await screen('calendar');await edit('Distance for Running','6');assert.equal(await page.evaluate(()=>progressSnapshot.bonusXP),100);assert.equal(await page.evaluate(()=>progressSnapshot.byEntry[GymProgressData.token(today,'run-today')].records.length),2);
  await edit('Distance for Running','-1');assert.equal(await page.evaluate(()=>records[today].find(item=>item.id==='run-today').distance.value),6);
  await edit('Distance for Running','');assert.equal(await page.evaluate(()=>progressSnapshot.bonusXP),50);
  await edit('Distance for Running','0');assert.equal(await page.evaluate(()=>progressSnapshot.bonusXP),50);
  await edit('Distance for Running','5');await page.evaluate(()=>GymScreenshotStore.whenIdle());
  await page.reload();await page.locator('#account-preview').click();await page.waitForFunction(()=>exercises.length===425);assert.equal(await page.evaluate(()=>progressSnapshot.bonusXP),100);assert.equal(await page.locator('#toast.visible').count(),0);
  await screen('progress');await page.getByLabel('Exercise or activity for progress').selectOption('exercise:'+fixture.id);await page.getByLabel('Progress metric').selectOption('weight');assert.match(await page.locator('#latest-result').textContent(),/22 kg/);
  await page.locator('#progress-date').fill(fixture.earlier);await page.locator('#progress-date').dispatchEvent('change');assert.equal(await page.locator('body').getAttribute('data-screen'),'progress');assert.match(await page.locator('#latest-result').textContent(),/16 kg.*Starting log/);assert.match(await page.locator('#record-totals').textContent(),/Bonus XP earned\+0/);
  await page.locator('#progress-date').fill(fixture.today);await page.locator('#progress-date').dispatchEvent('change');
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflow at '+width);assert.equal(await page.locator('#result-chart').evaluate(node=>node.scrollWidth>node.clientWidth+1),false)}
  await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:'progress-personal-bests-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'progress-personal-bests-mobile.png',fullPage:true});
  await screen('calendar');await page.getByRole('button',{name:'Remove Standing Dumbbell Curl',exact:true}).click();await page.evaluate(()=>GymScreenshotStore.whenIdle());assert.equal(await page.evaluate(()=>progressSnapshot.bonusXP),50);
  await screen('progress');await page.getByLabel('Exercise or activity for progress').selectOption('exercise:'+fixture.id);await page.getByLabel('Progress metric').selectOption('weight');assert.match(await page.locator('#latest-result').textContent(),/16 kg.*Starting log/);
  // Incoming cloud history updates results without re-announcing old awards.
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gym-calendar-records',{detail:{}})));assert.equal(await page.locator('#performance-results').isVisible(),false);assert.equal(await page.locator('#performance-empty').isVisible(),true);assert.match(await page.locator('#record-totals').textContent(),/Bonus XP earned\+0/);
  const offline=await browser.newContext({serviceWorkers:'allow',timezoneId:'Asia/Tokyo'}),offlinePage=await offline.newPage();offlinePage.on('pageerror',error=>errors.push(error.message));
  await offline.route('**/assets/*.webp',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUVsAAAAASUVORK5CYII=','base64')}));
  await offline.route('**/cloud-config.js',route=>route.fulfill({contentType:'application/javascript',body:"window.GYM_STONE_CLOUD_CONFIG={url:'',key:''}"}));
  await offlinePage.goto(url);await offlinePage.locator('#account-preview').click();await offlinePage.waitForFunction(()=>exercises.length===425);
  await offlinePage.evaluate(async fixture=>{const record=weight=>({id:fixture.id,done:true,tracking:'reps',sets:3,reps:10,weight,weightUnit:'kg',minutes:0,time:''});await navigator.serviceWorker.ready;await GymScreenshotStore.putRecords({[fixture.earlier]:[record(16)],[fixture.today]:[record(20)]})},fixture);
  await offlinePage.waitForFunction(()=>navigator.serviceWorker.controller!==null);await offline.setOffline(true);await offlinePage.reload();await offlinePage.waitForFunction(()=>exercises.length===425);
  assert.equal(await offlinePage.evaluate(()=>progressSnapshot.bonusXP),50);assert.equal(await offlinePage.locator('#performance-results').count(),1);assert.equal(await offlinePage.locator('#toast.visible').count(),0);
  assert.deepEqual(errors,[]);await browser.close();console.log('PASS: curl max/reward, first/previous comparisons, one bonus, speed/pace, distance logging, edit/delete/incomplete/reload/cloud updates, date cutoff, mobile charts and offline progress.');
})().catch(error=>{console.error(error);process.exit(1)});
