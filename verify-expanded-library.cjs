const {chromium}=require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const preview=process.argv.includes('--preview');
let catalog=JSON.parse(fs.readFileSync('dist/exercises.json','utf8'));
if(preview){
 const jobs=JSON.parse(fs.readFileSync('animation-source/expansion-v16/jobs.json','utf8'));
 const encoded=JSON.parse(fs.readFileSync('animation-source/expansion-v16/encoding-audit.json','utf8'));
 catalog=catalog.filter(e=>!e.expansion).concat(encoded.map(row=>{const job=jobs.find(e=>e.id===row.id);return {...job,expansion:true,variants:row.variants,image:row.variants.male.image,gif:row.variants.male.gif}}));
}
const expanded=catalog.filter(e=>e.expansion);
(async()=>{
 if(!preview){assert.equal(catalog.length,425);assert.equal(expanded.length,250)}
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1100},timezoneId:'Asia/Tokyo'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/cloud-config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.GYM_STONE_CLOUD_CONFIG={url:'',key:''}"}));
 if(preview)await context.route('**/exercises.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(catalog)}));
 await context.addInitScript(()=>localStorage.setItem('gym-stone-profile-v1',JSON.stringify({name:'Expansion tester',gender:'male',birthday:'1996-10-05',weight:65,weightUnit:'kg',goal:'strength',daysPerWeek:3,completed:true,updatedAt:Date.now()})));
 await page.goto('http://127.0.0.1:5173');await page.locator('#account-preview').click();
 await page.waitForFunction(total=>document.querySelectorAll('.exercise-card').length===total,catalog.length).catch(async e=>{console.error({expected:catalog.length,state:await page.evaluate(()=>({cards:document.querySelectorAll('.exercise-card').length,label:document.querySelector('#library-count').textContent,grid:document.querySelector('#exercise-grid').textContent.slice(0,400)})),errors});throw e});
 await page.locator('.app-nav [data-screen=exercises]').click();
 assert.equal(await page.locator('#library-count').innerText(),catalog.length+' moves');
 assert.equal(await page.locator('#library-tools').isVisible(),true);
 // These filters must combine; a beginner dumbbell move must never show a machine or advanced move.
 await page.locator('#equipment-filter').selectOption('Dumbbells');
 for(const name of ['Goblet Squat','Arnold Press','Bulgarian Split Squat'])assert.equal(await page.getByRole('button',{name:'Preview '+name,exact:true}).count(),1);
 const testedLevel=expanded.some(e=>e.difficulty==='Beginner'&&/dumbbell/i.test(e.equipment))?'Beginner':'Intermediate';
 await page.locator('#difficulty-filter').selectOption(testedLevel);
 const names=await page.locator('.exercise-card h3').allTextContents();assert(names.length>0);
 for(const name of names){const e=expanded.find(e=>e.name===name);assert(e&&e.difficulty===testedLevel&&/dumbbell/i.test(e.equipment),name)}
 const term=names[0].split(' ').at(-1).toLowerCase();await page.locator('#search').fill(term);
 assert.equal(await page.getByRole('button',{name:'Preview '+names[0],exact:true}).count(),1);
 for(const name of await page.locator('.exercise-card h3').allTextContents())assert(name.toLowerCase().includes(term));
 await page.locator('#reset-library-filters').click();assert.equal(await page.locator('.exercise-card').count(),catalog.length);
 // Ordinary filters are bypassed in the existing guided sections.
 await page.locator('#equipment-filter').selectOption('Barbell');await page.locator('#difficulty-filter').selectOption('Advanced');
 for(const group of ['Pregnancy','Warm-up','Cooldown']){
  await page.locator('#stretch-tabs [data-group="'+group+'"]').click();
  assert.equal(await page.locator('#library-tools').isVisible(),false);
  assert.equal(await page.locator('.exercise-card').count(),catalog.filter(e=>e.group===group).length);
 }
 await page.locator('#stretch-tabs [data-group="All moves"]').click();await page.locator('#reset-library-filters').click();
 const strength=expanded.find(e=>e.id==='exp-kneeling-push-up'),cardio=expanded.find(e=>e.name===(preview?'Forearm Plank':'Treadmill Jog'));assert(strength&&cardio);
 await page.locator('#search').fill(strength.name);await page.getByRole('button',{name:'Preview '+strength.name,exact:true}).click();
 assert.equal(await page.locator('#preview-image').getAttribute('src'),strength.variants.male.image);
 assert.match(await page.locator('#preview-instructions').innerText(),/sets & reps/);
 assert.match(await page.locator('#preview-instructions').innerText(),new RegExp(strength.cues[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 assert.equal(await page.locator('#preview-instructions .stretch-timing').count(),0);
 await page.locator('#preview-add').click();await page.getByRole('button',{name:'Close exercise preview',exact:true}).click();await page.locator('#view-workout').click();
 await page.locator('.workout-details summary').first().click();
 assert.equal(await page.getByLabel('Sets for '+strength.name,{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('Reps per set for '+strength.name,{exact:true}).inputValue(),'');
 for(const [label,value]of [['Sets for ','3'],['Reps per set for ','10']]){await page.getByLabel(label+strength.name,{exact:true}).fill(value);await page.getByLabel(label+strength.name,{exact:true}).press('Tab')}
 await page.getByRole('button',{name:'Complete: '+strength.name,exact:true}).click();assert.equal(await page.locator('#day-reps').innerText(),'30');
 await page.locator('.app-nav [data-screen=exercises]').click();await page.locator('#search').fill(cardio.name);await page.getByRole('button',{name:'Add to selected day: '+cardio.name,exact:true}).click();await page.locator('#view-workout').click();await page.locator('.workout-details summary').last().click();
 assert.equal(await page.getByLabel('Tracking mode for '+cardio.name,{exact:true}).inputValue(),'time');assert.equal(await page.getByLabel('Minutes spent on '+cardio.name,{exact:true}).inputValue(),'');
 await page.getByLabel('Minutes spent on '+cardio.name,{exact:true}).fill('20');await page.getByLabel('Minutes spent on '+cardio.name,{exact:true}).press('Tab');await page.getByRole('button',{name:'Complete: '+cardio.name,exact:true}).click();
 assert.equal(await page.locator('#day-hours').innerText(),'0.33 h');assert.equal(await page.locator('#day-reps').innerText(),'30');
 await page.evaluate(()=>GymScreenshotStore.whenIdle());const saved=await page.evaluate(()=>GymScreenshotStore.getRecords());
 await page.locator('.app-nav [data-screen=exercises]').click();await page.locator('#player-profile').click();await page.locator('#profile-female').check({force:true});await page.locator('#profile-next').click();await page.locator('#save-profile').click();await page.locator('#profile-dialog').waitFor({state:'hidden'});
 await page.locator('#search').fill(strength.name);await page.getByRole('button',{name:'Preview '+strength.name,exact:true}).click();assert.equal(await page.locator('#preview-image').getAttribute('src'),strength.variants.female.image);await page.getByRole('button',{name:'Close exercise preview',exact:true}).click();assert.deepEqual(await page.evaluate(()=>GymScreenshotStore.getRecords()),saved);
 // Decode every new male/female WebP from the actual local server, in bounded batches.
 const urls=expanded.flatMap(e=>[e.variants.male.image,e.variants.female.image]);
 for(let i=0;i<urls.length;i+=8){const batch=urls.slice(i,i+8);const decoded=await page.evaluate(async urls=>Promise.all(urls.map(url=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth===600&&image.naturalHeight===484);image.onerror=()=>resolve(false);image.src=url}))),batch);assert(decoded.every(Boolean),'Animation failed: '+batch.join(', '))}
 await page.locator('#reset-library-filters').click();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#toast')).opacity==='0');await page.screenshot({path:'expanded-library-desktop.png',fullPage:true});
 await page.setViewportSize({width:360,height:800});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await page.evaluate(()=>document.querySelector('#view-workout').getBoundingClientRect().bottom<document.querySelector('.app-nav').getBoundingClientRect().top),true);
 assert.equal(await page.evaluate(()=>document.querySelector('#exercise-grid').clientHeight>=60),true);
 await page.screenshot({path:'expanded-library-mobile.png',fullPage:true});
 await page.locator('#exercise-grid').hover();await page.mouse.wheel(0,100000);await page.waitForFunction(()=>{const g=document.querySelector('#exercise-grid');return g.scrollTop+g.clientHeight>=g.scrollHeight-2});
 await page.getByRole('button',{name:'Preview '+expanded.at(-1).name,exact:true}).click();await page.waitForFunction(()=>document.querySelector('#preview-image').naturalWidth>0);
 assert.equal(await page.locator('#preview-image').evaluate(e=>getComputedStyle(e).objectFit),'contain');assert.equal(await page.evaluate(()=>document.querySelector('#exercise-dialog').getBoundingClientRect().right<=innerWidth),true);
 await page.screenshot({path:'expanded-preview-mobile.png',fullPage:true});await page.getByRole('button',{name:'Close exercise preview',exact:true}).click();
 await page.reload();await page.locator('#account-preview').click();await page.waitForFunction(total=>document.querySelectorAll('.exercise-card').length===total,catalog.length);assert.deepEqual(await page.evaluate(()=>GymScreenshotStore.getRecords()),saved);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: '+catalog.length+' moves, equipment/level/search combinations, guided-section isolation, blank reps/time logging, gender switch, all '+expanded.length*2+' WebPs, 360px scrolling/preview and persistence'+(preview?' (reviewed-asset preview fixture).':'.'));
})().catch(e=>{console.error(e);process.exit(1)});
