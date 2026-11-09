(() => {
 'use strict';
 const data=GymWorkoutRecommendationsData,card=document.createElement('details');card.id='recommended-workout';card.className='panel recommended-workout';
 card.innerHTML=`<summary id="recommended-title" aria-controls="recommended-content"><span>Suggested Next Workout</span><svg class="recommended-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></summary>
 <div id="recommended-content" class="recommended-content">
 <div class="recommended-heading"><span class="eyebrow">YOUR NEXT QUEST</span><button id="recommended-personalize" type="button">Personalize</button></div>
 <p id="recommended-date"></p><div id="recommended-summary"></div><p id="recommended-reason"></p><ol id="recommended-moves"></ol>
 <section id="recommended-details" hidden><h3>Review your workout</h3><p>Preview or replace movements. Use the suggested amounts as a starting point and enter your actual sets, reps, time and weight in the calendar.</p><p id="recommended-goal-note" hidden></p><div id="recommended-evidence" hidden><h4>Training references</h4><ul id="recommended-sources"></ul></div><fieldset><legend>How do you feel?</legend><div class="recommended-readiness"><button type="button" data-readiness="ready" aria-pressed="true">Ready to train</button><button type="button" data-readiness="easy" aria-pressed="false">Keep it easy</button><button type="button" data-readiness="rest" aria-pressed="false">Need recovery</button></div></fieldset></section>
 <div class="recommended-actions"><button id="recommended-preview" type="button" aria-controls="recommended-details" aria-expanded="false">Preview workout</button><button id="recommended-add" type="button" class="primary">Add to today</button><button id="recommended-library" type="button" hidden>Open Pregnancy library</button></div><p id="recommended-status" role="status" aria-live="polite"></p>
 </div>`;
 document.querySelector('.workspace').after(card);
 const dialog=document.createElement('dialog');dialog.className='profile-dialog recommended-preferences';dialog.setAttribute('aria-labelledby','recommended-preferences-title');
 dialog.innerHTML='<div class="recommended-heading"><h2 id="recommended-preferences-title">Your workout preferences</h2><button id="recommended-close" type="button">Close</button></div><p>No specific goal? General fitness is a starting point.</p><form id="recommended-form"><label>Goal<select name="goal"><option value="general">General fitness</option><option value="strength">Build strength</option><option value="muscle">Build muscle</option><option value="weight-management">Manage weight &amp; stay active</option><option value="endurance">Improve endurance</option><option value="mobility">Improve mobility</option></select></label><label>Experience<select name="experience"><option value="beginner">Beginner</option><option value="regular">Regular exerciser</option></select></label><label>Equipment<select name="equipment"><option value="bodyweight">Bodyweight</option><option value="dumbbells">Dumbbells</option><option value="gym">Gym equipment</option></select></label><label>Time available<select name="duration"><option value="15">15 minutes</option><option value="25">25 minutes</option><option value="40">40 minutes</option></select></label><p class="subtle">Preferences are saved for this player on this device. Session times are estimates that include breaks. Choose your effort and weight.</p><button type="submit" class="primary">Update plan</button></form>';
 document.body.append(dialog);
 const byId=id=>document.getElementById(id),form=byId('recommended-form');
 const guidanceLabel=document.createElement('label');guidanceLabel.innerHTML='Guidance<select name="guidance"><option value="auto">Follow calendar</option><option value="postpartum">Postpartum recovery</option><option value="general">General fitness (when ready)</option></select>';form.prepend(guidanceLabel);
 const clearanceNote=document.createElement('p');clearanceNote.className='subtle';clearanceNote.textContent='This preference does not provide medical clearance. Follow your maternity team’s return-to-exercise advice.';guidanceLabel.after(clearanceNote);
 const key=()=> 'gym-stone-workout-preferences-v1:'+ (window.GymCloud?.user?.id||'guest');
 let owner=key(),preferences=null,readiness='ready',overrides={},plan=null,schedule=null,expanded=false,busy=false,adding=false;
 function load(){try{preferences=JSON.parse(localStorage.getItem(key())||'null');}catch{preferences=null;}overrides={};readiness='ready';expanded=false;card.open=false;byId('recommended-status').textContent='';}
 load();
 function render(calendar,catalog){
  if(key()!==owner){owner=key();load();dialog.close();}
  const prefs=data.clean(preferences,GymProfile.value);if(readiness==='easy'){prefs.duration=15;prefs.experience='beginner';}
  const now=new Date(),through=dateKey(now),isRecovery=readiness==='rest';
  plan=data.build({catalog,calendar,preferences:prefs,through,available:exerciseAvailable,overrides,muscles:window.GymMuscleData?.exercises});
  const nextDay=plan.lastWorkout?.day===through||(calendar[through]||[]).some(record=>record?.recovery);
  if(nextDay)now.setDate(now.getDate()+1);
  const target=dateKey(now),relative=nextDay?'tomorrow':'today',existing=calendar[target]||[],restId='recovery-'+target;
  schedule={target,relative};
  const guided=plan.type==='guided'&&!isRecovery,hasWorkout=plan.slots.length>0;
  byId('recommended-date').textContent=(nextDay?'Tomorrow':'Today')+' · '+now.toLocaleDateString(undefined,{month:'short',day:'numeric'});
  byId('recommended-summary').replaceChildren(...(isRecovery?['Recovery day','Rest or easy movement']:guided?[plan.focus,'Choose individual movements']:hasWorkout?[data.goals[prefs.goal],'About '+prefs.duration+' min',plan.focus]:[]).map(label=>{const span=document.createElement('span');span.textContent=label;return span;}));
  byId('recommended-reason').textContent=isRecovery?'Take a recovery day. Rest, or choose gentle movement you feel comfortable doing.':guided?plan.reason:!catalog.length?'Suggestions appear after the exercise library loads.':!hasWorkout?'No exercises match these preferences. Try changing your goal or equipment.':readiness==='easy'?'A shorter session with beginner-friendly choices. '+plan.reason:plan.reason;
  const list=byId('recommended-moves');list.replaceChildren();
  if(!isRecovery&&!guided)for(const slot of plan.slots){
   const row=document.createElement('li'),info=document.createElement('div'),name=document.createElement('strong'),type=document.createElement('span');name.textContent=slot.exercise.name;type.textContent=slot.exercise.phase==='warmup'?'Warm-up':slot.exercise.phase==='cooldown'?'Cooldown':slot.exercise.group;info.append(name,type);row.append(info);
   if(expanded&&slot.target){const amount=document.createElement('span');amount.className='recommended-target';amount.textContent='Suggested '+slot.target;info.append(amount);}
   const actions=document.createElement('div');actions.className='recommended-move-actions';actions.hidden=!expanded;
   const watch=document.createElement('button');watch.type='button';watch.textContent='Preview';watch.setAttribute('aria-label','Preview recommended exercise: '+slot.exercise.name);watch.onclick=()=>{setMode('plan');selectDay(target);openPreview(slot.exercise);};
   const replace=document.createElement('button');replace.type='button';replace.textContent='Replace';replace.setAttribute('aria-label','Replace recommended exercise: '+slot.exercise.name);replace.disabled=busy||!slot.choices.some(e=>e.id!==slot.exercise.id&&!plan.slots.some(s=>s.exercise.id===e.id));
   replace.onclick=()=>{const next=slot.choices.find(e=>e.id!==slot.exercise.id&&!plan.slots.some(s=>s.exercise.id===e.id));if(!next)return;overrides[slot.key]=next.id;render(records,exercises);byId('recommended-status').textContent='Replaced '+slot.exercise.name+' with '+next.name+'.';const button=Array.from(list.querySelectorAll('button')).find(e=>e.getAttribute('aria-label')==='Replace recommended exercise: '+next.name);button?.focus({preventScroll:true});};actions.append(watch,replace);row.append(actions);list.append(row);
  }
  const showDetails=expanded&&!guided&&!isRecovery&&hasWorkout,goalNote=byId('recommended-goal-note'),sources=byId('recommended-sources');
  goalNote.textContent=showDetails?(plan.guidanceNote||''):'';
  goalNote.hidden=!goalNote.textContent;
  sources.replaceChildren();
  if(showDetails)for(const source of plan.sources||[]){
   const item=document.createElement('li'),link=document.createElement('a');
   link.href=source.url;link.textContent=source.title;link.target='_blank';link.rel='noopener noreferrer';
   item.append(link);sources.append(item);
  }
  byId('recommended-evidence').hidden=!sources.childElementCount;
  byId('recommended-library').hidden=!guided;byId('recommended-library').textContent='Open '+(plan.libraryGroup||'Pregnancy')+' library';byId('recommended-preview').hidden=guided;byId('recommended-add').hidden=guided;
  byId('recommended-details').hidden=!expanded||guided;byId('recommended-preview').textContent=expanded?'Hide preview':'Preview workout';byId('recommended-preview').setAttribute('aria-expanded',String(expanded));
  byId('recommended-personalize').disabled=busy;
  card.querySelectorAll('[data-readiness]').forEach(button=>{button.disabled=busy;button.setAttribute('aria-pressed',String(button.dataset.readiness===readiness));});
  const already=isRecovery?existing.some(r=>r.id===restId):hasWorkout&&plan.slots.every(slot=>existing.some(r=>r.id===slot.exercise.id));
  byId('recommended-add').disabled=busy||already||(!hasWorkout&&!isRecovery);byId('recommended-add').textContent=busy?'Saving…':already?'✓ In '+relative+'’s plan':isRecovery?'Add recovery day for '+relative:'Add to '+relative;
 }
 byId('recommended-personalize').onclick=()=>{const prefs=data.clean(preferences,GymProfile.value);for(const name of ['goal','experience','equipment','duration'])form.elements[name].value=String(prefs[name]);form.elements.guidance.value=prefs.guidance||'auto';dialog.showModal();};
 byId('recommended-close').onclick=()=>dialog.close();
 form.onsubmit=event=>{event.preventDefault();preferences=data.clean(Object.fromEntries(new FormData(form)),GymProfile.value);overrides={};let stored=true;try{localStorage.setItem(key(),JSON.stringify(preferences));}catch{stored=false;}dialog.close();render(records,exercises);byId('recommended-status').textContent=stored?'Preferences updated.':'Preferences apply to this session; this browser could not save them.';};
 byId('recommended-preview').onclick=()=>{expanded=!expanded;render(records,exercises);};
 card.querySelectorAll('[data-readiness]').forEach(button=>button.onclick=()=>{readiness=button.dataset.readiness;overrides={};render(records,exercises);byId('recommended-status').textContent='Plan adjusted for how you feel.';});
 byId('recommended-library').onclick=()=>{const group=plan.libraryGroup||'Pregnancy',target=Array.from(byId('filters').children).find(button=>button.textContent===group&&!button.hidden);if(!target){byId('recommended-status').textContent='Choose the Female exercise profile in Player profile to view the '+group+' library.';return;}GymNavigation.show('exercises');target.click();};
 byId('recommended-add').onclick=async()=>{
  const isRecovery=readiness==='rest';
  if(busy||adding||!schedule||(!isRecovery&&plan.type==='guided'))return;
  adding=true;const generation=accountGeneration,{target,relative}=schedule;
  const current=records[target]||[],known=new Set(current.map(r=>r.id));let additions=[];
  if(isRecovery){const id='recovery-'+target;if(!known.has(id))additions=[{id,name:'Recovery day',group:'Recovery',recovery:true,done:false,tracking:'time',minutes:null,time:''}];}
  else additions=plan.slots.filter(slot=>exerciseAvailable(slot.exercise)&&!known.has(slot.exercise.id)).map(slot=>({...exerciseRecord(slot.exercise.id,false),minutes:null}));
  if(!additions.length){adding=false;return;}setMode('plan');selectDay(target);records[target]=[...current,...additions];busy=true;render(records,exercises);let ok=false;
  try{ok=await save();}finally{busy=false;adding=false;}
  if(generation===accountGeneration&&ok&&isRecovery)readiness='ready';
  render(records,exercises);if(generation!==accountGeneration)return;byId('recommended-status').textContent=ok?'Added to '+relative+'. Review your calendar.':'The plan is visible, but could not be saved. Keep this tab open and check browser storage.';if(ok){GymNavigation.show('calendar');notify((isRecovery?'Recovery day':'Workout')+' planned for '+relative+'.');}
 };
 window.GymWorkoutRecommendations={render,get preferences(){return data.clean(preferences,GymProfile.value);},get plan(){return plan;}};
 window.addEventListener('gym-profile-changed',()=>{overrides={};render(records,exercises);});
 render(records,exercises);
})();
