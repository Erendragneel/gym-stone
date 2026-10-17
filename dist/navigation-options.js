/* These independent examples use temporary sample data and never touch app storage. */
(() => {
  'use strict';

  const paths = {
    stone: '<path d="m12 2 9 5v10l-9 5-9-5V7Z"/><path d="m8 9 4-2 4 2v6l-4 2-4-2Z"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h1m3 0h1m3 0h1m-9 3h1m3 0h1"/>',
    exercise: '<path d="m5 9 4-4m6 14 4-4M3 7l4 4M13 17l4 4M7 3l4 4m6 6 4 4M8 8l8 8"/>',
    food: '<path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18M19 3v18M19 3c-3 3-4 7 0 9"/>',
    chart: '<path d="M4 3v18h17M9 16v-5m5 5V7m5 9V4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    tools: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    import: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="m3 16 5-5 5 5 3-3 5 5M12 2v7m-3-3 3 3 3-3"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 5 5 3-3 4 4"/>',
    share: '<path d="M12 16V3m-5 5 5-5 5 5M5 13v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>',
    install: '<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
    trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 13v5m-4 3h8m-8-3h8v3H8Z"/>',
    water: '<path d="M12 3c-2 4-7 8-7 12a7 7 0 0 0 14 0c0-4-5-8-7-12Z"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.exercise}</svg>`;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const exercises = [
    {id:'bench', name:'Dumbbell bench press', group:'Chest', details:'3 sets × 10 reps · 12 kg'},
    {id:'row', name:'Seated cable row', group:'Back', details:'3 sets × 12 reps · 20 kg'},
    {id:'squat', name:'Bodyweight squat', group:'Legs', details:'3 sets × 12 reps'},
    {id:'walk', name:'Treadmill walk', group:'Cardio', details:'15 minutes'},
    {id:'curl', name:'Dumbbell biceps curl', group:'Arms', details:'Enter sets, reps & weight'},
    {id:'stretch', name:'Standing calf stretch', group:'Cooldown', details:'30-second hold'}
  ];
  const configurations = {
    a: {initial:'today', nav:[['today','Today','home'],['calendar','Calendar','calendar'],['exercises','Exercises','exercise'],['nutrition','Nutrition','food'],['progress','Progress','chart']]},
    b: {initial:'home', nav:[['home','Home','home'],['train','Train','exercise'],['nutrition','Nutrition','food'],['progress','Progress','chart']]},
    c: {initial:'today', nav:[['today','Today','home'],['calendar','Calendar','calendar'],['quick','Add','plus'],['nutrition','Nutrition','food'],['progress','Progress','chart']]}
  };

  function createExample(variant) {
    const root = document.getElementById(`demo-${variant}`);
    const configuration = configurations[variant];
    const state = {screen:configuration.initial, trainTab:'workout', day:12, workout:['bench','row','squat','walk'], completed:new Set(['bench','row']), query:'', group:'All groups', water:1000, foods:0, activities:0, sheet:null, returnFocus:null, statusTimer:null};
    const ids = name => `${variant}-${name}`;

    root.innerHTML = `<header class="preview-header"><div class="preview-wordmark">${icon('stone')}GYM STONE</div><button type="button" class="tools-button" data-action="tools" aria-expanded="false" aria-controls="${ids('sheet')}">${icon('tools')}Tools</button></header><div class="preview-sample">INTERACTIVE EXAMPLE · SAMPLE DATA</div><div class="demo-content"></div><nav class="preview-nav" aria-label="Option ${variant.toUpperCase()} example navigation">${configuration.nav.map(([key,label,graphic])=>`<button type="button" data-screen="${key}"${key==='quick'?` class="quick-add" aria-expanded="false" aria-controls="${ids('sheet')}"`:''}>${icon(graphic)}<span class="nav-label">${label}</span></button>`).join('')}</nav><div class="demo-status" role="status" aria-live="polite"></div><div class="sheet-scrim" data-action="close-sheet" hidden></div><section class="demo-sheet" id="${ids('sheet')}" aria-labelledby="${ids('sheet-title')}" hidden></section>`;
    const content = root.querySelector('.demo-content');
    const sheet = root.querySelector('.demo-sheet');
    const scrim = root.querySelector('.sheet-scrim');
    const tools = root.querySelector('[data-action="tools"]');

    function notify(message) {
      const status = root.querySelector('.demo-status');
      clearTimeout(state.statusTimer);
      status.textContent = message;
      state.statusTimer = setTimeout(() => { status.textContent = ''; }, 4000);
    }

    function route() {
      if (state.screen==='train') return state.trainTab==='workout'?'today':state.trainTab;
      return state.screen==='home'?'today':state.screen;
    }

    function navigate(destination) {
      const moveFocus=content.contains(document.activeElement)||sheet.contains(document.activeElement);
      closeSheet(false);
      if (variant==='b' && ['today','calendar','exercises'].includes(destination)) {
        state.screen='train';
        state.trainTab=destination==='today'?'workout':destination;
      } else state.screen=destination;
      render();
      content.scrollTop=0;
      if(moveFocus)content.querySelector('.screen-title').focus({preventScroll:true});
    }

    function button(label, action, primary=false, graphic='') {
      return `<button type="button" class="demo-button${primary?' primary':''}" data-action="${action}">${graphic?icon(graphic):''}${label}</button>`;
    }

    function workout() {
      const complete=state.workout.filter(id=>state.completed.has(id)).length;
      return `<div class="mini-stats"><div class="mini-stat"><span>Workout days</span><strong>2<small>/ 3 this week</small></strong><div class="small-track"><i></i></div></div><div class="mini-stat"><span>Training this week</span><strong>40<small>minutes</small></strong><div class="small-track"><i style="width:44%"></i></div></div></div><section class="demo-panel"><div class="panel-top"><div><h3>Your workout</h3><p>Sample Monday · October 12</p></div><span class="completion-count">${complete}/${state.workout.length} done</span></div>${state.workout.map(id=>{const exercise=exercises.find(item=>item.id===id);const done=state.completed.has(id);return `<div class="workout-row"><button type="button" class="check-button" data-complete="${id}" aria-pressed="${done}" aria-label="${done?'Mark incomplete':'Complete'}: ${escapeHtml(exercise.name)}">${done?icon('check'):icon('plus')}</button><div><strong>${escapeHtml(exercise.name)}</strong><p>${escapeHtml(exercise.details)}</p></div></div>`;}).join('')}</section><div class="action-stack">${button('Add exercise','exercises',true,'plus')}${button('Log other activity','activity',false,'activity')}</div>${state.activities?`<p class="library-footnote">${state.activities} sample ${state.activities===1?'activity':'activities'} added.</p>`:''}`;
    }

    function calendar() {
      const blanks=Array.from({length:4},()=>'<span aria-hidden="true"></span>').join('');
      return `<div class="demo-panel calendar-card"><div class="calendar-toolbar"><h3>October 2026</h3><span class="completion-count">Sample month</span></div><div class="calendar-week" aria-hidden="true">${['S','M','T','W','T','F','S'].map(day=>`<span>${day}</span>`).join('')}</div><div class="sample-calendar" role="group" aria-label="Choose a sample October day">${blanks}${Array.from({length:31},(_,index)=>{const day=index+1;return `<button type="button" data-day="${day}" class="${day===state.day?'selected ':''}${[5,7,9,12,14,16].includes(day)?'has-workout':''}" aria-pressed="${day===state.day}" aria-label="October ${day}, 2026${[5,7,9,12,14,16].includes(day)?', sample workout':''}">${day}</button>`;}).join('')}</div></div><p class="calendar-selected">Selected: <strong>October ${state.day}</strong></p><section class="demo-panel"><div class="panel-top"><div><h3>${state.day===12?'Your saved workout':'Build your next workout'}</h3><p>${state.day===12?`${state.workout.length} sample exercises planned`:'Choose exercises for this sample day.'}</p></div>${icon('calendar')}</div></section><div class="action-stack">${button('Add exercise','exercises',true,'plus')}${button('View workout','today',false,'arrow')}</div>`;
    }

    function libraryResults() {
      const filtered=exercises.filter(item=>(state.group==='All groups'||item.group===state.group)&&item.name.toLowerCase().includes(state.query.toLowerCase()));
      return filtered.length?filtered.map(item=>{const added=state.workout.includes(item.id);return `<article class="exercise-result"><div class="exercise-symbol">${icon(item.group==='Cardio'?'activity':'exercise')}</div><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.group)}</p></div><button type="button" data-add="${item.id}" aria-pressed="${added}" aria-label="${added?'Already in sample workout':'Add to sample workout'}: ${escapeHtml(item.name)}">${added?'Added':'Add'}</button></article>`;}).join(''):'<p class="result-empty">No sample exercises match. Try another search.</p>';
    }

    function library() {
      return `<label class="demo-search">${icon('search')}<span class="visually-hidden">Search sample exercises</span><input type="search" data-search placeholder="Search exercises…" value="${escapeHtml(state.query)}"></label><label class="demo-filter">Muscle group<select data-filter aria-label="Filter sample exercises by muscle group">${['All groups','Chest','Back','Legs','Arms','Cardio','Cooldown'].map(group=>`<option${state.group===group?' selected':''}>${group}</option>`).join('')}</select></label><div class="library-results">${libraryResults()}</div><p class="library-footnote">Six sample moves. Your full app keeps all 425 exercises.</p><div class="action-stack">${button('View workout','today',true,'arrow')}${button('Find from a machine photo','machine',false,'image')}</div>`;
    }

    function nutrition() {
      return `<div class="mini-stats"><div class="mini-stat"><span>Calories logged</span><strong>${1240+state.foods*320}<small>kcal</small></strong></div><div class="mini-stat"><span>Protein</span><strong>${78+state.foods*18}<small>g</small></strong></div></div><section class="demo-panel"><div class="panel-top"><div><h3>Meals & snacks</h3><p>Sample food diary</p></div>${icon('food')}</div><div class="food-row"><div><strong>Breakfast</strong><p>Oats, yogurt & banana</p></div><span>420 kcal</span></div><div class="food-row"><div><strong>Lunch</strong><p>Chicken & rice bowl</p></div><span>650 kcal</span></div><div class="food-row"><div><strong>Snack</strong><p>Apple & almonds</p></div><span>170 kcal</span></div>${state.foods?`<div class="food-row"><div><strong>Added in this example</strong><p>${state.foods} sample ${state.foods===1?'snack':'snacks'}</p></div><span>${state.foods*320} kcal</span></div>`:''}</section>${button('Log food','food',true,'plus')}<div class="water-row"><div class="water-total"><span>Water logged</span><strong>${state.water.toLocaleString()} mL</strong></div>${button('+ 250 mL','water',false,'water')}</div>`;
    }

    function progress() {
      return `<div class="progress-banner"><span>YOUR CONSISTENCY IS BUILDING</span><strong>2 of 3 workout days</strong><p>One more session reaches this sample weekly goal.</p></div><section class="demo-panel"><div class="panel-top"><div><h3>Training time</h3><p>This sample week · 40 minutes</p></div>${icon('chart')}</div><div class="chart" role="img" aria-label="Sample week: Monday 25 minutes, Wednesday 15 minutes; other days zero.">${[['M',82],['T',2],['W',50],['T',2],['F',2],['S',2],['S',2]].map(([day,height],index)=>`<div class="chart-column${index===2?' current':''}"><div class="chart-bar" style="height:${height}%"></div><span>${day}</span></div>`).join('')}</div><p class="chart-label">Small sessions still move you forward.</p></section><section class="demo-panel"><div class="panel-top"><h3>Personal best</h3></div><div class="record-row">${icon('trophy')}<div><strong>Dumbbell bench press</strong><p>12 kg · up from 10 kg</p></div></div></section>${button('View workout calendar','calendar',false,'calendar')}`;
    }

    function render() {
      const current=route();
      const heading=state.screen==='home'?'Home':state.screen==='train'?'Train':({today:'Today',calendar:'Calendar',exercises:'Exercises',nutrition:'Nutrition',progress:'Progress'}[current]);
      const descriptions={today:'Your workout, one move at a time.',calendar:'Pick a day to plan or review.',exercises:'Find a move. Add it to your workout.',nutrition:'Your food and water, in one place.',progress:'See the progress behind your effort.'};
      const subnav=state.screen==='train'?`<div class="subnav" role="group" aria-label="Training screens">${[['workout','Workout'],['exercises','Exercises'],['calendar','Calendar']].map(([key,label])=>`<button type="button" data-train="${key}" aria-pressed="${state.trainTab===key}">${label}</button>`).join('')}</div>`:'';
      content.innerHTML=`<div class="screen-header"><div><p class="screen-eyebrow">Your training quest</p><h3 class="screen-title" tabindex="-1">${heading}</h3></div><button type="button" class="day-chip" data-action="calendar" aria-label="Open sample calendar">${icon('calendar')}Oct ${state.day}</button></div><p class="demo-description">${descriptions[current]}</p>${subnav}${({today:workout,calendar,exercises:library,nutrition,progress}[current]||workout)()}`;
      root.querySelectorAll('[data-screen]').forEach(navButton=>{
        const active=navButton.dataset.screen===state.screen||(variant==='c'&&state.screen==='exercises'&&navButton.dataset.screen==='today');
        if(active)navButton.setAttribute('aria-current','page');else navButton.removeAttribute('aria-current');
      });
    }

    function closeSheet(restore=true) {
      if(!state.sheet)return;
      sheet.hidden=true;scrim.hidden=true;state.sheet=null;
      tools.setAttribute('aria-expanded','false');
      root.querySelector('[data-screen="quick"]')?.setAttribute('aria-expanded','false');
      if(restore&&state.returnFocus?.isConnected)state.returnFocus.focus();
    }

    function showSheet(type) {
      if(state.sheet===type){closeSheet();return;}
      state.returnFocus=document.activeElement;
      state.sheet=type;
      const titles={tools:'Your tools',quick:'Add to your day',activity:'Log a sample activity',food:'Log sample food',machine:'Machine photo'};
      const choice=(label,action,graphic,detail='')=>`<button type="button" class="sheet-choice" data-action="${action}">${icon(graphic)}<span>${label}${detail?`<small>${detail}</small>`:''}</span></button>`;
      let body='';
      if(type==='tools')body=`<p class="sheet-label">Workout tools</p>${choice('Import screenshot','import','import')}${choice('Saved screenshots','screenshots','image')}<p class="sheet-label">App</p>${choice('Share Gym Stone','share','share')}${choice('Install app','install','install')}<p class="sheet-helper">This example shows where the tools live.</p>`;
      if(type==='quick')body=`${choice('Exercise','exercises','exercise','Browse the exercise library')}${choice('Other activity','activity','activity','Add walking, running, or your own activity')}${choice('Import screenshot','import','import','Bring in a watch workout')}<p class="sheet-helper">Add to your sample selected day.</p>`;
      if(type==='activity')body='<form class="sample-form" data-form="activity"><label>Activity<input name="activity" value="Outdoor walk" maxlength="60" required></label><label>Minutes<input name="minutes" type="number" min="1" max="1440" value="20" required></label><button type="submit" class="demo-button primary">Add sample activity</button></form>';
      if(type==='food')body='<form class="sample-form" data-form="food"><label>Food or meal<input name="food" value="Yogurt & fruit" maxlength="60" required></label><label>Meal<select name="meal"><option>Snack</option><option>Breakfast</option><option>Lunch</option><option>Dinner</option></select></label><p class="sheet-helper">Sample portion: 320 kcal · 18 g protein</p><button type="submit" class="demo-button primary">Save sample food</button></form>';
      if(type==='machine')body=`<p class="demo-description">In the app, take or upload a machine photo to find matching exercises.</p>${button('Try a sample match','sample-machine',true,'search')}<p class="sheet-helper">This preview uses a sample result and does not access your camera.</p>`;
      sheet.classList.toggle('is-tools',type==='tools');
      sheet.innerHTML=`<div class="sheet-heading"><h3 id="${ids('sheet-title')}">${titles[type]}</h3><button type="button" class="sheet-close" data-action="close-sheet" aria-label="Close ${titles[type].toLowerCase()}">${icon('close')}</button></div>${body}`;
      sheet.hidden=false;scrim.hidden=false;
      tools.setAttribute('aria-expanded',String(type==='tools'));
      root.querySelector('[data-screen="quick"]')?.setAttribute('aria-expanded',String(type==='quick'));
      sheet.querySelector('input,select,.sheet-choice,.demo-button,.sheet-close')?.focus();
    }

    root.addEventListener('click', event => {
      const clicked=event.target.closest('button');
      if(!clicked&&event.target!==scrim)return;
      if(event.target===scrim){closeSheet();return;}
      if(clicked.dataset.screen){if(clicked.dataset.screen==='quick')showSheet('quick');else navigate(clicked.dataset.screen);return;}
      if(clicked.dataset.train){state.trainTab=clicked.dataset.train;render();content.querySelector(`[data-train="${state.trainTab}"]`)?.focus();return;}
      if(clicked.dataset.complete){const id=clicked.dataset.complete;state.completed.has(id)?state.completed.delete(id):state.completed.add(id);render();content.querySelector(`[data-complete="${id}"]`)?.focus();return;}
      if(clicked.dataset.day){state.day=Number(clicked.dataset.day);render();content.querySelector(`[data-day="${state.day}"]`)?.focus();return;}
      if(clicked.dataset.add){const id=clicked.dataset.add;if(state.workout.includes(id)){notify('This move is already in your sample workout.');return;}state.workout.push(id);content.querySelector('.library-results').innerHTML=libraryResults();content.querySelector(`[data-add="${id}"]`)?.focus();notify('Exercise added to your sample workout.');return;}
      const action=clicked.dataset.action;
      if(['today','calendar','exercises','nutrition','progress'].includes(action)){navigate(action);return;}
      if(['tools','quick','activity','food','machine'].includes(action)){showSheet(action);return;}
      if(action==='close-sheet'){closeSheet();return;}
      if(action==='water'){state.water+=250;render();content.querySelector('[data-action="water"]')?.focus();notify('250 mL added to this sample diary.');return;}
      if(action==='sample-machine'){state.query='';state.group='Back';navigate('exercises');notify('Sample machine matched: seated cable row.');return;}
      if(['import','screenshots','share','install'].includes(action)){
        closeSheet();
        notify({import:'Import selected. In the app, choose a workout screenshot.',screenshots:'Saved screenshots opens your imported workout images in the app.',share:'Share opens the app link and QR code in the app.',install:'Install opens the browser installation steps in the app.'}[action]);
      }
    });
    root.addEventListener('input',event=>{if(event.target.matches('[data-search]')){state.query=event.target.value;content.querySelector('.library-results').innerHTML=libraryResults();}});
    root.addEventListener('change',event=>{if(event.target.matches('[data-filter]')){state.group=event.target.value;content.querySelector('.library-results').innerHTML=libraryResults();}});
    root.addEventListener('submit',event=>{
      const form=event.target.closest('[data-form]');if(!form)return;
      event.preventDefault();
      if(form.dataset.form==='activity'){state.activities++;closeSheet(false);navigate('today');notify('Sample activity added. Your real workout data is unchanged.');}
      if(form.dataset.form==='food'){state.foods++;closeSheet(false);navigate('nutrition');notify('Sample food saved in this example.');}
    });
    root.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.sheet){event.preventDefault();closeSheet();}});
    render();
    return {close:()=>closeSheet(false)};
  }

  const examples={a:createExample('a'),b:createExample('b'),c:createExample('c')};
  const compact=window.matchMedia('(max-width:1080px)');
  let selected='a';
  function selectOption(key) {
    selected=key;
    document.querySelectorAll('[data-option]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.option===selected)));
    document.querySelectorAll('.option-card').forEach(card=>{
      const current=card.id===`option-${selected}`;
      card.classList.toggle('is-selected',current);
      card.hidden=compact.matches&&!current;
      if(card.hidden)examples[card.id.slice(-1)].close();
    });
  }
  document.querySelector('.option-picker').addEventListener('click',event=>{const button=event.target.closest('[data-option]');if(button)selectOption(button.dataset.option);});
  compact.addEventListener('change',()=>selectOption(selected));
  selectOption(selected);
})();
