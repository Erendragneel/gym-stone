/* A per-player, device-local food diary. Nutrition never enters workout totals. */
(() => {
  'use strict';
  const fields = ['calories', 'protein', 'carbs', 'fat', 'water'];
  const mealNames = {breakfast:'Breakfast', lunch:'Lunch', dinner:'Dinner', snack:'Snacks'};
  const labels = {calories:'Calories', protein:'Protein', carbs:'Carbs', fat:'Fat', water:'Water'};
  const units = {calories:'kcal', protein:'g', carbs:'g', fat:'g', water:'mL'};
  const limits = {calories:100000, protein:10000, carbs:10000, fat:10000, water:100000};
  const blank = () => ({version:1, goals:Object.fromEntries(fields.map(key => [key,null])), days:{}});
  const owner = () => window.GymCloud?.user?.id || '';
  const cacheKey = who => 'gym-stone-nutrition-v1' + (who ? ':' + who : '');
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(new Date(value+'T12:00:00')) === value;
  const amount = (value, max, positive=false) => typeof value === 'number' && Number.isFinite(value) && value >= (positive ? 0.1 : 0) && value <= max ? value : null;
  const fmt = value => Number(value.toFixed(1)).toLocaleString(undefined, {maximumFractionDigits:1});
  let state=blank(), loaded=false, busy=false, generation=0, activeOwner='', loadPromise;
  let editing=null, entryDate=null, removed=null, foodSource='';

  const section=document.createElement('section');
  section.id='nutrition-section'; section.className='nutrition-section'; section.hidden=true;
  section.setAttribute('aria-label','Nutrition tracking');
  section.innerHTML=`
    <div class="nutrition-toolbar">
      <div class="nutrition-date-controls"><button id="nutrition-prev" class="secondary" type="button" aria-label="Previous nutrition day">‹</button><label>Food diary <input id="nutrition-date" type="date" required></label><button id="nutrition-next" class="secondary" type="button" aria-label="Next nutrition day">›</button><button id="nutrition-today" class="secondary" type="button">Today</button></div>
      <button id="nutrition-goals-open" class="secondary" type="button" data-nutrition-write>Edit daily goals</button>
    </div>
    <p id="nutrition-date-label" class="nutrition-date-label"></p>
    <div id="nutrition-summary" class="nutrition-summary"></div>
    <p id="nutrition-macro-note" class="nutrition-help"></p>
    <div class="nutrition-layout">
      <section class="panel nutrition-diary" aria-labelledby="nutrition-diary-title"><div class="nutrition-panel-heading"><div><span class="eyebrow">YOUR DAILY FUEL</span><h2 id="nutrition-diary-title">Meals &amp; snacks</h2></div><button id="nutrition-add" class="primary" type="button" data-nutrition-write>＋ Log food</button></div><p class="nutrition-help">Enter the nutrition for the portion you ate, using its label or your own estimate.</p><div id="nutrition-meals"></div><button id="nutrition-undo-delete" class="secondary nutrition-undo" type="button" data-nutrition-write hidden>Undo deleted food</button></section>
      <section class="panel nutrition-water" aria-labelledby="nutrition-water-title"><span class="eyebrow">KEEP A WATER LOG</span><h2 id="nutrition-water-title">Water</h2><div class="nutrition-water-number"><strong id="nutrition-water-total">0</strong><span>mL logged</span></div><p id="nutrition-water-goal" class="nutrition-help"></p><progress id="nutrition-water-progress" max="100" value="0" aria-label="Water goal progress" hidden></progress><form id="nutrition-water-form"><label for="nutrition-water-amount">Amount in mL</label><div class="nutrition-water-input"><input id="nutrition-water-amount" type="number" inputmode="numeric" min="1" max="10000" step="1" value="250" required><button id="nutrition-water-add" class="primary" type="submit" data-nutrition-write>＋ Add</button></div></form><button id="nutrition-water-undo" class="secondary" type="button" data-nutrition-write>Undo last drink</button><p id="nutrition-water-count" class="nutrition-help"></p></section>
    </div>
    <div class="nutrition-storage"><p id="nutrition-status" role="status" aria-live="polite">Loading nutrition…</p><p id="nutrition-error" role="alert"></p><button id="nutrition-retry" class="secondary" type="button" hidden>Retry loading</button><p>Saved on this device for this player. Nutrition does not sync across devices. Clearing browser data removes this diary.</p></div>`;
  document.querySelector('main').insertBefore(section,document.querySelector('main > footer'));

  const entry=document.createElement('dialog');
  entry.id='nutrition-entry-dialog'; entry.className='nutrition-dialog'; entry.setAttribute('aria-labelledby','nutrition-entry-title');
  entry.innerHTML=`<button id="nutrition-entry-close" class="dialog-close" type="button" aria-label="Close food entry">×</button><form id="nutrition-entry-form"><span class="eyebrow">FOOD DIARY</span><h2 id="nutrition-entry-title">Log food</h2><p id="nutrition-entry-date" class="nutrition-help"></p><div class="nutrition-form-grid"><label class="nutrition-wide">Food or meal<input id="nutrition-name" type="text" maxlength="100" placeholder="e.g. Chicken rice bowl" required></label><label>Meal<select id="nutrition-meal">${Object.entries(mealNames).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><label>Portion <span>Optional</span><input id="nutrition-serving" type="text" maxlength="100" placeholder="e.g. 1 bowl / 250 g"></label><label>Calories (kcal)<input id="nutrition-calories" type="number" inputmode="decimal" min="0" max="100000" step="0.1" required placeholder="From label or estimate"></label>${['protein','carbs','fat'].map(key=>`<label>${labels[key]} (g) <span>Optional</span><input id="nutrition-${key}" type="number" inputmode="decimal" min="0" max="10000" step="0.1" placeholder="Unknown"></label>`).join('')}</div><p class="nutrition-help">Values are for the whole portion above. Blank macros stay unknown.</p><p id="nutrition-entry-error" class="nutrition-form-error" role="alert"></p><div class="nutrition-form-actions"><button id="nutrition-entry-cancel" class="secondary" type="button">Cancel</button><button id="nutrition-entry-save" class="primary" type="submit" data-nutrition-write>Save food</button></div></form>`;
  const goals=document.createElement('dialog');
  goals.id='nutrition-goals-dialog'; goals.className='nutrition-dialog'; goals.setAttribute('aria-labelledby','nutrition-goals-title');
  goals.innerHTML=`<button id="nutrition-goals-close" class="dialog-close" type="button" aria-label="Close nutrition goals">×</button><form id="nutrition-goals-form"><span class="eyebrow">YOUR OWN TARGETS</span><h2 id="nutrition-goals-title">Daily nutrition goals</h2><p class="nutrition-help">Enter the daily targets you want to track. Every goal is optional; leave a field blank to remove it.</p><div class="nutrition-form-grid">${fields.map(key=>`<label>${labels[key]} (${units[key]})<input id="nutrition-goal-${key}" type="number" inputmode="decimal" min="0.1" max="${limits[key]}" step="0.1" placeholder="No goal"></label>`).join('')}</div><p class="nutrition-help">These goals apply to every day in your diary.</p><p id="nutrition-goals-error" class="nutrition-form-error" role="alert"></p><div class="nutrition-form-actions"><button id="nutrition-goals-cancel" class="secondary" type="button">Cancel</button><button id="nutrition-goals-save" class="primary" type="submit" data-nutrition-write>Save goals</button></div></form>`;
  document.body.append(entry,goals);

  function clean(value) {
    const result=blank();
    if(!value || typeof value !== 'object') return result;
    for(const key of fields) result.goals[key]=amount(value.goals?.[key],limits[key],true);
    for(const [day,data] of Object.entries(value.days || {})) {
      if(!validDate(day) || !data || typeof data !== 'object') continue;
      const meals=(Array.isArray(data.meals)?data.meals:[]).filter(row=>row && typeof row.id==='string' && typeof row.name==='string' && row.name.trim() && Object.hasOwn(mealNames,row.meal) && amount(row.calories,limits.calories)!==null).map(row=>({id:row.id, name:row.name.trim().slice(0,100), meal:row.meal, serving:typeof row.serving==='string'?row.serving.slice(0,100):'', calories:row.calories, ...Object.fromEntries(['protein','carbs','fat'].map(key=>[key,amount(row[key],limits[key])]))}));
      const water=(Array.isArray(data.water)?data.water:[]).filter(row=>row && typeof row.id==='string' && amount(row.amount,10000,true)!==null).map(row=>({id:row.id,amount:row.amount}));
      for(const row of meals){const original=data.meals.find(item=>item.id===row.id);if(typeof original?.source==='string')row.source=original.source.slice(0,200);}
      result.days[day]={meals:meals.filter((row,i,all)=>all.findIndex(other=>other.id===row.id)===i), water:water.filter((row,i,all)=>all.findIndex(other=>other.id===row.id)===i)};
    }
    return result;
  }
  function dayData(value=state,day=selected){return value.days[day] || {meals:[],water:[]};}
  function ensureDay(value,day){return value.days[day] || (value.days[day]={meals:[],water:[]});}
  function total(meals,key){return meals.reduce((sum,row)=>sum+(row[key]??0),0);}
  function targetText(value,goal,unit,partial=false){
    if(goal===null)return 'No daily goal set';
    const diff=Math.round((goal-value)*10)/10;
    return fmt(goal)+' '+unit+' goal · '+(partial?'Known values only':diff>0?fmt(diff)+' '+unit+' remaining':diff<0?fmt(-diff)+' '+unit+' above goal':'Goal reached');
  }
  function renderNutrition(){
    $('nutrition-date').value=selected;
    $('nutrition-date-label').textContent=new Date(selected+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    const {meals,water}=dayData(), summary=$('nutrition-summary');summary.replaceChildren();
    for(const key of ['calories','protein','carbs','fat']){
      const value=total(meals,key),missing=meals.some(row=>row[key]===null),unknown=meals.length>0 && meals.every(row=>row[key]===null),goal=state.goals[key];
      const card=document.createElement('article');card.className='panel nutrition-metric nutrition-metric-'+key;
      const label=document.createElement('span');label.className='eyebrow';label.textContent=labels[key];
      const number=document.createElement('div');number.className='nutrition-metric-value';const strong=document.createElement('strong');strong.id='nutrition-total-'+key;strong.textContent=unknown?'—':fmt(value);const unit=document.createElement('span');unit.textContent=units[key];number.append(strong,unit);
      const help=document.createElement('p');help.textContent=targetText(value,goal,units[key],missing);help.className='nutrition-help';
      card.append(label,number,help);
      if(goal!==null){const progress=document.createElement('progress');progress.max=100;progress.value=Math.min(100,value/goal*100);progress.setAttribute('aria-label',labels[key]+' goal progress'+(missing?' from known values':''));card.append(progress);}
      summary.append(card);
    }
    $('nutrition-macro-note').textContent=meals.some(row=>['protein','carbs','fat'].some(key=>row[key]===null))?'Macro totals include known values only. Edit a food to fill in any missing macros.':'Daily totals use your entered portions.';
    const list=$('nutrition-meals');list.replaceChildren();
    for(const [meal,label] of Object.entries(mealNames)){
      const group=document.createElement('section');group.className='nutrition-meal-group';const heading=document.createElement('h3');heading.textContent=label;group.append(heading);
      const rows=meals.filter(row=>row.meal===meal);
      if(!rows.length){const empty=document.createElement('p');empty.className='nutrition-empty';empty.textContent='No '+(meal==='snack'?'snacks':meal)+' logged.';group.append(empty);}
      for(const row of rows){
        const item=document.createElement('article');item.className='nutrition-food';const info=document.createElement('div');info.className='nutrition-food-info';const name=document.createElement('strong');name.textContent=row.name;
        const portion=document.createElement('span');portion.textContent=row.serving || 'One entered portion';const macros=document.createElement('p');macros.textContent=['protein','carbs','fat'].map(key=>labels[key]+': '+(row[key]===null?'—':fmt(row[key])+' g')).join(' · ');info.append(name,portion,macros);
        if(row.source){const source=document.createElement('span');source.textContent=row.source;info.append(source);}
        const calories=document.createElement('span');calories.className='nutrition-food-calories';calories.textContent=fmt(row.calories)+' kcal';
        const actions=document.createElement('div');actions.className='nutrition-food-actions';
        for(const [label,action] of [['Edit',()=>openEntry(row)],['Delete',()=>deleteMeal(row.id)]]){const button=document.createElement('button');button.className='secondary';button.type='button';button.textContent=label;button.setAttribute('aria-label',label+' '+row.name);button.dataset.nutritionWrite='';button.onclick=action;actions.append(button);}
        item.append(info,calories,actions);group.append(item);
      }
      list.append(group);
    }
    const waterTotal=water.reduce((sum,row)=>sum+row.amount,0);
    $('nutrition-water-total').textContent=fmt(waterTotal);
    $('nutrition-water-goal').textContent=targetText(waterTotal,state.goals.water,'mL');
    $('nutrition-water-progress').hidden=state.goals.water===null;
    $('nutrition-water-progress').value=state.goals.water?Math.min(100,waterTotal/state.goals.water*100):0;
    $('nutrition-water-count').textContent=water.length+' drink'+(water.length===1?'':'s')+' logged';
    $('nutrition-undo-delete').hidden=!removed || removed.day!==selected;
    for(const button of document.querySelectorAll('[data-nutrition-write]'))button.disabled=!loaded||busy;
    $('nutrition-water-undo').disabled=!loaded||busy||!water.length;
  }

  async function load(){
    const current=++generation,who=owner();activeOwner=who;loaded=false;busy=false;state=blank();removed=null;entry.close();goals.close();
    $('nutrition-status').textContent='Loading nutrition…';$('nutrition-error').textContent='';$('nutrition-retry').hidden=true;renderNutrition();
    try{
      await GymScreenshotStore.whenIdle();
      if(current!==generation || who!==owner())return;
      const stored=await GymScreenshotStore.getNutrition();
      if(current!==generation || who!==owner())return;
      let cached=null;try{cached=JSON.parse(localStorage.getItem(cacheKey(who)));}catch{}
      state=clean(stored ?? cached);loaded=true;$('nutrition-status').textContent='● Nutrition saved on this device';
    }catch{
      if(current!==generation || who!==owner())return;
      $('nutrition-status').textContent='Nutrition is unavailable';$('nutrition-error').textContent='Your diary could not be loaded. Retry loading before making changes.';$('nutrition-retry').hidden=false;
    }
    if(current===generation)renderNutrition();
  }
  async function commit(change,errorId='nutrition-error'){
    if(!loaded || busy || activeOwner!==owner() || GymScreenshotStore.blocked)return false;
    const current=generation,who=activeOwner,next=structuredClone(state);change(next);busy=true;
    $(errorId).textContent='';$('nutrition-error').textContent='';$('nutrition-status').textContent='Saving nutrition…';renderNutrition();
    try{
      await GymScreenshotStore.putNutrition(next);
      if(current!==generation || who!==owner())return false;
      state=next;try{localStorage.setItem(cacheKey(who),JSON.stringify(state));}catch{}
      $('nutrition-status').textContent='● Nutrition saved on this device';return true;
    }catch{
      if(current!==generation || who!==owner())return false;
      const message='Could not save nutrition. Check available browser storage and try again. Your previous diary is unchanged.';
      $(errorId).textContent=message;$('nutrition-error').textContent=message;$('nutrition-status').textContent='Nutrition save failed';return false;
    }finally{if(current===generation){busy=false;renderNutrition();}}
  }
  function openEntry(row=null){
    if(!loaded||busy)return;foodSource=row?.source||'';editing=row?.id||null;entryDate=selected;$('nutrition-entry-form').reset();$('nutrition-entry-error').textContent='';
    $('nutrition-entry-title').textContent=row?'Edit food':'Log food';$('nutrition-entry-date').textContent=new Date(entryDate+'T12:00:00').toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
    for(const key of ['name','meal','serving','calories','protein','carbs','fat'])if(row)$('nutrition-'+key).value=row[key]??'';
    entry.showModal();$('nutrition-name').focus();
  }
  async function deleteMeal(id){
    const day=selected,index=dayData().meals.findIndex(row=>row.id===id);if(index<0)return;
    const row=structuredClone(dayData().meals[index]);
    if(await commit(next=>{ensureDay(next,day).meals=dayData(next,day).meals.filter(item=>item.id!==id);})){removed={day,index,row};renderNutrition();}
  }
  function shiftDay(change){const date=new Date(selected+'T12:00:00');date.setDate(date.getDate()+change);selectDay(dateKey(date));}
  $('nutrition-prev').onclick=()=>shiftDay(-1);$('nutrition-next').onclick=()=>shiftDay(1);
  $('nutrition-today').onclick=()=>selectDay(dateKey(new Date()));
  $('nutrition-date').onchange=event=>{if(validDate(event.target.value))selectDay(event.target.value);else event.target.value=selected;};
  $('nutrition-add').onclick=()=>openEntry();
  for(const id of ['nutrition-entry-close','nutrition-entry-cancel'])$(id).onclick=()=>entry.close();
  for(const id of ['nutrition-goals-close','nutrition-goals-cancel'])$(id).onclick=()=>goals.close();
  $('nutrition-entry-form').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
    const name=$('nutrition-name').value.trim();if(!name){$('nutrition-entry-error').textContent='Enter a food or meal name.';$('nutrition-name').focus();return;}
    const row={id:editing||crypto.randomUUID(),name,meal:$('nutrition-meal').value,serving:$('nutrition-serving').value.trim()};
    for(const key of ['calories','protein','carbs','fat'])row[key]=$('nutrition-'+key).value===''?null:Number($('nutrition-'+key).value);
    if(foodSource)row.source=foodSource;
    const day=entryDate;
    const saved=await commit(next=>{const data=ensureDay(next,day),index=data.meals.findIndex(item=>item.id===row.id);if(index<0)data.meals.push(row);else data.meals[index]=row;},'nutrition-entry-error');
    if(saved){entry.close();removed=null;renderNutrition();$('nutrition-add').focus();}
  };
  $('nutrition-water-form').onsubmit=async event=>{
    event.preventDefault();if(!event.currentTarget.reportValidity())return;const drink={id:crypto.randomUUID(),amount:Number($('nutrition-water-amount').value)},day=selected;
    await commit(next=>ensureDay(next,day).water.push(drink));
  };
  $('nutrition-water-undo').onclick=()=>{const day=selected;commit(next=>ensureDay(next,day).water.pop());};
  $('nutrition-undo-delete').onclick=async()=>{if(!removed)return;const restore=structuredClone(removed);if(await commit(next=>ensureDay(next,restore.day).meals.splice(restore.index,0,restore.row))){removed=null;renderNutrition();}};
  $('nutrition-goals-open').onclick=()=>{
    if(!loaded||busy)return;$('nutrition-goals-error').textContent='';for(const key of fields)$('nutrition-goal-'+key).value=state.goals[key]??'';goals.showModal();$('nutrition-goal-calories').focus();
  };
  $('nutrition-goals-form').onsubmit=async event=>{
    event.preventDefault();if(!event.currentTarget.reportValidity())return;
    const values=Object.fromEntries(fields.map(key=>[key,$('nutrition-goal-'+key).value===''?null:Number($('nutrition-goal-'+key).value)]));
    if(await commit(next=>{next.goals=values;},'nutrition-goals-error')){goals.close();$('nutrition-goals-open').focus();}
  };
  $('nutrition-retry').onclick=()=>{loadPromise=load();};
  const originalRender=render;render=function(){originalRender();renderNutrition();};
  window.addEventListener('gym-account-changed',()=>{loadPromise=load();});
  loadPromise=(async()=>{await window.GymCloud?.ready;return loadPromise=load();})();
  window.GymNutrition={get ready(){return loadPromise;},get value(){return structuredClone(state);},render:renderNutrition,
    openFood(row){if(!loaded||busy)return;openEntry();foodSource=row.source||'';for(const key of ['name','serving','calories','protein','carbs','fat'])if(row[key]!==undefined)$('nutrition-'+key).value=row[key]??'';},
    get date(){return selected;}};
  renderNutrition();
})();
