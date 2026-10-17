/* Keep the existing calendar and storage model; give each task its own screen. */
(() => {
  const main = document.querySelector('main');
  const paths = {
    today:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
    calendar:'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM16 3v4M8 3v4M3 11h18M8 15h2M14 15h2',
    exercises:'m6 6 12 12M4 9l5-5M15 20l5-5M2 7l5-5M17 22l5-5',
    nutrition:'M5 3v6a3 3 0 0 0 6 0V3M8 3v18M20 21V3c-4 2-5 7-4 10h4',
    progress:'M4 20h16M7 16v-4M12 16V8M17 16V4',
    tools:'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4'
  };
  const icon = key => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[key]}"></path></svg>`;
  const labels = {today:'Today', calendar:'Calendar', exercises:'Exercises', nutrition:'Nutrition', progress:'Progress'};
  const nav = document.createElement('nav');
  nav.className = 'app-nav'; nav.setAttribute('aria-label','Main navigation');
  nav.innerHTML = '<div class="nav-brand">GYM STONE<span>Your training quest</span></div>' + Object.keys(labels).map(key => `<button type="button" data-screen="${key}">${icon(key)}<span class="nav-label">${labels[key]}</span></button>`).join('');
  document.body.prepend(nav);
  const more = document.createElement('button');
  more.id='more-menu-toggle';more.type='button';more.className='secondary tools-toggle';
  more.setAttribute('aria-haspopup','dialog');more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','more-menu');
  more.innerHTML=icon('tools')+'<span>Tools</span>';
  document.querySelector('.header-right').prepend(more);
  const menu = document.createElement('dialog');menu.id='more-menu';menu.setAttribute('aria-labelledby','tools-title');
  menu.innerHTML='<div class="tools-heading"><h2 id="tools-title">Tools & shortcuts</h2><button type="button" class="secondary" id="close-tools" aria-label="Close tools">Close</button></div>';
  for (const [title,utilities] of [['Workout tools',[['import-screenshot','Import screenshot'],['open-screenshots','Saved screenshots']]],['App',[['share-game','Share app'],['download-app','Install app']]]]) {
    const group=document.createElement('section');group.className='tools-group';
    const titleElement=document.createElement('h3');titleElement.textContent=title;group.append(titleElement);
    for(const [id,label] of utilities){const button=document.getElementById(id);button.textContent=label;button.type='button';group.append(button);}
    menu.append(group);
  }
  const examples=document.createElement('a');examples.href='navigation-options.html';examples.className='navigation-examples-link';examples.textContent='Compare 3 navigation examples →';menu.append(examples);
  document.body.append(menu);
  function closeMore(){if(menu.open)menu.close();more.setAttribute('aria-expanded','false');}
  more.onclick=()=>{menu.showModal();more.setAttribute('aria-expanded','true');};
  document.getElementById('close-tools').onclick=closeMore;
  menu.addEventListener('close',()=>more.setAttribute('aria-expanded','false'));
  menu.addEventListener('click',event=>{if(event.target.closest('.tools-group button'))closeMore();},true);
  menu.addEventListener('click',event=>{if(event.target===menu){const bounds=menu.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeMore();}});
  document.querySelector('.watch-import').remove();
  const intro=document.querySelector('.intro');intro.querySelector('h1').textContent='Today';intro.querySelector('.eyebrow').textContent='YOUR TRAINING QUEST';intro.querySelector('p').textContent='Your workout, one move at a time.';
  const heading=intro.querySelector('h1');heading.tabIndex=-1;
  const workspace=document.querySelector('.workspace'),calendar=document.querySelector('.calendar'),daily=document.querySelector('.daily');
  const calendarHome=document.createElement('section');calendarHome.className='calendar-screen';main.insertBefore(calendarHome,workspace);
  const dailyActions=document.createElement('div');dailyActions.className='daily-actions';dailyActions.innerHTML='<button type="button" class="primary" id="choose-exercises">＋ Add exercise</button><button type="button" class="secondary" id="log-activity">Log activity</button>';daily.append(dailyActions);
  const summary=document.createElement('button');summary.className='week-summary';summary.type='button';summary.innerHTML='<span>This week</span><strong id="summary-hours">0 h</strong><span>View progress →</span>';main.insertBefore(summary,document.querySelector('.activity'));
  const activity=document.querySelector('.activity'),goals=document.getElementById('training-goal'),library=document.querySelector('.library'),stats=document.querySelector('.stats');
  const targets=document.createElement('div');targets.className='progress-date';targets.innerHTML='<label>View progress for <input type="date" id="progress-date"></label>';activity.prepend(targets);
  document.getElementById('progress-date').onchange=event=>{const value=event.target.value;if(/^\d{4}-\d{2}-\d{2}$/.test(value)&&dateKey(new Date(value+'T12:00:00'))===value)originalSelect(value);};
  let screen='today';
  function showScreen(next,focus=true,historyMode='push'){
    if(!labels[next])next='today';screen=next;document.body.dataset.screen=next;
    if(next==='today'&&selected!==today)originalSelect(today);
    for(const button of nav.querySelectorAll('[data-screen]')){const active=button.dataset.screen===next;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
    heading.textContent=labels[next];intro.querySelector('p').textContent={today:'Your workout, one move at a time.',calendar:'Choose a day to plan or review your workout.',exercises:'Search, preview, and add moves to your selected day.',nutrition:'Track your meals, macros, and water each day.',progress:'Track your weight, distance, speed, and personal bests.'}[next];
    workspace.hidden=!['today','calendar'].includes(next);calendarHome.hidden=next!=='calendar';library.hidden=next!=='exercises';activity.hidden=next!=='progress';stats.hidden=!['today','progress'].includes(next);summary.hidden=next!=='today';
    document.getElementById('nutrition-section').hidden=next!=='nutrition';
    if(next==='calendar'){calendarHome.append(calendar);calendarHome.append(daily);}else{workspace.append(calendar);workspace.append(daily);}
    workspace.classList.toggle('today-workspace',next==='today');
    document.getElementById('today').hidden=!['today','calendar'].includes(next);
    goals.dataset.screenOnly='progress';
    closeMore();if(location.hash!== '#'+next){if(historyMode==='push')history.pushState(null,'','#'+next);else history.replaceState(null,'','#'+next);}window.scrollTo(0,0);if(focus)heading.focus({preventScroll:true});
  }
  nav.addEventListener('click',event=>{const button=event.target.closest('button[data-screen]');if(button)showScreen(button.dataset.screen);});
  document.getElementById('choose-exercises').onclick=()=>showScreen('exercises');
  document.getElementById('log-activity').onclick=()=>{setMode('done');document.getElementById('add-activity').click();};
  summary.onclick=()=>showScreen('progress');
  const originalSelect=selectDay;selectDay=function(key){originalSelect(key);if(screen==='progress'||(screen==='today'&&key!==today))showScreen('calendar');};
  const originalRender=render;render=function(){originalRender();document.getElementById('summary-hours').textContent=document.getElementById('week-hours').textContent;document.getElementById('progress-date').value=selected<today?selected:today;document.getElementById('progress-date').max=today;document.getElementById('picker-day').textContent=new Date(selected+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});};
  const filterLabel=document.createElement('label');filterLabel.className='muscle-select';filterLabel.innerHTML='Muscle group <select id="muscle-filter"><option>All moves</option></select>';document.getElementById('filters').before(filterLabel);
  const filters=document.getElementById('filters'),select=document.getElementById('muscle-filter');
  const syncFilters=()=>{const value=filter;select.replaceChildren(...Array.from(filters.children).filter(button=>!button.hidden).map(button=>{const option=document.createElement('option');option.textContent=button.textContent;return option;}));select.value=value;};
  new MutationObserver(syncFilters).observe(filters,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  select.onchange=()=>{Array.from(filters.children).find(button=>button.textContent===select.value)?.click();};
  document.querySelector('.library h2').firstChild.textContent='Exercise library ';
  document.querySelector('.empty-day p')?.replaceChildren(document.createTextNode('Use Add exercise or Log activity to build your workout.'));
  const picker=document.createElement('div');picker.className='picker-footer';picker.innerHTML='<span>Adding to <strong id="picker-day"></strong></span><button type="button" class="primary" id="view-workout">View workout →</button>';library.append(picker);
  document.getElementById('view-workout').onclick=()=>showScreen('calendar');
  window.addEventListener('hashchange',()=>showScreen(location.hash.slice(1),true,'replace'));
  window.GymNavigation={show:showScreen};
  showScreen(location.hash.slice(1)||'today',false,'replace');render();
})();

