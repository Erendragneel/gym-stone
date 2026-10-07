const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const catalog=JSON.parse(fs.readFileSync(__dirname+'/dist/exercises.json','utf8'));
const prenatal=catalog.filter(e=>e.prenatal),maleCount=catalog.length-prenatal.length;
const cloud="window.GYM_STONE_CLOUD_CONFIG={url:'',key:''};";
const profile={name:'Profile tester',gender:'male',birthday:'1996-10-05',weight:65,weightUnit:'kg',targetWeight:null,goal:'stay-active',daysPerWeek:3,completed:true,updatedAt:Date.now()};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const context=await browser.newContext({serviceWorkers:'allow',viewport:{width:1440,height:1000},timezoneId:'Asia/Tokyo'});
 await context.route('**/cloud-config.js',r=>r.fulfill({contentType:'application/javascript',body:cloud}));
 await context.addInitScript(profile=>{
  if(!localStorage.getItem('gym-stone-profile-v1'))localStorage.setItem('gym-stone-profile-v1',JSON.stringify(profile));
  window.__profileTools={};Object.defineProperty(document,'modelContext',{configurable:true,value:{registerTool:tool=>{window.__profileTools[tool.name]=tool;}}});
 },profile);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function boot(){await page.goto(process.env.BASE_URL||'http://127.0.0.1:5173');await page.locator('#account-preview').click();await page.evaluate(()=>GymProfile.ready);await page.waitForFunction(()=>window.__profileTools.read_workout_calendar);await page.locator('.app-nav [data-screen=exercises]').click();}
 async function gender(value,stacked=false){if(stacked)await page.evaluate(()=>GymProfile.open());else await page.locator('#player-profile').click();await page.locator('#profile-'+value).check({force:true});await page.locator('#profile-next').click();await page.locator('#save-profile').click();await page.locator('#profile-dialog').waitFor({state:'hidden'});await page.waitForFunction(value=>GymProfile.gender===value,value);}
 async function assertMale(){
  await page.waitForFunction(count=>document.querySelectorAll('.exercise-card').length===count,maleCount);
  assert.equal(await page.locator('#stretch-tabs [data-group=Pregnancy]').isVisible(),false);
  assert.equal(await page.locator('#muscle-filter option').filter({hasText:/^Pregnancy$/}).count(),0);
  assert.equal(await page.locator('#pregnancy-guidance').isVisible(),false);
  assert.equal(await page.locator('#library-count').innerText(),maleCount+' moves');
  const available=await page.evaluate(()=>window.__profileTools.read_workout_calendar.execute().exercises);
  assert(prenatal.every(e=>!available.some(row=>row.id===e.id)));
 }
 try{
  await boot();await assertMale();
  await page.locator('#search').fill(prenatal[0].name);assert.equal(await page.locator('.exercise-card').count(),0);await page.locator('#search').fill('');
  const unchanged=await page.evaluate(()=>structuredClone(records));
  await page.evaluate(id=>{add(id);openPreview(exercises.find(e=>e.id===id));},prenatal[0].id);
  assert.equal(await page.locator('#exercise-dialog').isVisible(),false);assert.deepEqual(await page.evaluate(()=>records),unchanged);
  assert(await page.evaluate(id=>{try{window.__profileTools.add_workouts_to_day.execute({date:selected,exerciseIds:[id]});return false;}catch{return true;}},prenatal[0].id));
  await gender('female');await page.waitForFunction(count=>document.querySelectorAll('.exercise-card').length===count,catalog.length);
  assert(await page.locator('#stretch-tabs [data-group=Pregnancy]').isVisible());assert.equal(await page.locator('#muscle-filter option').filter({hasText:/^Pregnancy$/}).count(),1);
  await page.locator('#stretch-tabs [data-group=Pregnancy]').click();assert.equal(await page.locator('.exercise-card').count(),prenatal.length);
  assert(await page.locator('#pregnancy-guidance').isVisible());
  for(const e of prenatal)assert.equal(await page.getByRole('button',{name:'Preview '+e.name,exact:true}).count(),1);
  await page.getByRole('button',{name:'Add to selected day: '+prenatal[0].name,exact:true}).click();await page.evaluate(()=>GymScreenshotStore.whenIdle());
  const saved=await page.evaluate(()=>GymScreenshotStore.getRecords());assert(Object.values(saved).flat().some(e=>e.id===prenatal[0].id));
  await gender('male');await assertMale();assert.equal(await page.locator('#muscle-filter').inputValue(),'All moves');assert.deepEqual(await page.evaluate(()=>GymScreenshotStore.getRecords()),saved);
  await gender('female');await page.locator('#stretch-tabs [data-group=Pregnancy]').click();await page.getByRole('button',{name:'Preview '+prenatal[0].name,exact:true}).click();assert(await page.locator('#exercise-dialog').isVisible());
  await gender('male',true);await assertMale();assert.equal(await page.locator('#exercise-dialog').isVisible(),false);
  for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await gender('female');await page.locator('#stretch-tabs [data-group=Pregnancy]').click();assert.equal(await page.locator('.exercise-card').count(),prenatal.length);await gender('male');await assertMale();}
  await page.evaluate(async()=>{await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;});await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.evaluate(async body=>{for(const key of await caches.keys()){const cache=await caches.open(key);for(const request of await cache.keys())if(new URL(request.url).pathname.endsWith('/cloud-config.js'))await cache.put(request,new Response(body,{headers:{'Content-Type':'application/javascript'}}));}},cloud);
  await context.setOffline(true);await page.reload();await page.locator('#account-preview').click();await page.evaluate(()=>GymProfile.ready);await page.locator('.app-nav [data-screen=exercises]').click();await assertMale();
  await gender('female');await page.locator('#stretch-tabs [data-group=Pregnancy]').click();assert.equal(await page.locator('.exercise-card').count(),prenatal.length);
  await page.reload();await page.locator('#account-preview').click();await page.evaluate(()=>GymProfile.ready);await page.locator('.app-nav [data-screen=exercises]').click();assert(await page.locator('#stretch-tabs [data-group=Pregnancy]').isVisible());await page.locator('#stretch-tabs [data-group=Pregnancy]').click();assert.equal(await page.locator('.exercise-card').count(),prenatal.length);
  assert.deepEqual(await page.evaluate(()=>GymScreenshotStore.getRecords()),saved);assert.deepEqual(errors,[]);
  console.log('PASS: Female-only Pregnancy tab/category/all 14 exercises, male search/API/add guards, profile switching and preview closure, preserved history, mobile layouts, and offline profile persistence.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
