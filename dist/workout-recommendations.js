(() => {
 'use strict';
 const data=GymWorkoutRecommendationsData,card=document.createElement('section');card.id='recommended-workout';card.className='panel recommended-workout';card.setAttribute('aria-labelledby','recommended-title');
 card.innerHTML='<div class="recommended-heading"><span class="eyebrow">YOUR NEXT QUEST</span><button id="recommended-personalize" type="button">Personalize</button></div><h2 id="recommended-title">Suggested next workout</h2><p id="recommended-date"></p><div id="recommended-summary"></div><p id="recommended-reason"></p><ol id="recommended-moves"></ol><section id="recommended-details" hidden><h3>Review your workout</h3><p>Preview the movements and replace any you prefer to avoid. Choose your sets, reps, time and weight in the calendar.</p><fieldset><legend>How do you feel?</legend><div class="recommended-readiness"><button type="button" data-readiness="ready" aria-pressed="true">Ready to train</button><button type="button" data-readiness="easy" aria-pressed="false">Keep it easy</button><button type="button" data-readiness="rest" aria-pressed="false">Need recovery</button></div></fieldset></section><div class="recommended-actions"><button id="recommended-preview" type="button" aria-controls="recommended-details" aria-expanded="false">Preview workout</button><button id="recommended-add" type="button" class="primary">Add to tomorrow</button><button id="recommended-library" type="button" hidden>Open Pregnancy library</button></div><p id="recommended-status" role="status" aria-live="polite"></p>';
 document.querySelector('.workspace').before(card);
 const dialog=document.createElement('dialog');dialog.className='profile-dialog recommended-preferences';dialog.setAttribute('aria-labelledby','recommended-preferences-title');
 dialog.innerHTML='<div class="recommended-heading"><h2 id="recommended-preferences-title">Your workout preferences</h2><button id="recommended-close" type="button">Close</button></div><p>No specific goal? General fitness is a starting point.</p><form id="recommended-form"><label>Goal<select name="goal"><option value="general">General fitness</option><option value="strength">Build strength</option><option value="muscle">Build muscle</option><option value="endurance">Improve endurance</option><option value="mobility">Mobility</option></select></label><label>Experience<select name="experience"><option value="beginner">Beginner</option><option value="regular">Regular exerciser</option></select></label><label>Equipment<select name="equipment"><option value="bodyweight">Bodyweight</option><option value="dumbbells">Dumbbells</option></select></label><label>Time available<select name="duration"><option value="15">15 minutes</option><option value="25">25 minutes</option><option value="40">40 minutes</option></select></label><p class="subtle">Preferences are saved for this player on this device. Session times are estimates, including breaks; sets, reps and weight are yours to choose.</p><button type="submit" class="primary">Update plan</button></form>';
 document.body.append(dialog);
 const byId=id=>document.getElementById(id),form=byId('recommended-form');
 const key=()=> 'gym-stone-workout-preferences-v1:'+ (window.GymCloud?.user?.id||'guest');
 let owner=key(),preferences=null,readiness='ready',overrides={},plan=null,expanded=false,busy=false,adding=false;
 function load(){try{preferences=JSON.parse(localStorage.getItem(key())||'null');}catch{preferences=null;}overrides={};readiness='ready';expanded=false;byId('recommended-status').textContent='';}
 load();
 function tomorrow(){const day=new Date();day.setDate(day.getDate()+1);return dateKey(day);}
 function render(calendar,catalog){
  if(key()!==owner){owner=key();load();dialog.close();}
  const prefs=data.clean(preferences,GymProfile.value);if(readiness==='easy'){prefs.duration=15;prefs.experience='beginner';}
  plan=data.build({catalog,calendar,preferences:prefs,through:today,available:exerciseAvailable,overrides});
  const target=tomorrow(),existing=calendar[target]||[],restId='recovery-'+target;
  byId('recommended-date').textContent='Tomorrow · '+new Date(target+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});
  byId('recommended-summary').replaceChildren(...[data.goals[prefs.goal],readiness==='rest'?'Recovery day':'About '+prefs.duration+' min',readiness==='rest'?'Rest or easy movement':plan.focus].map(label=>{const span=document.createElement('span');span.textContent=label;return span;}));
  byId('recommended-reason').textContent=readiness==='rest'?'Take a recovery day. Rest, or choose gentle movement you feel comfortable doing.':readiness==='easy'?'A shorter session with beginner-friendly choices. Adjust the effort to how you feel.':plan.reason;
  const list=byId('recommended-moves');list.replaceChildren();
  if(readiness!=='rest'&&plan.type!=='guided')for(const slot of plan.slots){
   const row=document.createElement('li'),info=document.createElement('div'),name=document.createElement('strong'),type=document.createElement('span');name.textContent=slot.exercise.name;type.textContent=slot.exercise.phase==='warmup'?'Warm-up':slot.exercise.phase==='cooldown'?'Cooldown':slot.exercise.group;info.append(name,type);row.append(info);
   const actions=document.createElement('div');actions.className='recommended-move-actions';actions.hidden=!expanded;
   const watch=document.createElement('button');watch.type='button';watch.textContent='Preview';watch.setAttribute('aria-label','Preview recommended exercise: '+slot.exercise.name);watch.onclick=()=>{setMode('plan');selectDay(tomorrow());openPreview(slot.exercise);};
   const replace=document.createElement('button');replace.type='button';replace.textContent='Replace';replace.setAttribute('aria-label','Replace recommended exercise: '+slot.exercise.name);replace.disabled=busy||!slot.choices.some(e=>e.id!==slot.exercise.id&&!plan.slots.some(s=>s.exercise.id===e.id));
   replace.onclick=()=>{const next=slot.choices.find(e=>e.id!==slot.exercise.id&&!plan.slots.some(s=>s.exercise.id===e.id));if(!next)return;overrides[slot.key]=next.id;render(records,exercises);byId('recommended-status').textContent='Replaced '+slot.exercise.name+' with '+next.name+'.';const button=Array.from(list.querySelectorAll('button')).find(e=>e.getAttribute('aria-label')==='Replace recommended exercise: '+next.name);button?.focus({preventScroll:true});};actions.append(watch,replace);row.append(actions);list.append(row);
  }
  const guided=plan.type==='guided'&&readiness!=='rest';byId('recommended-library').hidden=!guided;byId('recommended-preview').hidden=guided;byId('recommended-add').hidden=guided;
  byId('recommended-details').hidden=!expanded||guided;byId('recommended-preview').textContent=expanded?'Hide preview':'Preview workout';byId('recommended-preview').setAttribute('aria-expanded',String(expanded));
  byId('recommended-personalize').disabled=busy;
  card.querySelectorAll('[data-readiness]').forEach(button=>{button.disabled=busy;button.setAttribute('aria-pressed',String(button.dataset.readiness===readiness));});
  const already=readiness==='rest'?existing.some(r=>r.id===restId):plan.slots.length>0&&plan.slots.every(slot=>existing.some(r=>r.id===slot.exercise.id));
  byId('recommended-add').disabled=busy||already||(!catalog.length&&readiness!=='rest');byId('recommended-add').textContent=busy?'Saving…':already?'✓ In tomorrow’s plan':readiness==='rest'?'Add recovery day':'Add to tomorrow';
 }
 byId('recommended-personalize').onclick=()=>{const prefs=data.clean(preferences,GymProfile.value);for(const name of ['goal','experience','equipment','duration'])form.elements[name].value=String(prefs[name]);dialog.showModal();};
 byId('recommended-close').onclick=()=>dialog.close();
 form.onsubmit=event=>{event.preventDefault();preferences=data.clean(Object.fromEntries(new FormData(form)),GymProfile.value);overrides={};let stored=true;try{localStorage.setItem(key(),JSON.stringify(preferences));}catch{stored=false;}dialog.close();render(records,exercises);byId('recommended-status').textContent=stored?'Preferences updated.':'Preferences apply to this session; this browser could not save them.';};
 byId('recommended-preview').onclick=()=>{expanded=!expanded;render(records,exercises);};
 card.querySelectorAll('[data-readiness]').forEach(button=>button.onclick=()=>{readiness=button.dataset.readiness;overrides={};render(records,exercises);byId('recommended-status').textContent='Plan adjusted for how you feel.';});
 byId('recommended-library').onclick=()=>{GymNavigation.show('exercises');Array.from(byId('filters').children).find(button=>button.textContent==='Pregnancy'&&!button.hidden)?.click();};
 byId('recommended-add').onclick=async()=>{
  if(busy||adding)return;adding=true;const generation=accountGeneration,target=tomorrow();
  const current=records[target]||[],known=new Set(current.map(r=>r.id));let additions=[];
  if(readiness==='rest'){const id='recovery-'+target;if(!known.has(id))additions=[{id,name:'Recovery day',group:'Recovery',recovery:true,done:false,tracking:'time',minutes:null,time:''}];}
  else additions=plan.slots.filter(slot=>exerciseAvailable(slot.exercise)&&!known.has(slot.exercise.id)).map(slot=>exerciseRecord(slot.exercise.id,false));
  if(!additions.length){adding=false;return;}setMode('plan');selectDay(target);records[target]=[...current,...additions];busy=true;render(records,exercises);let ok=false;
  try{ok=await save();}finally{busy=false;adding=false;}
  if(generation!==accountGeneration)return;render(records,exercises);byId('recommended-status').textContent=ok?'Added to tomorrow. Review quantities in your calendar.':'The plan is visible, but could not be saved. Keep this tab open and check browser storage.';if(ok){GymNavigation.show('calendar');notify(readiness==='rest'?'Recovery day planned for tomorrow.':'Workout planned for tomorrow. Enter your sets, reps, time and weight.');}
 };
 window.GymWorkoutRecommendations={render,get preferences(){return data.clean(preferences,GymProfile.value);},get plan(){return plan;}};
 window.addEventListener('gym-profile-changed',()=>{overrides={};render(records,exercises);});
 render(records,exercises);
})();
