/* Explicit production verification. Creates two disposable QA accounts;
   random test passwords and sessions stay only in this process. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('dist/cloud-config.js','utf8'),sandbox);const config=sandbox.window.GYM_STONE_CLOUD_CONFIG;
const origin='https://erendragneel.github.io',app=origin+'/gym-stone/dist/';
async function api(endpoint,{token=config.key,method='POST',body,expected=200}={}){
 const response=await fetch(config.url+endpoint,{method,headers:{apikey:config.key,Authorization:'Bearer '+token,Origin:origin,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 const result=await response.json().catch(()=>null);
 assert.equal(response.status,expected,endpoint+' returned '+response.status+' '+(result?.message||result?.msg||result?.error_description||''));return result;
}
(async()=>{
 const suffix=Date.now().toString(36),password=crypto.randomBytes(24).toString('base64url'),users=[];
 await api('/auth/v1/signup',{body:{email:'qa_'+suffix+'short@example.invalid',password:'12345678901',data:{gym_username:'qa_'+suffix+'short'}},expected:422});
 for(const n of ['a','b']){const username='qa_'+suffix+n,email=username+'@example.invalid',s=await api('/auth/v1/signup',{body:{email,password,data:{gym_username:username}}});assert(s.access_token&&s.user?.id,'Signup must return an immediate session');users.push({...s,username,email});}
 const [a,b]=users,login=await api('/functions/v1/gym-login',{body:{username:a.username.toUpperCase(),password}});assert.equal(login.user.id,a.user.id);
 await api('/functions/v1/gym-login',{body:{username:a.username,password:'wrong-password-123'},expected:401});
 await api('/auth/v1/signup',{body:{email:'duplicate_'+suffix+'@example.invalid',password,data:{gym_username:a.username.toUpperCase()}},expected:500});
 const profile={name:'spoof',gender:'female',birthday:'1996-10-05',weight:70,weightUnit:'kg',targetWeight:68,goal:'strength',daysPerWeek:4,minutesPerWorkout:45,hoursPerWeek:3,completed:true,updatedAt:Date.now()};
 const saved=await api('/rest/v1/gym_players?user_id=eq.'+a.user.id,{token:a.access_token,method:'PATCH',body:{profile}});assert.equal(saved[0].profile.name,a.username);
 const isolated=await api('/rest/v1/gym_players?user_id=eq.'+a.user.id,{token:b.access_token,method:'GET'});assert.deepEqual(isolated,[]);
 const day='2026-10-04',entry={id:'live-qa-walk',name:'Walking',done:true,minutes:30,time:'17:30'};
 const first=await api('/rest/v1/rpc/gym_save_workout_day',{token:a.access_token,body:{p_day:day,p_items:[entry],p_revision:0}});assert.equal(first.accepted,true);assert.equal(first.revision,1);
 const stale=await api('/rest/v1/rpc/gym_save_workout_day',{token:login.access_token,body:{p_day:day,p_items:[{...entry,minutes:50}],p_revision:0}});assert.equal(stale.accepted,false);assert.equal(stale.items[0].minutes,30);
 assert.deepEqual(await api('/rest/v1/gym_workout_days?user_id=eq.'+a.user.id,{token:b.access_token,method:'GET'}),[]);
 const prefs=await api('/rest/v1/rpc/gym_save_email_preferences',{token:a.access_token,body:{p_enabled:false,p_days:[1,3],p_time:'18:00',p_timezone:'Asia/Tokyo'}});assert.equal(prefs.enabled,false);
 const browser=await chromium.launch({headless:true,channel:'chrome'}),contexts=[];const errors=[];
 async function device(user){const c=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}});contexts.push(c);await c.route(app+'**',async r=>{let relative=decodeURIComponent(new URL(r.request().url()).pathname.slice('/gym-stone/dist/'.length))||'index.html';const file=path.resolve('dist',relative);if(!file.startsWith(path.resolve('dist')+path.sep))return r.abort();await r.fulfill({path:file});});await c.addInitScript(s=>localStorage.setItem('gym-stone-session-v1',JSON.stringify({access_token:s.access_token,refresh_token:s.refresh_token,expires_at:Math.floor(Date.now()/1000)+s.expires_in,user:{id:s.user.id,email:s.email,username:s.username}})),user);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(app);return p;}
 const p1=await device(a),p2=await device(login.username?login:{...login,username:a.username,email:a.email});await p1.waitForFunction(()=>GymProfile.value.completed);await p2.waitForFunction(()=>GymProfile.value.completed);assert.equal(await p2.evaluate(()=>GymProfile.gender),'female');
 await p1.locator('#player-profile').click();await p1.locator('#profile-next').click();assert.equal(await p1.locator('#enable-email-reminders').isEnabled(),false);assert.match(await p1.locator('#reminder-delivery-note').textContent(),/unavailable/);await p1.locator('#cancel-profile').click();
 await p1.evaluate(d=>selectDay(d),day);await p2.evaluate(d=>selectDay(d),day);await p2.waitForFunction(()=>document.querySelector('#day-hours').textContent==='0.5 h');
 const second=await api('/rest/v1/rpc/gym_save_workout_day',{token:a.access_token,body:{p_day:day,p_items:[{...entry,minutes:45}],p_revision:1}});assert.equal(second.accepted,true);
 await p2.evaluate(()=>GymCalendar.kick(true));await p2.waitForFunction(()=>document.querySelector('#day-hours').textContent==='0.75 h');
 await p2.locator('#search').fill('Bodyweight Glute Bridge');await p2.locator('#mode-done').click();await p2.getByRole('button',{name:'Add to selected day: Bodyweight Glute Bridge',exact:true}).click();await p2.getByLabel('Minutes spent on Bodyweight Glute Bridge',{exact:true}).fill('20');await p2.getByLabel('Minutes spent on Bodyweight Glute Bridge',{exact:true}).press('Tab');await p2.evaluate(async()=>{await GymScreenshotStore.whenIdle();await GymCalendar.kick();});await p2.waitForFunction(()=>document.querySelector('.save-label').textContent.includes('Synced'));
 const edited=await api('/rest/v1/gym_workout_days?user_id=eq.'+a.user.id+'&day=eq.'+day,{token:login.access_token,method:'GET'});assert.equal(edited[0].items.find(i=>i.id==='g0-01_Bodyweight_Glute_Bridge').minutes,20);assert(edited[0].revision<=6,'An accepted JSONB save must leave the outbox, with no repeated self-updates');
 await p1.setViewportSize({width:390,height:844});await p1.screenshot({path:'live-account-mobile-review.png'});await p1.locator('#player-profile').click();await p1.locator('#profile-signout').click();await p1.locator('#account-dialog[open]').waitFor();assert.equal(await p1.locator('#account-recover').isEnabled(),false);await p1.locator('#account-username').fill(a.username);await p1.locator('#account-password').fill(password);await p1.locator('#account-submit').click();await p1.waitForFunction(()=>GymProfile.value.completed);assert.equal(await p1.evaluate(()=>GymCloud.user.username),a.username);
 assert.deepEqual(errors,[]);await browser.close();
 for(const user of users)await api('/auth/v1/logout',{token:user.access_token,expected:204}).catch(()=>{});
 console.log('PASS: real Supabase immediate signup, 12-character minimum, case-insensitive username login/uniqueness, password rejection, private profile and calendar, revision conflicts, two browser devices, linked email, unavailable email reminders/recovery.');
 console.log('Two synthetic QA accounts retained; no passwords or sessions written to disk.');
})().catch(e=>{console.error(e.message);process.exit(1)});
