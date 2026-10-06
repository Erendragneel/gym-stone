'use strict';
const {chromium}=require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.MUSCLE_TEST_URL||'http://127.0.0.1:5186';
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'dist/exercises.json'),'utf8'));
const output=path.join(__dirname,'muscle-map-review');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1100},timezoneId:'Asia/Tokyo'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/cloud-config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.GYM_STONE_CLOUD_CONFIG={url:'',key:''}"}));
 await context.addInitScript(()=>localStorage.setItem('gym-stone-profile-v1',JSON.stringify({name:'Muscle map tester',gender:'male',birthday:'1996-10-05',weight:65,weightUnit:'kg',goal:'strength',daysPerWeek:3,completed:true,updatedAt:Date.now()})));
 await page.goto(url);await page.locator('#account-preview').click();await page.waitForFunction(count=>document.querySelectorAll('.exercise-card').length===count,catalog.length);
 await page.locator('.app-nav [data-screen=exercises]').click();
 const audit=await page.evaluate(()=>{
  const failures=[],all=Object.entries(GymMuscleData.exercises),known=new Set(Object.keys(GymMuscleData.definitions));
  for(const [id,profile]of all){
   GymMuscles.render({id,name:profile.name});
   const panel=document.getElementById('preview-muscles');
   if(panel.hidden||panel.dataset.exercise!==id||panel.querySelectorAll('svg').length!==2)failures.push(id+': missing diagram');
   if(!profile.primary.length||new Set([...profile.primary,...profile.secondary]).size!==profile.primary.length+profile.secondary.length)failures.push(id+': invalid/overlapping roles');
   for(const role of ['primary','secondary'])for(const key of profile[role]){
    if(!known.has(key)||!panel.querySelector('[data-muscle="'+key+'"][data-role="'+role+'"]'))failures.push(id+': missing '+role+' '+key);
   }
   const rendered=new Set([...panel.querySelectorAll('[data-role]:not([data-role=inactive])')].map(el=>el.dataset.muscle));
   if(rendered.size!==profile.primary.length+profile.secondary.length)failures.push(id+': stale highlighting');
   if(panel.querySelectorAll('.muscle-list')[0].textContent!==profile.primary.map(key=>GymMuscleData.definitions[key]).join(' · '))failures.push(id+': inaccessible names');
  }
  for(const e of exercises){
   openPreview(e);
   if(document.getElementById('preview-muscles').dataset.exercise!==e.id||document.getElementById('preview-name').textContent!==e.name)failures.push(e.id+': actual preview mismatch');
   document.getElementById('exercise-dialog').close();
  }
  const expected={
   'Goblet Squat':{p:['quads','glutes'],s:['adductors','hamstrings','abs','deepCore','obliques']},
   'Dumbbell Bench Press':{p:['chest'],s:['frontDelts','triceps']},
   'Dumbbell Lateral Raise':{p:['sideDelts'],s:['upperTraps','rotatorCuff']},
   'Seated Calf Raise Machine':{p:['soleus'],s:['gastrocnemius']},
   'Standing Calf Raise':{p:['soleus','gastrocnemius'],s:['tibialis']},
   'Leg Extension':{p:['quads'],s:[]},
   'Hammer Curl':{p:['biceps','brachialis','brachioradialis'],s:['forearmFlexors']},
   'Cable Triceps Pushdown':{p:['triceps'],s:['forearmFlexors']},
   'Seated Band Row':{p:['lats','rhomboids','midTraps'],s:['biceps','rearDelts']}
  };
  for(const [name,roles]of Object.entries(expected)){
   const p=all.find(([,p])=>p.name===name)?.[1];
   if(!p||roles.p.some(k=>!p.primary.includes(k))||roles.s.some(k=>!p.secondary.includes(k)))failures.push(name+': wrong muscle roles');
  }
  return {failures,mapped:all.length,active:exercises.length};
 });
 assert.deepEqual(audit.failures,[]);assert.equal(audit.active,catalog.length);assert(audit.mapped>=catalog.length);
 await page.locator('#search').fill('Goblet Squat');await page.getByRole('button',{name:'Preview Goblet Squat',exact:true}).click();
 await page.locator('#preview-image').evaluate(img=>img.decode());
 const color=await page.evaluate(()=>{
  const rgb=role=>getComputedStyle(document.querySelector('.muscle-swatch.muscle-'+role)).backgroundColor.match(/\d+/g).map(Number);
  const luma=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
  return {primary:rgb('primary'),secondary:rgb('secondary'),darker:luma(rgb('primary'))<luma(rgb('secondary'))};
 });assert(color.darker);assert.deepEqual(color.primary,[157,24,53]);assert.deepEqual(color.secondary,[245,165,173]);
 await page.locator('#exercise-dialog').screenshot({path:path.join(output,'goblet-desktop.png')});
 for(const width of [320,360,390,768,1440]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>{const d=document.getElementById('exercise-dialog');return d.scrollWidth>d.clientWidth+1||document.documentElement.scrollWidth>innerWidth}),false,'overflow at '+width);
  await page.locator('#preview-add').scrollIntoViewIfNeeded();assert(await page.locator('#preview-add').isVisible());
  if(width===360){await page.locator('#exercise-dialog').evaluate(d=>d.scrollTop=0);await page.locator('#exercise-dialog').screenshot({path:path.join(output,'goblet-mobile-top.png')});await page.locator('#preview-muscles').scrollIntoViewIfNeeded();await page.locator('#exercise-dialog').screenshot({path:path.join(output,'goblet-mobile-map.png')});}
 }
 await page.setViewportSize({width:1440,height:1100});
 await page.locator('#preview-add').click();assert.equal(await page.locator('#preview-add').isDisabled(),true);
 await page.getByRole('button',{name:'Close exercise preview',exact:true}).click();await page.locator('#view-workout').click();
 await page.locator('.workout-details summary').first().click();
 for(const [label,value]of [['Sets for Goblet Squat','3'],['Reps per set for Goblet Squat','10']]){await page.getByLabel(label,{exact:true}).fill(value);await page.getByLabel(label,{exact:true}).press('Tab');}
 await page.getByRole('button',{name:'Complete: Goblet Squat',exact:true}).click();assert.equal(await page.locator('#day-reps').innerText(),'30');
 await page.locator('.app-nav [data-screen=exercises]').click();await page.locator('#search').fill('');
 await page.getByRole('button',{name:'Preview Seated Hamstring Stretch',exact:true}).click();assert.equal(await page.locator('#preview-muscles h3').innerText(),'Muscles stretched');assert.match(await page.locator('#preview-instructions').innerText(),/sec per side/);await page.getByRole('button',{name:'Close exercise preview',exact:true}).click();
 await page.getByRole('button',{name:'Preview Wall Push-Up',exact:true}).click();assert.match(await page.locator('#preview-instructions').innerText(),/clinician/);assert.match(await page.locator('#preview-muscles .muscle-list').first().innerText(),/Chest/);await page.getByRole('button',{name:'Close exercise preview',exact:true}).click();
 await page.locator('#player-profile').click();await page.locator('#profile-female').check({force:true});await page.locator('#profile-next').click();await page.locator('#save-profile').click();await page.locator('#profile-dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Preview Goblet Squat',exact:true}).click();assert.match(await page.locator('#preview-image').getAttribute('src'),/female/);assert.match(await page.locator('#preview-muscles .muscle-list').first().innerText(),/Quadriceps/);await page.getByRole('button',{name:'Close exercise preview',exact:true}).click();
 await page.evaluate(()=>GymScreenshotStore.whenIdle());await page.reload();await page.locator('#account-preview').click();await page.waitForFunction(count=>document.querySelectorAll('.exercise-card').length===count,catalog.length);assert.equal(await page.locator('#day-reps').innerText(),'30');
 assert.deepEqual(errors,[]);await context.close();
 const offline=await browser.newContext({serviceWorkers:'allow'}),offlinePage=await offline.newPage();
 await offlinePage.goto(url);await offlinePage.evaluate(async()=>{await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;});await offlinePage.waitForFunction(()=>navigator.serviceWorker.controller);
 assert(await offlinePage.evaluate(async()=>{const cache=await caches.open('gym-stone-shell-v15-muscles');return (await Promise.all(['./exercise-muscles.js?v=1','./muscle-map.js?v=1','./muscle-map.css?v=1'].map(url=>cache.match(url)))).every(Boolean);}));
 await offline.setOffline(true);await offlinePage.reload();await offlinePage.waitForFunction(()=>window.GymMuscles&&window.GymMuscleData);
 await offlinePage.evaluate(()=>{const p=Object.values(GymMuscleData.exercises).find(p=>p.name==='Goblet Squat');const id=Object.entries(GymMuscleData.exercises).find(([,v])=>v===p)[0];GymMuscles.render({id,name:p.name});});assert.equal(await offlinePage.locator('#preview-muscles svg').count(),2);
 await browser.close();console.log('PASS: '+audit.mapped+' explicit maps, '+audit.active+' real exercise previews, primary/secondary roles & color lightness, 320–1440px layout, planning/logging/persistence, male/female artwork, stretch & prenatal guidance, and offline maps.');
})().catch(e=>{console.error(e);process.exit(1)});
