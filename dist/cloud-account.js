(() => {
  'use strict';
  const $=id=>document.getElementById(id), config=window.GYM_STONE_CLOUD_CONFIG||{}, sessionKey='gym-stone-session-v1';
  const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url||'') && typeof config.key==='string' && config.key.length>30;
  const base=String(config.url||'').replace(/\/$/,''), dialog=$('account-dialog');
  let session=null, mode='signup',busy=false,refreshing=null;
  try {const cached=JSON.parse(localStorage.getItem(sessionKey));if(cached?.access_token&&cached?.user?.id)session=cached;}catch{}
  async function request(path,{method='POST',body=null,token=null}={}) {
    if(!configured)throw Error('Online accounts are being connected. Please try again after setup is complete.');
    const response=await fetch(base+path,{method,headers:{apikey:config.key,'Content-Type':'application/json',Authorization:'Bearer '+(token||config.key)},body:body===null?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000),cache:'no-store'});
    let payload=null;try{payload=await response.json();}catch{}
    if(!response.ok){const error=Error(payload?.error_description||payload?.msg||payload?.message||payload?.error||'Account request failed. Please try again.');error.status=response.status;throw error;}
    return payload;
  }
  function normalize(value) {
    if(!value?.access_token||!value?.user?.id)return null;
    return {access_token:value.access_token,refresh_token:value.refresh_token||'',expires_at:Number(value.expires_at)||Math.floor(Date.now()/1000)+Number(value.expires_in||3600),user:{id:value.user.id,email:value.user.email||'',username:value.user.user_metadata?.gym_username||value.user.username||''}};
  }
  function saveSession(value,announce=true) {
    session=value;
    try{if(value)localStorage.setItem(sessionKey,JSON.stringify(value));else localStorage.removeItem(sessionKey);}catch{}
    if(announce)window.dispatchEvent(new CustomEvent('gym-account-changed',{detail:{authenticated:!!session,user:session?.user||null}}));
  }
  async function validSession() {
    if(!session)throw Error('Sign in to save your player profile online.');
    if(session.expires_at>Math.floor(Date.now()/1000)+60)return session;
    const previous=session,owner=previous.user.id;
    if(!refreshing||refreshing.owner!==owner){
      const refresh={owner,promise:null};refreshing=refresh;
      refresh.promise=(async()=>{try{const next=normalize(await request('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:previous.refresh_token}}));if(session?.user.id!==owner||session.refresh_token!==previous.refresh_token)throw Error('The signed-in player changed.');if(!next)throw Error('Please sign in again.');saveSession(next,false);return next;}catch(error){if(session?.user.id===owner&&(error.status===400||error.status===401))saveSession(null);throw error;}finally{if(refreshing===refresh)refreshing=null;}})();
    }
    return refreshing.promise;
  }
  async function bootstrap() {
    if(!configured){session=null;return;}
    // Confirmation/recovery redirects use short-lived provider tokens, never passwords.
    const hash=new URLSearchParams(location.hash.slice(1));
    if(hash.has('access_token')) {
      const access=hash.get('access_token'),refresh=hash.get('refresh_token')||'', recovery=hash.get('type')==='recovery';
      history.replaceState(null,'',location.pathname+location.search);
      try{const user=await request('/auth/v1/user',{method:'GET',token:access});saveSession(normalize({access_token:access,refresh_token:refresh,expires_in:hash.get('expires_in'),user}),false);if(recovery){mode='password';open();}}
      catch{saveSession(null,false);$('account-status').textContent='This account link expired. Request a new one.';open();}
    } else if(session) {
      try{const current=await validSession(),user=await request('/auth/v1/user',{method:'GET',token:current.access_token});saveSession(normalize({...current,user}),false);}
      catch(error){if(error.status===401||error.status===403)saveSession(null,false);}
    }
  }
  function setMode(next) {
    mode=next;
    const signup=mode==='signup',recover=mode==='recover',password=mode==='password';
    $('account-title').textContent=signup?'Start your workout quest':recover?'Recover your account':password?'Choose a new password':'Welcome back';
    $('account-submit').textContent=signup?'Create account →':recover?'Send recovery email':password?'Save new password':'Sign in →';
    $('account-username-label').hidden=recover||password;$('account-email-label').hidden=!(signup||recover);
    $('account-password-label').hidden=recover;$('account-confirm-label').hidden=!(signup||password);
    $('account-password').autocomplete=signup||password?'new-password':'current-password';
    $('account-password').minLength=signup||password?8:1;
    $('account-password').placeholder=signup||password?'At least 8 characters':'Enter your password';
    resetPasswordVisibility();
    $('account-switch').hidden=password;$('account-recover').hidden=mode!=='signin';
    $('account-recover').textContent=config.emailDeliveryReady===true?'Forgot password?':'Password recovery is currently unavailable';
    $('account-recover').disabled=config.emailDeliveryReady!==true;
    $('account-switch').textContent=signup?'Already have an account? Sign in':'New player? Create an account';
    $('account-note').textContent=signup?'Your email links your account across devices. Your birthday, weight and goals are private. '+(config.emailDeliveryReady===true?'Email confirmation and password recovery are available.':'Keep your password safe: email verification, recovery emails and email reminders are currently unavailable.'):recover?'Enter the email address used to create your Gym Stone account.':'Sign in to access your player profile and goals across devices.';
    $('account-error').textContent='';$('account-status').textContent='';
    for(const field of ['account-username','account-email','account-password','account-confirm']) $(field).disabled=$(field+'-label')?.hidden||(!configured&&field!=='account-username');
    $('account-submit').disabled=!configured;
    $('account-preview').hidden=configured;
    if(!configured)$('account-status').textContent='Online account setup is in progress. You can explore the workout preview meanwhile.';
  }
  function open() {setMode(mode);if(!dialog.open)dialog.showModal();}
  async function loadProfile() {
    const current=await validSession(),rows=await request('/rest/v1/gym_players?user_id=eq.'+encodeURIComponent(current.user.id)+'&select=username,profile',{method:'GET',token:current.access_token});
    if(rows?.length!==1)throw Error('Your player record could not load. Please try again.');
    if(session?.user.id!==current.user.id)throw Error('The signed-in player changed.');
    session.user.username=rows[0].username;saveSession(session,false);
    return rows[0].profile;
  }
  async function saveProfile(profile) {
    const current=await validSession();
    const response=await fetch(base+'/rest/v1/gym_players?user_id=eq.'+encodeURIComponent(current.user.id),{method:'PATCH',headers:{apikey:config.key,Authorization:'Bearer '+current.access_token,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({profile}),signal:AbortSignal.timeout(20000),cache:'no-store'});
    const result=await response.json();if(!response.ok||result?.length!==1)throw Error('Your profile could not sync. Please try again.');
    return result[0].profile;
  }
  async function signOut() {
    const current=session;saveSession(null);
    if(current)try{await request('/auth/v1/logout',{token:current.access_token});}catch{}
    mode='signin';open();
  }
  async function loadCalendar(){const current=await validSession();return request('/rest/v1/gym_workout_days?user_id=eq.'+encodeURIComponent(current.user.id)+'&select=day,items,revision',{method:'GET',token:current.access_token});}
  async function saveCalendarDay(day,items,revision){const current=await validSession();return request('/rest/v1/rpc/gym_save_workout_day',{body:{p_day:day,p_items:items,p_revision:revision},token:current.access_token});}
  async function loadEmailPrefs(){const current=await validSession();const rows=await request('/rest/v1/gym_email_preferences?user_id=eq.'+encodeURIComponent(current.user.id)+'&select=enabled,days,reminder_time,timezone',{method:'GET',token:current.access_token});return rows?.[0]||null;}
  async function saveEmailPrefs(prefs){const current=await validSession();return request('/rest/v1/rpc/gym_save_email_preferences',{body:{p_enabled:prefs.enabled,p_days:prefs.days,p_time:prefs.reminder_time,p_timezone:prefs.timezone},token:current.access_token});}
  $('account-switch').onclick=()=>setMode(mode==='signup'?'signin':'signup');
  $('account-recover').onclick=()=>{if(config.emailDeliveryReady===true)setMode('recover');};
  $('account-preview').onclick=()=>dialog.close();
  dialog.addEventListener('cancel',event=>{if(configured&&!session||busy)event.preventDefault();});
  $('account-form').onsubmit=async event=>{
    event.preventDefault();if(busy||!configured)return;
    if(mode==='recover'&&config.emailDeliveryReady!==true){$('account-error').textContent='Password recovery emails are currently unavailable.';return;}
    const username=$('account-username').value.trim(),email=$('account-email').value.trim(),password=$('account-password').value;
    if(['signup','signin'].includes(mode)&&!/^[A-Za-z0-9_]{3,24}$/.test(username)){$('account-error').textContent='Use a username with 3–24 letters, numbers or underscores.';return;}
    if(['signup','recover'].includes(mode)&&!$('account-email').checkValidity()){$('account-error').textContent='Enter a valid email address.';return;}
    if(['signup','password'].includes(mode)&&(password.length<8||password!==$('account-confirm').value)){$('account-error').textContent='Use at least 8 characters and enter the same password twice.';return;}
    busy=true;$('account-submit').disabled=true;$('account-error').textContent='';$('account-status').textContent='Connecting…';
    try {
      const redirect=location.origin+location.pathname;
      if(mode==='recover'){await request('/auth/v1/recover?redirect_to='+encodeURIComponent(redirect),{body:{email}});$('account-status').textContent='If an account uses this email, a recovery link will arrive shortly.';}
      else if(mode==='password'){const current=await validSession();await request('/auth/v1/user',{method:'PUT',token:current.access_token,body:{password}});dialog.close();window.dispatchEvent(new CustomEvent('gym-account-changed'));}
      else {
        const payload=mode==='signup'?await request('/auth/v1/signup?redirect_to='+encodeURIComponent(redirect),{body:{email,password,data:{gym_username:username}}}):await request('/functions/v1/gym-login',{body:{username,password}});
        const next=normalize(payload);
        if(next){dialog.close();saveSession(next);}
        else {$('account-status').textContent='Check your email to confirm your account, then return and sign in.';}
      }
    } catch(error){$('account-status').textContent='';$('account-error').textContent=/database error saving new user/i.test(error.message)?'That username may already be taken. Try another username.':error.name==='TimeoutError'?'Connection timed out. Please try again.':error.message;}
    finally{resetPasswordVisibility();busy=false;$('account-submit').disabled=false;$('account-password').value='';$('account-confirm').value='';}
  };
  function resetPasswordVisibility(){
    for(const id of ['account-password','account-confirm']){const input=$(id),button=$(id+'-visibility');input.type='password';if(button){button.setAttribute('aria-label',id==='account-confirm'?'Show confirmation password':'Show password');button.setAttribute('aria-pressed','false');button.title=button.getAttribute('aria-label');}}
  }
  for(const id of ['account-password','account-confirm']){
    const input=$(id),wrapper=document.createElement('span'),button=document.createElement('button');
    wrapper.className='password-control';input.before(wrapper);wrapper.append(input);
    button.id=id+'-visibility';button.type='button';button.className='password-visibility';button.textContent='👁';button.setAttribute('aria-controls',id);
    button.onclick=()=>{const show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-pressed',String(show));button.setAttribute('aria-label',(show?'Hide ':'Show ')+(id==='account-confirm'?'confirmation password':'password'));button.title=button.getAttribute('aria-label');};wrapper.append(button);
  }
  resetPasswordVisibility();
  dialog.addEventListener('close',resetPasswordVisibility);
  const ready=bootstrap();
  window.GymCloud={configured,get remindersReady(){return config.remindersReady===true;},get user(){return session?.user||null;},ready,open,loadProfile,saveProfile,signOut,loadCalendar,saveCalendarDay,loadEmailPrefs,saveEmailPrefs};
  ready.then(()=>{if(!session)open();});
  window.addEventListener('storage',event=>{if(event.key!==sessionKey)return;try{const next=JSON.parse(event.newValue);if(next?.user?.id!==session?.user?.id){session=next;window.dispatchEvent(new CustomEvent('gym-account-changed'));if(!session){mode='signin';open();}else dialog.close();}else session=next;}catch{}});
})();
