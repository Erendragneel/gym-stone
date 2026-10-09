const {chromium}=require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const catalog=JSON.parse(fs.readFileSync('dist/exercises.json','utf8'));
const url=process.env.GYM_TEST_URL||'http://127.0.0.1:5173';
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000},timezoneId:'Asia/Tokyo'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/cloud-config.js',route=>route.fulfill({contentType:'application/javascript',body:"window.GYM_STONE_CLOUD_CONFIG={url:'',key:''}"}));
  async function enter(){await page.goto(url);await page.locator('#account-preview').click();await page.waitForFunction(()=>exercises.length===425)}
  async function add(name){
    await page.locator('.app-nav [data-screen=exercises]').click();
    await page.locator('#search').fill(name);
    await page.getByRole('button',{name:'Add to selected day: '+name,exact:true}).click();
    await page.locator('#view-workout').click();
    const id=catalog.find(exercise=>exercise.name===name).id;
    await page.locator('.workout-details').filter({has:page.locator('summary')}).evaluateAll(items=>items.forEach(item=>item.open=false));
    await page.locator('.workout-details[data-id="'+id+'"] summary').click();
    return id;
  }
  async function edit(label,value){const input=page.getByLabel(label,{exact:true});await input.fill(value);await input.dispatchEvent('change');await page.evaluate(()=>GymScreenshotStore.whenIdle())}
  await enter();
  // These fixtures cover old entries without equipment, new equipment, added
  // bodyweight loads, timed loads and cardio/mobility exclusions.
  const capability=await page.evaluate(()=>{
    const names=['Barbell Back Squat','Arnold Press','Leg Extension','Push Up','Single-Arm Overhead Carry','Plate Pinch Hold','Sled Push','Dumbbell Front Squat','Treadmill Jog','Rowing Machine','Thoracic Open Book','Arm Circles','Resistance Band Curl'];
    return Object.fromEntries(names.map(name=>{const exercise=exercises.find(item=>item.name===name);if(!exercise)throw Error('Missing fixture '+name);return[name,GymTracking.supportsWeight({},exercise)]}));
  });
  for(const name of ['Barbell Back Squat','Arnold Press','Leg Extension','Push Up','Single-Arm Overhead Carry','Plate Pinch Hold','Sled Push','Dumbbell Front Squat'])assert.equal(capability[name],true,name);
  for(const name of ['Treadmill Jog','Rowing Machine','Thoracic Open Book','Arm Circles','Resistance Band Curl'])assert.equal(capability[name],false,name);
  const squat=await add('Barbell Back Squat');
  assert.equal(await page.getByLabel('Weight for Barbell Back Squat',{exact:true}).inputValue(),'');
  assert.deepEqual(await page.getByLabel('Weight unit for Barbell Back Squat',{exact:true}).locator('option').allTextContents(),['Kilograms (kg)','Pounds (lb)']);
  await edit('Sets for Barbell Back Squat','3');await edit('Reps per set for Barbell Back Squat','8');await edit('Weight for Barbell Back Squat','42.75');
  assert.match(await page.locator('.workout-details[data-id="'+squat+'"] summary').textContent(),/3 sets × 8 reps · 42.75 kg/);
  await page.getByLabel('Weight unit for Barbell Back Squat',{exact:true}).selectOption('lb');await edit('Weight for Barbell Back Squat','95.5');
  await page.getByRole('button',{name:'Complete: Barbell Back Squat',exact:true}).click();
  assert.equal(await page.locator('#day-reps').textContent(),'24');assert.equal(await page.locator('#day-hours').textContent(),'0 h');
  await page.getByLabel('Tracking mode for Barbell Back Squat',{exact:true}).selectOption('time');
  assert.equal(await page.getByLabel('Weight for Barbell Back Squat',{exact:true}).inputValue(),'95.5');
  await page.getByLabel('Tracking mode for Barbell Back Squat',{exact:true}).selectOption('reps');
  const carry=await add('Single-Arm Overhead Carry');await edit('Minutes spent on Single-Arm Overhead Carry','2.5');await edit('Weight for Single-Arm Overhead Carry','12.25');
  assert.match(await page.locator('.workout-details[data-id="'+carry+'"] summary').textContent(),/2.5 min · 12.25 kg/);
  await page.getByRole('button',{name:'Complete: Single-Arm Overhead Carry',exact:true}).click();
  assert.equal(await page.locator('#day-reps').textContent(),'24');
  await page.evaluate(()=>GymScreenshotStore.whenIdle());
  const saved=await page.evaluate(async()=>Object.values(await GymScreenshotStore.getRecords()).flat());
  assert.equal(saved.find(item=>item.id===squat).weight,95.5);assert.equal(saved.find(item=>item.id===squat).weightUnit,'lb');
  assert.equal(saved.find(item=>item.id===carry).weight,12.25);assert.equal(saved.find(item=>item.id===carry).weightUnit,'kg');
  // Load legacy records with quantities but no weight properties.
  await page.evaluate(async id=>{const old=await GymScreenshotStore.getRecords();old[selected].push({id,done:false,tracking:'reps',sets:2,reps:10,minutes:0,time:''});await GymScreenshotStore.putRecords(old)},catalog.find(item=>item.name==='Push Up').id);
  await page.reload();await page.locator('#account-preview').click();await page.waitForFunction(()=>exercises.length===425);await page.locator('.app-nav [data-screen=calendar]').click();
  await page.locator('.workout-details').evaluateAll(items=>items.forEach(item=>item.open=true));
  assert.equal(await page.getByLabel('Weight for Barbell Back Squat',{exact:true}).inputValue(),'95.5');assert.equal(await page.getByLabel('Weight unit for Barbell Back Squat',{exact:true}).inputValue(),'lb');
  assert.equal(await page.getByLabel('Weight for Single-Arm Overhead Carry',{exact:true}).inputValue(),'12.25');
  assert.equal(await page.getByLabel('Weight for Push Up',{exact:true}).inputValue(),'');
  assert.equal(await page.getByLabel('Sets for Push Up',{exact:true}).inputValue(),'2');
  await edit('Weight for Push Up','5.125');assert.match(await page.locator('.daily-row').filter({hasText:'Push Up'}).locator('summary').textContent(),/5.125 kg/);
  const before=await page.evaluate(async()=>Object.values(await GymScreenshotStore.getRecords()).flat().find(item=>item.id===exercises.find(item=>item.name==='Push Up').id).weight);
  await edit('Weight for Push Up','-5');assert.equal(await page.evaluate(async()=>Object.values(await GymScreenshotStore.getRecords()).flat().find(item=>item.id===exercises.find(item=>item.name==='Push Up').id).weight),before);
  await edit('Weight for Push Up','0');assert.match(await page.locator('.daily-row').filter({hasText:'Push Up'}).locator('summary').textContent(),/0 kg/);
  await edit('Weight for Push Up','');assert.doesNotMatch(await page.locator('.daily-row').filter({hasText:'Push Up'}).locator('summary').textContent(),/kg|lb/);
  await add('Machine Assisted Pull-Up');await edit('Assistance weight for Machine Assisted Pull-Up','20');
  assert.match(await page.locator('.daily-row').filter({hasText:'Machine Assisted Pull-Up'}).locator('summary').textContent(),/20 kg assistance/);
  await add('Suspension-Assisted Squat');assert.equal(await page.getByLabel('Weight for Suspension-Assisted Squat',{exact:true}).count(),1);
  await add('Treadmill Jog');assert.equal(await page.getByLabel('Weight for Treadmill Jog',{exact:true}).count(),0);
  await page.locator('.app-nav [data-screen=exercises]').click();await page.locator('#add-activity').click();
  await page.locator('#manual-activity-name').fill('Custom Loaded Squat');await page.locator('#manual-activity-tracking').selectOption('reps');await page.getByRole('button',{name:'Add activity',exact:true}).click();
  await page.locator('.daily-row').filter({hasText:'Custom Loaded Squat'}).locator('summary').click();
  await edit('Weight for Custom Loaded Squat','22.5');
  assert.match(await page.locator('.daily-row').filter({hasText:'Custom Loaded Squat'}).locator('summary').textContent(),/22.5 kg/);
  await page.locator('.workout-details').evaluateAll((items,squatId)=>items.forEach(item=>item.open=item.dataset.id===squatId),squat);
  await page.locator('.daily-list').evaluate(list=>list.scrollTop=0);
  await page.screenshot({path:'exercise-weight-desktop.png',fullPage:true});
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflow at '+width);assert.equal(await page.locator('.workout-fields').evaluateAll(fields=>fields.some(field=>field.scrollWidth>field.clientWidth+1)),false,'field overflow at '+width)}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'exercise-weight-mobile.png',fullPage:true});
  // Verify the refreshed offline shell also serves the new controls and data.
  const offline=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'}),offlinePage=await offline.newPage();
  offlinePage.on('pageerror',error=>errors.push(error.message));
  await offline.route('**/cloud-config.js',route=>route.fulfill({contentType:'application/javascript',body:"window.GYM_STONE_CLOUD_CONFIG={url:'',key:''}"}));
  await offlinePage.goto(url);await offlinePage.locator('#account-preview').click();await offlinePage.waitForFunction(()=>exercises.length===425);
  await offlinePage.evaluate(async id=>{await navigator.serviceWorker.ready;const day=new Date().toLocaleDateString('en-CA');await GymScreenshotStore.putRecords({[day]:[{id,done:true,tracking:'reps',sets:3,reps:8,weight:42.75,weightUnit:'kg',minutes:0,time:''}]})},squat);
  await offlinePage.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  await offline.setOffline(true);await offlinePage.reload();await offlinePage.waitForFunction(()=>exercises.length===425);
  assert.match(await offlinePage.locator('.workout-details[data-id="'+squat+'"] summary').textContent(),/42.75 kg/);
  assert.equal(await offlinePage.getByLabel('Weight unit for Barbell Back Squat',{exact:true}).inputValue(),'kg');
  assert.deepEqual(errors,[]);await browser.close();
  console.log('PASS: optional decimal weight, kilograms/pounds, legacy records, added bodyweight, timed loads, validation, independent entries, summaries, totals, persistence and mobile layout.');
})().catch(error=>{console.error(error);process.exit(1)});
