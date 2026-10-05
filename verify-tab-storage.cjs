const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.join(__dirname, 'dist');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
const origin = 'https://gym-stone-audit.invalid';
const calendarHtml = '<!doctype html><button id="review-sync"></button><button id="close-sync"></button><dialog id="sync-dialog"></dialog><div id="sync-conflicts"></div>';

async function verifyStorage(browser) {
  const context = await browser.newContext({serviceWorkers:'block'});
  const errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  await context.route(origin + '/**', route => route.fulfill({contentType:'text/html', body:calendarHtml}));
  async function boot(page, owner, initialize=true) {
    await page.goto(origin + '/');
    await page.evaluate(id => {
      window.GymCloud = {user:id ? {id} : null,
        loadCalendar:async()=>{throw Error('offline');},
        saveCalendarDay:async()=>{throw Error('offline');}};
    }, owner);
    await page.addScriptTag({content:source('screenshot-store.js')});
    await page.addScriptTag({content:source('cloud-calendar.js')});
    if (initialize) await page.evaluate(async()=>{
      await GymCalendar.start(await GymScreenshotStore.getRecords() || {});
      await GymCalendar.kick(true);
    });
  }
  const a = await context.newPage(), b = await context.newPage();
  await boot(a, 'same-player');
  assert.equal(await a.evaluate(()=>!!navigator.locks), true);
  const first = {'2026-10-01':[{id:'exercise-a',done:true,minutes:20}]};
  const both = {...first, '2026-10-02':[{id:'exercise-b',done:true,minutes:30}]};
  await a.evaluate(async records=>{await GymScreenshotStore.putRecords(records);await GymCalendar.kick();}, first);
  await boot(b, 'same-player', false);
  const rejected = await b.evaluate(async records=>{
    const failures = {};
    for(const [name,operation] of [['read',()=>GymScreenshotStore.getRecords()], ['write',()=>GymScreenshotStore.putRecords(records)]]) {
      try {await operation();failures[name]=false;} catch {failures[name]=true;}
    }
    return {...failures,blocked:GymScreenshotStore.blocked,dialog:document.getElementById('storage-tab-dialog')?.open};
  }, {'2026-10-02':both['2026-10-02']});
  assert.deepEqual(rejected, {read:true,write:true,blocked:true,dialog:true});
  await b.evaluate(()=>{
    document.getElementById('storage-tab-dialog').dispatchEvent(new Event('cancel',{cancelable:true}));
  });
  assert.equal(await b.evaluate(()=>document.getElementById('storage-tab-dialog').open), true);
  assert.deepEqual(await a.evaluate(()=>GymScreenshotStore.getRecords()), first);
  await a.close();
  await boot(b, 'same-player');
  const recovered = await b.evaluate(async()=>({records:await GymScreenshotStore.getRecords(),meta:await GymScreenshotStore.getCalendarMeta()}));
  assert.deepEqual(recovered.records, first);
  assert.deepEqual(recovered.meta.pending['2026-10-01'], first['2026-10-01']);
  await b.evaluate(async records=>{await GymScreenshotStore.putRecords(records);await GymCalendar.kick();}, both);
  const saved = await b.evaluate(async()=>({records:await GymScreenshotStore.getRecords(),meta:await GymScreenshotStore.getCalendarMeta()}));
  assert.deepEqual(saved.records, both);
  assert.deepEqual(saved.meta.pending['2026-10-01'], both['2026-10-01']);
  assert.deepEqual(saved.meta.pending['2026-10-02'], both['2026-10-02']);
  const other = await context.newPage();
  await boot(other, 'different-player');
  const separate = {'2026-10-03':[{id:'exercise-c',done:true,minutes:40}]};
  await other.evaluate(async records=>{await GymScreenshotStore.putRecords(records);await GymCalendar.kick();}, separate);
  assert.deepEqual(await other.evaluate(()=>GymScreenshotStore.getRecords()), separate);
  assert.deepEqual(await b.evaluate(()=>GymScreenshotStore.getRecords()), both);
  const leases = await b.evaluate(async()=> (await navigator.locks.query()).held.map(lock=>lock.name));
  assert(leases.includes('gym-stone-editor:gym-stone-records:same-player'));
  assert(leases.includes('gym-stone-editor:gym-stone-records:different-player'));
  await b.evaluate(async()=>{
    GymCloud.user=null;GymCalendar.reset();window.dispatchEvent(new Event('gym-account-changed'));
    await GymScreenshotStore.getRecords();
  });
  await b.waitForFunction(async()=>!(await navigator.locks.query()).held.some(lock=>lock.name==='gym-stone-editor:gym-stone-records:same-player'));
  const afterLogout = await context.newPage();
  await boot(afterLogout, 'same-player');
  const preserved = await afterLogout.evaluate(async()=>({records:await GymScreenshotStore.getRecords(),meta:await GymScreenshotStore.getCalendarMeta()}));
  assert.deepEqual(preserved.records, both);
  assert.deepEqual(preserved.meta.pending, saved.meta.pending);
  assert.deepEqual(await other.evaluate(()=>GymScreenshotStore.getRecords()), separate);
  assert.deepEqual(errors, []);
  console.log('PASS: second same-player tab is blocked for reads/writes; closing the first tab preserves offline records/outbox on retry; successor saves both days; different players hold separate leases; logout releases the old lease without losing pending days.');
  await context.close();
}

async function verifyProfile(browser) {
  const context = await browser.newContext({serviceWorkers:'block'});
  const page = await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const html = source('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
  await context.route(origin+'/**', route=>route.request().resourceType()==='document'
    ? route.fulfill({contentType:'text/html',body:html}) : route.fulfill({status:204,body:''}));
  await page.goto(origin+'/');
  await page.evaluate(()=>{
    window.profileValue=(name,weight,updatedAt=1)=>({name,gender:'female',birthday:'1990-01-01',weight,weightUnit:'kg',targetWeight:null,goal:'strength',daysPerWeek:4,minutesPerWorkout:30,hoursPerWeek:3,completed:true,updatedAt});
    window.GymCloud={configured:true,user:{id:'player-a',username:'Alice',email:'a@example.invalid'},ready:Promise.resolve(),remindersReady:false,
      loadProfile:async()=>profileValue('Alice',70),loadEmailPrefs:async()=>null,
      saveProfile:async value=>{window.savedProfile=structuredClone(value);return value;},saveEmailPrefs:async value=>value};
    window.GymScreenshotStore={blocked:false,guestHistory:async()=>({records:{},screenshots:[]}),getProfile:async()=>null,putProfile:async value=>value};
  });
  await page.addScriptTag({content:source('profile-data.js')});
  // Expose the existing private load function only in this test's in-memory copy.
  // No application source is edited; this lets us settle a response after a save.
  const profileSource=source('player-profile.js');
  assert(profileSource.includes('  const ready ='));
  await page.addScriptTag({content:profileSource.replace('  const ready =','  window.__reviewReload=load;\n  const ready =')});
  await page.evaluate(()=>GymProfile.ready);
  await page.evaluate(()=>{
    GymCloud.user={id:'player-b',username:'Bob',email:'b@example.invalid'};
    GymCloud.loadProfile=()=>new Promise(resolve=>{window.resolveProfile=resolve;});
    window.dispatchEvent(new Event('gym-account-changed'));
    window.openFinished=false;window.pendingOpen=GymProfile.open().then(()=>{openFinished=true;});
  });
  assert.equal(await page.evaluate(()=>openFinished),false);
  assert.equal(await page.evaluate(()=>document.getElementById('profile-dialog').open),false);
  await page.evaluate(async()=>{resolveProfile(profileValue('Bob',75));await pendingOpen;});
  assert.equal(await page.locator('#profile-name').inputValue(),'Bob');
  assert.equal(await page.locator('#profile-weight').inputValue(),'75');
  assert.equal(await page.evaluate(()=>document.getElementById('profile-dialog').open),true);
  await page.evaluate(()=>{
    GymCloud.loadProfile=()=>new Promise(resolve=>{window.resolveOldLoad=resolve;});
    window.oldLoad=__reviewReload();
    document.getElementById('profile-weight').value='81';
    document.getElementById('profile-next').click();
    document.getElementById('profile-form').requestSubmit();
  });
  await page.waitForFunction(()=>GymProfile.value.weight===81&&!document.getElementById('profile-dialog').open);
  await page.evaluate(async()=>{resolveOldLoad(profileValue('Bob',75,1));await oldLoad;});
  assert.equal(await page.evaluate(()=>GymProfile.value.weight),81);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gym-stone-profile-v1:player-b')).weight),81);
  assert.equal(await page.evaluate(()=>savedProfile.weight),81);
  await page.evaluate(()=>{GymScreenshotStore.blocked=true;});
  await page.evaluate(()=>GymProfile.open());
  assert.equal(await page.evaluate(()=>document.getElementById('profile-dialog').open),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: opening a switched player profile waits for the pending load; delayed pre-edit profile responses cannot overwrite the saved profile or cache; blocked storage suppresses the profile dialog.');
  await context.close();
}

(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try {await verifyStorage(browser);await verifyProfile(browser);}
  finally {await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
