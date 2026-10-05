(() => {
  'use strict';
  const $ = id => document.getElementById(id), baseKey = 'gym-stone-profile-v1';
  let profile = GymProfileData.clean({gender:'male'}), busy = false, step = 0, onboarding = false, loadGeneration = 0;
  let loadPromise=Promise.resolve();
  const defaultEmailPrefs=()=>({enabled:false,days:[1,3,5],reminder_time:'18:00',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'});
  let emailPrefs=defaultEmailPrefs();
  const key = () => window.GymCloud?.user ? baseKey + ':' + GymCloud.user.id : baseKey;
  function apply(value) {
    profile = value;
    $('player-avatar').src = 'assets/characters/' + profile.gender + '-avatar.png';
    $('player-profile').setAttribute('aria-label','Open player profile' + (profile.name?': '+profile.name:''));
    window.dispatchEvent(new CustomEvent('gym-profile-changed',{detail:{...profile}}));
  }
  function load(){return loadPromise=readProfile();}
  async function readProfile() {
    const generation=++loadGeneration,owner=window.GymCloud?.user?.id||'';
    const applyLoaded=value=>{if(generation===loadGeneration&&owner===(window.GymCloud?.user?.id||''))apply(value)};
    let cached = null;
    try {cached = GymProfileData.clean(JSON.parse(localStorage.getItem(key())));} catch {}
    if (window.GymCloud?.user) {
      try {const value=GymProfileData.clean(await GymCloud.loadProfile());if(generation===loadGeneration&&owner===(window.GymCloud?.user?.id||'')){try{localStorage.setItem(key(),JSON.stringify(value));}catch{}applyLoaded(value || cached || GymProfileData.clean({gender:'male'}));}}
      catch {applyLoaded(cached || GymProfileData.clean({gender:'male'}));}
      let prefs=defaultEmailPrefs();try{prefs=JSON.parse(localStorage.getItem('gym-stone-email-prefs:'+owner))||prefs;}catch{}
      try{prefs=await GymCloud.loadEmailPrefs()||prefs;}catch{}
      if(generation===loadGeneration&&owner===(window.GymCloud?.user?.id||'')){emailPrefs=prefs;try{localStorage.setItem('gym-stone-email-prefs:'+owner,JSON.stringify(prefs));}catch{}}
    } else {
      emailPrefs=defaultEmailPrefs();
      try {const saved=GymProfileData.clean(await GymScreenshotStore.getProfile());applyLoaded(saved && (!cached||saved.updatedAt>=cached.updatedAt)?saved:cached||GymProfileData.clean({gender:'male'}));}
      catch {applyLoaded(cached || GymProfileData.clean({gender:'male'}));}
    }
  }
  const ready = (async()=>{await window.GymCloud?.ready;await load();})();
  window.GymProfile={get gender(){return profile.gender;},get name(){return profile.name;},get value(){return {...profile};},ready,open:openProfile};
  function syncChoice() {
    const gender=document.querySelector('input[name="profile-gender"]:checked')?.value||'male';
    $('profile-selection').textContent=(gender==='female'?'Female':'Male')+' anime examples will appear in your exercise library.';
  }
  function syncGoals() {
    const days=Number($('profile-days').value);
    $('profile-days-value').textContent=days+' '+(days===1?'day':'days')+' / week';
    $('profile-minutes-value').textContent=$('profile-minutes').value+' min / workout';
    $('profile-hours-value').textContent=Number($('profile-hours').value)+' h / week';
    for(const field of ['minutes','hours']) {
      $('profile-'+field).disabled=!$('enable-'+field).checked;
      $('goal-'+field).classList.toggle('goal-disabled',!$('enable-'+field).checked);
    }
    $('profile-weight-unit-label').textContent=$('profile-weight-unit').value;
    $('profile-age').value=GymProfileData.age($('profile-birthday').value)??'';
  }
  function showStep(next) {
    step=next;$('profile-error').textContent='';
    for(const section of document.querySelectorAll('[data-profile-step]')) section.hidden=Number(section.dataset.profileStep)!==step;
    $('profile-back').hidden=step===0;$('profile-next').hidden=step===1;$('save-profile').hidden=step===0;
    $('profile-step-label').textContent=step===0?'About you':'Your training goals';
    $('profile-step-number').textContent=(step+1)+' / 2';$('profile-step-bar').style.width=((step+1)*50)+'%';
    $('profile-title').textContent=onboarding?'Build your player profile':'Your player profile';
    if($('profile-dialog').open) $('profile-step-label').focus();
  }
  function populate() {
    $('profile-name').value=window.GymCloud?.user?.username||profile.name;
    $('profile-name').readOnly=!!window.GymCloud?.user;
    $('profile-birthday').max=GymProfileData.localDate();$('profile-birthday').value=profile.birthday;
    $('profile-'+profile.gender).checked=true;
    $('profile-weight').value=profile.weight??'';$('profile-weight-unit').value=profile.weightUnit;
    $('profile-target-weight').value=profile.targetWeight??'';$('profile-goal').value=profile.goal;
    $('profile-days').value=profile.daysPerWeek;
    $('enable-minutes').checked=profile.minutesPerWorkout!==null;$('profile-minutes').value=profile.minutesPerWorkout??30;
    $('enable-hours').checked=profile.hoursPerWeek!==null;$('profile-hours').value=profile.hoursPerWeek??3;
    $('cancel-profile').hidden=onboarding;$('close-profile').hidden=onboarding;
    $('profile-private').textContent=window.GymCloud?.user?'Your profile and goals sync with your Gym Stone account.':'Your preview profile is saved on this device. Sign in to sync a player profile.';
    $('profile-signout').hidden=!window.GymCloud?.user;
    $('email-reminder-settings').hidden=!window.GymCloud?.user;
    $('reminder-email').textContent=window.GymCloud?.user?.email||'your account email';
    $('enable-email-reminders').checked=emailPrefs.enabled===true;
    $('enable-email-reminders').disabled=!GymCloud.remindersReady&&!emailPrefs.enabled;
    const showReminderSchedule=GymCloud.remindersReady||emailPrefs.enabled===true;
    $('email-reminder-settings').querySelector('.reminder-days').hidden=!showReminderSchedule;
    $('email-reminder-settings').querySelector('.profile-fields').hidden=!showReminderSchedule;
    $('reminder-time').value=(emailPrefs.reminder_time||'18:00').slice(0,5);
    for(const input of document.querySelectorAll('input[name="reminder-day"]'))input.checked=(emailPrefs.days||[]).includes(Number(input.value));
    $('reminder-zone').replaceChildren();
    const zones=[...new Set([emailPrefs.timezone,defaultEmailPrefs().timezone,'UTC',...(Intl.supportedValuesOf?.('timeZone')||[])].filter(Boolean))];
    for(const zone of zones){const option=document.createElement('option');option.value=option.textContent=zone;$('reminder-zone').append(option)}
    $('reminder-zone').value=emailPrefs.timezone||defaultEmailPrefs().timezone;
    $('reminder-delivery-note').textContent=GymCloud.remindersReady?'You’ll receive a reminder on selected days when no completed workout is logged. You can turn reminders off anytime.':'Email reminders are currently unavailable. Your account email remains linked to your profile.';
    $('import-previous-history').checked=false;$('previous-history-choice').hidden=true;
    const owner=window.GymCloud?.user?.id;
    if(owner)GymScreenshotStore.guestHistory().then(guest=>{if(owner!==window.GymCloud?.user?.id)return;const count=Object.values(guest.records).flat().length;$('previous-history-choice').hidden=!count;$('previous-history-count').textContent=count+' earlier workout '+(count===1?'entry':'entries')+'. Activity details will sync; screenshot images will stay on this device.';}).catch(()=>{});
    syncChoice();syncGoals();showStep(0);
  }
  async function openProfile(firstTime=false) {const owner=window.GymCloud?.user?.id||'';await ready;await loadPromise;if(GymScreenshotStore.blocked||owner!==(window.GymCloud?.user?.id||'')||(firstTime&&profile.completed))return;onboarding=firstTime;populate();if(!$('profile-dialog').open) $('profile-dialog').showModal();}
  function validateAbout() {
    if(!$('profile-name').value.trim()) {$('profile-name').focus();return 'Enter your player username.';}
    const age=GymProfileData.age($('profile-birthday').value);
    if(age===null||age>120) {$('profile-birthday').focus();return 'Choose a valid birthday to calculate your age.';}
    return '';
  }
  $('player-profile').onclick=()=>window.GymCloud?.configured&&!GymCloud.user?GymCloud.open():openProfile();
  $('profile-next').onclick=()=>{const error=validateAbout();if(error) $('profile-error').textContent=error;else showStep(1);};
  $('profile-back').onclick=()=>showStep(0);
  for(const radio of document.querySelectorAll('input[name="profile-gender"]')) radio.onchange=syncChoice;
  for(const id of ['profile-days','profile-minutes','profile-hours','enable-minutes','enable-hours','profile-weight-unit','profile-birthday']) $(id).addEventListener('input',syncGoals);
  $('profile-form').onsubmit=async event=>{
    event.preventDefault();if(busy)return;
    if(step===0){$('profile-next').click();return;}
    const error=validateAbout();if(error){showStep(0);$('profile-error').textContent=error;return;}
    const weight=Number($('profile-weight').value),target=$('profile-target-weight').value;
    if(!Number.isFinite(weight)||weight<1||weight>1500||(target&&(Number(target)<1||Number(target)>1500))){$('profile-error').textContent='Enter a valid weight in your chosen unit.';return;}
    const next=GymProfileData.clean({name:$('profile-name').value,gender:document.querySelector('input[name="profile-gender"]:checked')?.value,birthday:$('profile-birthday').value,weight,weightUnit:$('profile-weight-unit').value,targetWeight:target?Number(target):null,goal:$('profile-goal').value,daysPerWeek:Number($('profile-days').value),minutesPerWorkout:$('enable-minutes').checked?Number($('profile-minutes').value):null,hoursPerWeek:$('enable-hours').checked?Number($('profile-hours').value):null,completed:true,updatedAt:Date.now()});
    const prefs={enabled:$('enable-email-reminders').checked,days:[...document.querySelectorAll('input[name="reminder-day"]:checked')].map(input=>Number(input.value)),reminder_time:$('reminder-time').value,timezone:$('reminder-zone').value};
    if(window.GymCloud?.user&&prefs.enabled&&(!prefs.days.length||!prefs.reminder_time)){$('profile-error').textContent='Choose at least one reminder day and a valid time.';return;}
    const saveOwner=window.GymCloud?.user?.id||'',saveKey=key();
    // A load started before this edit cannot overwrite its successful save.
    loadGeneration++;
    busy=true;$('save-profile').disabled=true;$('profile-error').textContent='';
    try {
      if(window.GymCloud?.user) await GymCloud.saveProfile(next);else await GymScreenshotStore.putProfile(next);
      try{localStorage.setItem(saveKey,JSON.stringify(next));}catch{}
      if(saveOwner!==(window.GymCloud?.user?.id||''))return;
      if(saveOwner){await GymCloud.saveEmailPrefs(prefs);if(saveOwner!==(window.GymCloud?.user?.id||''))return;emailPrefs=prefs;try{localStorage.setItem('gym-stone-email-prefs:'+saveOwner,JSON.stringify(prefs));}catch{}}
      if(saveOwner&&$('import-previous-history').checked)await GymScreenshotStore.importGuestHistory();
      if(saveOwner!==(window.GymCloud?.user?.id||''))return;
      apply(next);$('profile-dialog').close();onboarding=false;
      if(typeof notify==='function') notify('Profile and goals saved');
    } catch {if(saveOwner!==(window.GymCloud?.user?.id||''))return;$('profile-error').textContent=window.GymCloud?.user?'Your profile could not sync. Keep this window open and try again when connected.':'Your profile could not be saved. Check browser storage and try again.';}
    finally{busy=false;$('save-profile').disabled=false;}
  };
  function close(){if(!onboarding&&!busy)$('profile-dialog').close();}
  $('close-profile').onclick=close;$('cancel-profile').onclick=close;
  $('profile-dialog').addEventListener('cancel',event=>{if(onboarding||busy)event.preventDefault();});
  $('profile-signout').onclick=async()=>{if(busy)return;await GymCloud.signOut();onboarding=false;$('profile-dialog').close();};
  window.addEventListener('gym-account-changed',async()=>{onboarding=false;$('profile-dialog').close();emailPrefs=defaultEmailPrefs();apply(GymProfileData.clean({gender:'male'}));const owner=GymCloud.user?.id||'',generation=loadGeneration+1;await load();if(generation===loadGeneration&&owner===(GymCloud.user?.id||'')&&GymCloud.user&&!profile.completed)openProfile(true);});
  window.addEventListener('storage',event=>{if(event.key!==key()||!event.newValue)return;try{const next=GymProfileData.clean(JSON.parse(event.newValue));if(next&&next.updatedAt>=profile.updatedAt)apply(next);}catch{}});
  ready.then(()=>{if(window.GymCloud?.user&&!profile.completed)openProfile(true);});
})();
