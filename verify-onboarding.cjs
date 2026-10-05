const {chromium}=require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let current='alice',signupCalls=0;const profiles={alice:null,bob:null},prefs={},names={alice:'Alice_1',bob:'Bob_2'};
  const account=name=>({access_token:'access-'+name,refresh_token:'refresh-'+name,expires_in:3600,user:{id:name,email:name+'@example.com',user_metadata:{gym_username:names[name]}}});
  await page.route('**/cloud-config.js',route=>route.fulfill({contentType:'application/javascript',body:"window.GYM_STONE_CLOUD_CONFIG={url:'https://gym-stone-test.supabase.co',key:'"+'x'.repeat(40)+"',remindersReady:true};"}));
  await page.route('https://gym-stone-test.supabase.co/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname,body=req.postDataJSON(),token=req.headers().authorization||'',who=token.includes('bob')?'bob':'alice';let reply;
    if(path.endsWith('/signup')){signupCalls++;reply=account(current);}
    else if(path.endsWith('/gym-login')){current=body.username.toLowerCase().startsWith('bob')?'bob':'alice';reply=account(current);}
    else if(path.endsWith('/logout'))reply={};
    else if(path.endsWith('/user'))reply=account(who).user;
    else if(path.endsWith('/gym_players')){if(req.method()==='PATCH')profiles[who]=body.profile;reply=[{username:names[who],profile:profiles[who]}];}
    else if(path.endsWith('/gym_workout_days'))reply=[];
    else if(path.endsWith('/gym_save_workout_day'))reply={accepted:true,day:body.p_day,items:body.p_items,revision:body.p_revision+1};
    else if(path.endsWith('/gym_email_preferences'))reply=prefs[who]?[prefs[who]]:[];
    else if(path.endsWith('/gym_save_email_preferences'))reply=prefs[who]={enabled:body.p_enabled,days:body.p_days,reminder_time:body.p_time,timezone:body.p_timezone};
    else if(path.endsWith('/token'))reply=account(current);else reply={};
    await route.fulfill({json:reply});
  });
  await page.goto('http://127.0.0.1:5173');await page.locator('#account-dialog[open]').waitFor();
  await page.locator('#account-username').fill('a');await page.locator('#account-submit').click();assert.equal(signupCalls,0);
  await page.locator('#account-username').fill('Alice_1');await page.locator('#account-email').fill('alice@example.com');await page.locator('#account-password').fill('Test-password-123');await page.locator('#account-confirm').fill('different-password');await page.locator('#account-submit').click();assert.equal(signupCalls,0);
  await page.locator('#account-confirm').fill('Test-password-123');await page.locator('#account-submit').click();await page.locator('#profile-dialog[open]').waitFor();assert.equal(signupCalls,1);
  assert.equal(await page.locator('#profile-name').inputValue(),'Alice_1');
  await page.locator('#profile-next').click();assert.match(await page.locator('#profile-error').textContent(),/birthday/);
  await page.locator('#profile-birthday').fill('1996-10-05');assert.equal(await page.locator('#profile-age').inputValue(),String(await page.evaluate(()=>GymProfileData.age('1996-10-05'))));
  await page.locator('#profile-female').check({force:true});await page.locator('#profile-next').click();
  await page.locator('#profile-weight').fill('155');await page.locator('#profile-weight-unit').selectOption('lb');
  await page.locator('#profile-days').fill('1');assert.match(await page.locator('#profile-days-value').textContent(),/^1 day/);
  await page.locator('#profile-days').fill('7');await page.locator('#enable-minutes').check();await page.locator('#profile-minutes').fill('45');await page.locator('#enable-hours').check();await page.locator('#profile-hours').fill('4.5');
  assert.equal(await page.locator('#enable-email-reminders').isChecked(),false);await page.locator('#enable-email-reminders').check();for(const input of await page.locator('input[name=reminder-day]').all())await input.uncheck();await page.locator('#save-profile').click();assert.match(await page.locator('#profile-error').textContent(),/at least one reminder day/);await page.locator('input[name=reminder-day][value="2"]').check();await page.locator('input[name=reminder-day][value="4"]').check();await page.locator('#reminder-time').fill('08:30');await page.locator('#reminder-zone').selectOption('America/New_York');
  await page.locator('#save-profile').click();await page.locator('#profile-dialog').waitFor({state:'hidden'});
  assert.deepEqual(prefs.alice,{enabled:true,days:[2,4],reminder_time:'08:30',timezone:'America/New_York'});
  assert.deepEqual([profiles.alice.gender,profiles.alice.daysPerWeek,profiles.alice.minutesPerWorkout,profiles.alice.hoursPerWeek,profiles.alice.weightUnit],['female',7,45,4.5,'lb']);
  await page.locator('#search').fill('Bodyweight Glute Bridge');await page.getByRole('button',{name:'Preview Bodyweight Glute Bridge',exact:true}).click();assert.match(await page.locator('#preview-image').getAttribute('src'),/female-/);await page.getByRole('button',{name:'Close exercise preview',exact:true}).click();
  await page.getByRole('button',{name:'Add to selected day: Bodyweight Glute Bridge',exact:true}).click();await page.getByRole('button',{name:'Complete: Bodyweight Glute Bridge',exact:true}).click();await page.getByLabel('Minutes spent on Bodyweight Glute Bridge',{exact:true}).fill('30');await page.getByLabel('Minutes spent on Bodyweight Glute Bridge',{exact:true}).press('Tab');assert.equal(await page.locator('#goal-workout-progress').textContent(),'30 / 45 min');
  await page.reload();await page.waitForFunction(()=>GymProfile.value.completed);assert.equal(await page.locator('#day-hours').textContent(),'0.5 h');assert.equal(await page.evaluate(()=>GymProfile.gender),'female');
  const stored=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));assert(!JSON.stringify(stored).includes('Test-password-123'));
  await page.locator('#player-profile').click();await page.locator('#profile-next').click();assert.equal(await page.locator('#enable-email-reminders').isChecked(),true);assert.equal(await page.locator('#reminder-zone').inputValue(),'America/New_York');await page.locator('#enable-email-reminders').uncheck();await page.locator('#enable-minutes').uncheck();await page.locator('#save-profile').click();await page.locator('#profile-dialog').waitFor({state:'hidden'});assert.equal(profiles.alice.minutesPerWorkout,null);assert.equal(prefs.alice.enabled,false);assert.equal(await page.locator('#goal-workout-metric').isVisible(),false);
  await page.setViewportSize({width:390,height:844});await page.locator('#player-profile').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'onboarding-mobile-review.png'});await page.locator('#profile-next').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'profile-reminders-mobile-review.png'});
  await page.locator('#profile-signout').click();await page.locator('#account-dialog[open]').waitFor();await page.locator('#account-username').fill('Bob_2');await page.locator('#account-password').fill('Test-password-123');await page.locator('#account-submit').click();await page.locator('#profile-dialog[open]').waitFor();assert.equal(await page.locator('.daily-row').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS: startup signup/sign-in, validation, birthday/age, female selection, all goal sliders, both optional targets, online profile requests, no stored passwords, reload and player record isolation (mock backend).');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
