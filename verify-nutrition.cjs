const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173';
const CACHE_KEY = 'gym-stone-nutrition-v1';
const DAY_A = '2026-10-05';
const DAY_B = '2026-10-06';
const totalExercises = JSON.parse(fs.readFileSync(path.join(__dirname, 'dist/exercises.json'), 'utf8')).length;
const completeProfile = {
  name:'Nutrition tester', gender:'female', birthday:'1996-10-05', weight:65,
  weightUnit:'kg', targetWeight:null, goal:'stay-active', daysPerWeek:3,
  minutesPerWorkout:null, hoursPerWeek:null, completed:true, updatedAt:Date.now()
};
const emptyCloud = "window.GYM_STONE_CLOUD_CONFIG={url:'',key:''};";

async function makeContext(browser, options={}) {
  const context = await browser.newContext({
    serviceWorkers:'block', viewport:{width:1440,height:1100},
    timezoneId:'Asia/Tokyo', locale:'en-US', ...options
  });
  await context.route('**/cloud-config.js', route=>route.fulfill({contentType:'application/javascript',body:emptyCloud}));
  await context.addInitScript(profile=>{
    for (const suffix of ['', ':nutrition-player-a', ':nutrition-player-b']) {
      const key='gym-stone-profile-v1'+suffix;
      if (!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(profile));
    }
  }, completeProfile);
  return context;
}

async function boot(page) {
  await page.goto(BASE_URL);
  await page.waitForFunction(()=>window.GymNutrition && window.GymScreenshotStore?.getNutrition);
  await page.evaluate(()=>GymNutrition.ready);
  await page.locator('#account-dialog').waitFor({state:'visible'});
  await page.locator('#account-preview').click();
  await page.waitForFunction(total=>document.querySelectorAll('.exercise-card').length===total,totalExercises);
  assert.equal(await page.locator('#profile-dialog').isVisible(),false,'Completed guest profile should skip onboarding');
  await page.locator('.app-nav [data-screen="nutrition"]').click();
  await page.locator('#nutrition-section').waitFor({state:'visible'});
  assert.equal(await page.locator('body').getAttribute('data-screen'),'nutrition');
  assert.equal(await page.locator('.app-nav [data-screen="nutrition"]').getAttribute('aria-current'),'page');
}

async function selectDate(page, date) {
  await page.locator('#nutrition-date').fill(date);
  await page.locator('#nutrition-date').press('Tab');
  await page.waitForFunction(date=>selected===date && document.querySelector('#nutrition-date').value===date,date);
  assert.equal(await page.locator('#progress-date').inputValue(),date,'Nutrition and workout dates should stay aligned');
}

async function snapshot(page) {
  return page.evaluate(()=>GymNutrition.value);
}

async function readStored(page) {
  await page.evaluate(()=>GymScreenshotStore.whenIdle());
  return page.evaluate(()=>GymScreenshotStore.getNutrition());
}

async function expectTotals(page, values) {
  for (const [name,value] of Object.entries(values)) {
    const id=name==='water' ? 'nutrition-water-total' : 'nutrition-total-'+name;
    await page.waitForFunction(({id,value})=>{
      const text=document.getElementById(id)?.textContent || '';
      const numeric=Number(text.replace(/,/g,'').match(/-?\d+(?:\.\d+)?/)?.[0]);
      return numeric===value;
    },{id,value});
    const text=(await page.locator('#'+id).textContent()).replace(/,/g,'');
    assert.equal(Number(text.match(/-?\d+(?:\.\d+)?/)?.[0]),value,`${name} total`);
  }
}

async function fillMeal(page, meal) {
  await page.locator('#nutrition-name').fill(meal.name);
  await page.locator('#nutrition-meal').selectOption(meal.meal || 'snack');
  await page.locator('#nutrition-serving').fill(meal.serving || '');
  for (const name of ['calories','protein','carbs','fat']) {
    await page.locator('#nutrition-'+name).fill(meal[name]==null ? '' : String(meal[name]));
  }
}

async function addMeal(page, meal) {
  await page.locator('#nutrition-add').click();
  await page.locator('#nutrition-entry-dialog').waitFor({state:'visible'});
  await fillMeal(page,meal);
  await page.locator('#nutrition-entry-save').click();
  await page.locator('#nutrition-entry-dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Edit '+meal.name,exact:true}).waitFor({state:'visible'});
}

async function addWater(page, amount) {
  const before=await snapshot(page);
  const date=await page.locator('#nutrition-date').inputValue();
  const count=before.days[date]?.water.length || 0;
  await page.locator('#nutrition-water-amount').fill(String(amount));
  await page.locator('#nutrition-water-add').click();
  await page.waitForFunction(({date,count})=>GymNutrition.value.days[date]?.water.length===count+1,{date,count});
}

async function assertNoOverflow(page, label) {
  const widths=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert(widths.document<=widths.viewport && widths.body<=widths.viewport,`${label}: page overflow ${JSON.stringify(widths)}`);
  for (const dialog of ['#nutrition-entry-dialog','#nutrition-goals-dialog']) {
    if (await page.locator(dialog).isVisible()) {
      const bounds=await page.locator(dialog).evaluate(el=>{
        const r=el.getBoundingClientRect();
        return {left:r.left,right:r.right,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
      });
      assert(bounds.left>=-1 && bounds.right<=widths.viewport+1,`${label}: dialog exceeds viewport`);
      assert(bounds.scrollWidth<=bounds.clientWidth+1,`${label}: dialog content overflows`);
    }
  }
}

async function verifyTracker(browser) {
  const context=await makeContext(browser), page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await boot(page);
    const today=await page.locator('#nutrition-date').inputValue();
    await selectDate(page,DAY_A);
    await expectTotals(page,{calories:0,protein:0,carbs:0,fat:0,water:0});
    assert.deepEqual((await snapshot(page)).goals,{calories:null,protein:null,carbs:null,fat:null,water:null},'No personal targets are assigned by default');

    const oats={name:'Oats and yogurt',meal:'breakfast',serving:'1 bowl',calories:420,protein:20,carbs:60,fat:10};
    const rice={name:'Chicken rice bowl',meal:'lunch',serving:'1 plate',calories:650,protein:42,carbs:75,fat:20};
    await addMeal(page,oats);
    await addMeal(page,rice);
    await expectTotals(page,{calories:1070,protein:62,carbs:135,fat:30});
    await page.getByRole('button',{name:'Edit '+oats.name,exact:true}).click();
    assert.equal(await page.locator('#nutrition-serving').inputValue(),'1 bowl');
    assert.equal(await page.locator('#nutrition-meal').inputValue(),'breakfast');
    await fillMeal(page,{...oats,calories:450,protein:22,carbs:62,fat:12});
    await page.locator('#nutrition-entry-save').click();
    await page.locator('#nutrition-entry-dialog').waitFor({state:'hidden'});
    await expectTotals(page,{calories:1100,protein:64,carbs:137,fat:32});
    await page.getByRole('button',{name:'Delete '+rice.name,exact:true}).click();
    await expectTotals(page,{calories:450,protein:22,carbs:62,fat:12});
    assert.equal((await snapshot(page)).days[DAY_A].meals.length,1);

    await addMeal(page,{name:'Fruit with unknown macros',calories:90});
    await expectTotals(page,{calories:540,protein:22,carbs:62,fat:12});
    const fruit=(await snapshot(page)).days[DAY_A].meals.find(meal=>meal.name==='Fruit with unknown macros');
    assert.equal(fruit.protein,null);assert.equal(fruit.carbs,null);assert.equal(fruit.fat,null);
    assert.match(await page.locator('#nutrition-section').innerText(),/partial|missing|unknown|not logged|not entered|incomplete/i,'Incomplete macro totals must be labelled');
    await page.getByRole('button',{name:'Delete Fruit with unknown macros',exact:true}).click();

    const plainName='Apple <img src=x onerror=window.__nutritionInjected=1>';
    await addMeal(page,{name:plainName,meal:'snack',serving:'1 apple',calories:50,protein:0,carbs:14,fat:0});
    await expectTotals(page,{calories:500,protein:22,carbs:76,fat:12});
    assert.equal(await page.locator('#nutrition-section img[src="x"]').count(),0,'Meal names are rendered as plain text');
    assert.equal(await page.evaluate(()=>window.__nutritionInjected),undefined);
    assert((await page.locator('#nutrition-section').innerText()).includes(plainName));

    await addWater(page,250);await addWater(page,500);
    await expectTotals(page,{water:750});
    await page.locator('#nutrition-water-undo').click();await expectTotals(page,{water:250});
    await page.locator('#nutrition-water-undo').click();await expectTotals(page,{water:0});
    assert.equal((await snapshot(page)).days[DAY_A].water.length,0);
    await addWater(page,375);await expectTotals(page,{water:375});
    assert.match(await page.locator('.nutrition-water-number').textContent(),/mL/i);

    await page.locator('#nutrition-goals-open').click();
    for (const [name,value] of Object.entries({calories:'450',protein:'',carbs:'90',fat:'',water:'200'})) {
      await page.locator('#nutrition-goal-'+name).fill(value);
    }
    await page.locator('#nutrition-goals-save').click();
    await page.locator('#nutrition-goals-dialog').waitFor({state:'hidden'});
    assert.deepEqual((await snapshot(page)).goals,{calories:450,protein:null,carbs:90,fat:null,water:200});
    assert.match(await page.locator('#nutrition-section').innerText(),/over(?: (?:your|the))? goal|above(?: (?:your|the))? goal/i,'Exceeding a user target should be presented clearly');

    await page.locator('#nutrition-add').click();
    await fillMeal(page,{name:'Invalid calories',calories:-5,protein:1,carbs:1,fat:1});
    const beforeInvalid=await snapshot(page);
    await page.locator('#nutrition-entry-save').click();
    assert.equal(await page.locator('#nutrition-entry-dialog').isVisible(),true,'Negative calories must keep the form open');
    assert.deepEqual(await snapshot(page),beforeInvalid,'Invalid nutrition cannot alter saved data');
    await page.locator('#nutrition-calories').fill('10');
    await page.locator('#nutrition-protein').fill('-1');
    await page.locator('#nutrition-entry-save').click();
    assert.equal(await page.locator('#nutrition-entry-dialog').isVisible(),true);
    assert.deepEqual(await snapshot(page),beforeInvalid,'Negative macros cannot be saved');
    await page.keyboard.press('Escape');
    const beforeWater=await snapshot(page);
    await page.locator('#nutrition-water-amount').fill('-10');await page.locator('#nutrition-water-add').click();
    assert.deepEqual(await snapshot(page),beforeWater,'Negative water amounts cannot be saved');

    await selectDate(page,DAY_B);await expectTotals(page,{calories:0,protein:0,carbs:0,fat:0,water:0});
    await addMeal(page,{name:'Soup',meal:'dinner',calories:200,protein:12,carbs:20,fat:8});await addWater(page,100);
    await selectDate(page,DAY_A);await expectTotals(page,{calories:500,protein:22,carbs:76,fat:12,water:375});
    await page.locator('.app-nav [data-screen="calendar"]').click();
    await page.getByRole('button',{name:/^Tuesday, October 6, 2026,/}).click();
    await page.locator('.app-nav [data-screen="nutrition"]').click();
    assert.equal(await page.locator('#nutrition-date').inputValue(),DAY_B,'Calendar selection changes the nutrition date');
    await expectTotals(page,{calories:200,water:100});
    await page.locator('#nutrition-today').click();
    assert.equal(await page.locator('#nutrition-date').inputValue(),today);
    await selectDate(page,DAY_A);

    const saved=await snapshot(page);
    assert.equal(saved.version,1);
    assert.deepEqual(await readStored(page),saved,'IndexedDB snapshot matches the displayed nutrition');
    assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),CACHE_KEY),saved,'Local cache mirrors the saved snapshot');
    await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({version:1,goals:{calories:null,protein:null,carbs:null,fat:null,water:null},days:{}})),CACHE_KEY);
    await page.reload();
    await page.evaluate(()=>GymNutrition.ready);
    await page.locator('#account-preview').click();
    await page.waitForFunction(total=>document.querySelectorAll('.exercise-card').length===total,totalExercises);
    await page.locator('.app-nav [data-screen="nutrition"]').click();await selectDate(page,DAY_A);
    assert.deepEqual(await snapshot(page),saved,'Authoritative IndexedDB records and targets survive reload even with a stale cache');
    await expectTotals(page,{calories:500,protein:22,carbs:76,fat:12,water:375});
    await page.evaluate(({key,saved})=>localStorage.setItem(key,JSON.stringify(saved)),{key:CACHE_KEY,saved});

    await page.evaluate(()=>{
      window.__nutritionRealPut=GymScreenshotStore.putNutrition;
      GymScreenshotStore.putNutrition=async()=>{throw new DOMException('Storage quota exhausted','QuotaExceededError');};
    });
    await page.locator('#nutrition-add').click();
    await fillMeal(page,{name:'Quota failure meal',calories:100,protein:2,carbs:5,fat:3});
    await page.locator('#nutrition-entry-save').click();
    await page.waitForFunction(()=>!document.querySelector('#nutrition-entry-save').disabled);
    assert.equal(await page.locator('#nutrition-entry-dialog').isVisible(),true,'Failed save keeps the editable meal open');
    assert.deepEqual(await snapshot(page),saved,'A rejected storage write rolls back the nutrition state');
    assert.deepEqual(await readStored(page),saved,'Quota failure leaves the authoritative saved snapshot intact');
    assert.match((await page.locator('#nutrition-entry-dialog').innerText())+' '+(await page.locator('#nutrition-section').innerText()),/could not|cannot|couldn't|failed|unable|storage/i,'Failed save is visible to the user');
    await page.evaluate(()=>{GymScreenshotStore.putNutrition=window.__nutritionRealPut;delete window.__nutritionRealPut;});
    await page.keyboard.press('Escape');
    await expectTotals(page,{calories:500,water:375});
    await page.locator('#nutrition-goals-open').click();
    await page.locator('#nutrition-goals-save').click();
    await page.locator('#nutrition-goals-dialog').waitFor({state:'hidden'});
    assert.deepEqual(await snapshot(page),saved,'A successful retry keeps the intended diary');
    assert.equal(await page.locator('#nutrition-error').textContent(),'','A subsequent successful write clears the failure status');

    for (const width of [390,320]) {
      await page.setViewportSize({width,height:844});
      await assertNoOverflow(page,`Nutrition at ${width}px`);
      await page.locator('#nutrition-add').click();
      await fillMeal(page,{name:plainName,calories:50,protein:0,carbs:14,fat:0});
      await assertNoOverflow(page,`Meal dialog at ${width}px`);
      await page.keyboard.press('Escape');
      await page.locator('#nutrition-goals-open').click();
      await assertNoOverflow(page,`Goals dialog at ${width}px`);
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({width:1440,height:1100});

    async function switchPlayer(id) {
      await page.evaluate(({id,profile})=>{
        Object.defineProperty(GymCloud,'user',{configurable:true,value:id?{id,username:'Nutrition tester',email:'nutrition@example.invalid'}:null});
        GymCloud.loadProfile=async()=>({...profile});GymCloud.loadEmailPrefs=async()=>null;
        window.dispatchEvent(new Event('gym-account-changed'));
      },{id,profile:completeProfile});
      await page.evaluate(()=>GymNutrition.ready);
      await selectDate(page,DAY_A);
    }
    await switchPlayer('nutrition-player-a');
    await expectTotals(page,{calories:0,water:0});
    assert.equal((await snapshot(page)).goals.calories,null,'New player does not inherit guest targets');
    await addMeal(page,{name:'Player A meal',calories:111,protein:1,carbs:2,fat:3});
    const playerA=await snapshot(page);assert.deepEqual(await readStored(page),playerA);
    await switchPlayer('nutrition-player-b');await expectTotals(page,{calories:0,water:0});
    await addMeal(page,{name:'Player B meal',calories:222,protein:4,carbs:5,fat:6});
    const playerB=await snapshot(page);assert.deepEqual(await readStored(page),playerB);
    await switchPlayer('nutrition-player-a');assert.deepEqual(await snapshot(page),playerA);await expectTotals(page,{calories:111});
    await switchPlayer(null);assert.deepEqual(await snapshot(page),saved);await expectTotals(page,{calories:500,water:375});
    const caches=await page.evaluate(key=>['',':nutrition-player-a',':nutrition-player-b'].map(suffix=>JSON.parse(localStorage.getItem(key+suffix))),CACHE_KEY);
    assert.deepEqual(caches,[saved,playerA,playerB],'Guest and player caches remain separate');
    assert.deepEqual(errors,[]);
    console.log('PASS: nutrition CRUD, macro totals and unknown values, plain-text names, hydration undo, optional goals, invalid values, selected-day isolation, reload, atomic quota failures, player isolation, and mobile widths 320/390.');
  } finally {await context.close();}
}

async function verifyOffline(browser) {
  const context=await makeContext(browser,{serviceWorkers:'allow'}), page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await boot(page);
    const resources=await page.evaluate(()=>Array.from(document.querySelectorAll('script[src],link[href]')).map(el=>el.src||el.href).filter(url=>/nutrition\.(?:js|css)(?:\?|$)/.test(url)));
    assert(resources.some(url=>/nutrition\.js/.test(url)) && resources.some(url=>/nutrition\.css/.test(url)),'Nutrition is loaded as an app module and stylesheet');
    await page.evaluate(async()=>{await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;});
    await page.waitForFunction(()=>navigator.serviceWorker.controller);
    await page.waitForFunction(async resources=>{
      const keys=await caches.keys();
      const available=await Promise.all(resources.map(async url=>{
        for (const key of keys) if(await (await caches.open(key)).match(url))return true;
        return false;
      }));
      return available.every(Boolean);
    },resources);
    // Service worker installation fetches independently of Playwright's route.
    // Keep its cached account configuration stubbed too, so the offline UI is a guest preview.
    await page.evaluate(async body=>{
      for (const key of await caches.keys()) {
        const cache=await caches.open(key);
        for (const request of await cache.keys()) {
          if (new URL(request.url).pathname.endsWith('/cloud-config.js')) {
            await cache.put(request,new Response(body,{headers:{'Content-Type':'application/javascript'}}));
          }
        }
      }
    },emptyCloud);
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(()=>window.GymNutrition && window.GymNavigation);
    await page.evaluate(()=>GymNutrition.ready);
    await page.locator('#account-preview').click();
    await page.waitForFunction(total=>document.querySelectorAll('.exercise-card').length===total,totalExercises);
    await page.locator('.app-nav [data-screen="nutrition"]').click();await selectDate(page,DAY_A);
    await addMeal(page,{name:'Offline meal',calories:80,protein:3,carbs:10,fat:2});
    await addWater(page,150);await expectTotals(page,{calories:80,protein:3,carbs:10,fat:2,water:150});
    const saved=await snapshot(page);assert.deepEqual(await readStored(page),saved);
    await page.reload();await page.waitForFunction(()=>window.GymNutrition);await page.evaluate(()=>GymNutrition.ready);
    await page.locator('#account-preview').click();
    await page.locator('.app-nav [data-screen="nutrition"]').click();await selectDate(page,DAY_A);
    assert.deepEqual(await snapshot(page),saved,'Offline nutrition edits survive an offline reload');
    await expectTotals(page,{calories:80,water:150});
    assert.deepEqual(errors,[]);
    console.log('PASS: service worker caches the nutrition JS/CSS; offline app load, meal/water saving and reload persistence.');
  } finally {await context.close();}
}

async function captureScreenshots(browser) {
  const context=await makeContext(browser), page=await context.newPage();
  try {
    await boot(page);
    await addMeal(page,{name:'Oats and yogurt',meal:'breakfast',serving:'1 bowl',calories:450,protein:22,carbs:62,fat:12});
    await addMeal(page,{name:'Chicken rice bowl',meal:'lunch',serving:'1 plate',calories:650,protein:42,carbs:75,fat:20});
    await addMeal(page,{name:'Apple',meal:'snack',serving:'1 medium apple',calories:95,protein:0,carbs:25,fat:0});
    await addWater(page,350);await addWater(page,650);
    await page.locator('#nutrition-goals-open').click();
    for (const [name,value] of Object.entries({calories:2100,protein:120,carbs:250,fat:70,water:2000})) {
      await page.locator('#nutrition-goal-'+name).fill(String(value));
    }
    await page.locator('#nutrition-goals-save').click();await page.locator('#nutrition-goals-dialog').waitFor({state:'hidden'});
    await expectTotals(page,{calories:1195,protein:64,carbs:162,fat:32,water:1000});
    assert.equal(await page.locator('#nutrition-error').textContent(),'');
    await page.screenshot({path:path.join(__dirname,'nutrition-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await assertNoOverflow(page,'Example diary at 390px');
    await page.screenshot({path:path.join(__dirname,'nutrition-mobile.png'),fullPage:true});
    console.log('PASS: clean saved example diary screenshots created at desktop and 390px mobile.');
  } finally {await context.close();}
}

(async()=>{
  assert.equal(totalExercises,425,'Current expanded exercise library should remain intact');
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try {
    if (!process.argv.includes('--screenshots-only')) {await verifyTracker(browser);await verifyOffline(browser);}
    await captureScreenshots(browser);
  }
  finally {await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
