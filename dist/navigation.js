/* Keep the existing calendar and storage model; give each task its own screen. */
(() => {
  const main = document.querySelector('main');
  const icons = {today:'⌂', calendar:'▦', exercises:'◇', progress:'▥'};
  const labels = {today:'Today', calendar:'Calendar', exercises:'Exercises', progress:'Progress'};
  const nav = document.createElement('nav');
  nav.className = 'app-nav'; nav.setAttribute('aria-label','Main navigation');
  nav.innerHTML = '<div class="nav-brand">GYM STONE<span>Your training quest</span></div>' + Object.keys(labels).map(key => `<button type="button" data-screen="${key}"><span aria-hidden="true">${icons[key]}</span>${labels[key]}</button>`).join('') + '<button type="button" id="more-menu-toggle" aria-expanded="false" aria-controls="more-menu"><span aria-hidden="true">•••</span>More</button>';
  document.body.prepend(nav);
  const menu = document.createElement('div'); menu.id='more-menu'; menu.hidden=true;
  const utilities = [['import-screenshot','Import screenshot'],['open-screenshots','Saved screenshots'],['share-game','Share app'],['download-app','Install app']];
  for (const [id,label] of utilities) { const button=document.getElementById(id);button.textContent=label;menu.append(button); }
  document.body.append(menu);
  const more=document.getElementById('more-menu-toggle');
  function closeMore(){menu.hidden=true;more.setAttribute('aria-expanded','false');}
  more.onclick=()=>{menu.hidden=!menu.hidden;more.setAttribute('aria-expanded',String(!menu.hidden));};
  menu.addEventListener('click',closeMore);
  document.addEventListener('click',event=>{if(!menu.contains(event.target)&&!more.contains(event.target))closeMore();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){closeMore();more.focus();}});
  document.querySelector('.watch-import').remove();
  const intro=document.querySelector('.intro');intro.querySelector('h1').textContent='Today';intro.querySelector('.eyebrow').textContent='YOUR TRAINING QUEST';intro.querySelector('p').textContent='Your workout, one move at a time.';
  const heading=intro.querySelector('h1');heading.tabIndex=-1;
  const workspace=document.querySelector('.workspace'),calendar=document.querySelector('.calendar'),daily=document.querySelector('.daily');
  const calendarHome=document.createElement('section');calendarHome.className='calendar-screen';main.insertBefore(calendarHome,workspace);
  const dailyActions=document.createElement('div');dailyActions.className='daily-actions';dailyActions.innerHTML='<button type="button" class="primary" id="choose-exercises">＋ Add exercise</button><button type="button" class="secondary" id="log-activity">Log activity</button><button type="button" class="secondary" id="quick-import">Import screenshot</button>';daily.append(dailyActions);
  const summary=document.createElement('button');summary.className='week-summary';summary.type='button';summary.innerHTML='<span>This week</span><strong id="summary-hours">0 h</strong><span>View progress →</span>';main.insertBefore(summary,document.querySelector('.activity'));
  const activity=document.querySelector('.activity'),goals=document.getElementById('training-goal'),library=document.querySelector('.library'),stats=document.querySelector('.stats');
  const targets=document.createElement('div');targets.className='progress-date';targets.innerHTML='<label>View progress for <input type="date" id="progress-date"></label>';activity.prepend(targets);
  document.getElementById('progress-date').onchange=event=>{const value=event.target.value;if(/^\d{4}-\d{2}-\d{2}$/.test(value)&&dateKey(new Date(value+'T12:00:00'))===value)originalSelect(value);};
  let screen='today';
  function showScreen(next,focus=true){
    if(!labels[next])next='today';screen=next;document.body.dataset.screen=next;
    for(const button of nav.querySelectorAll('[data-screen]')){const active=button.dataset.screen===next;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
    heading.textContent=labels[next];intro.querySelector('p').textContent={today:'Your workout, one move at a time.',calendar:'Choose a day to plan or review your workout.',exercises:'Search, preview, and add moves to your selected day.',progress:'See your training time, strength totals, and goals.'}[next];
    workspace.hidden=!['today','calendar'].includes(next);calendarHome.hidden=next!=='calendar';library.hidden=next!=='exercises';activity.hidden=next!=='progress';stats.hidden=!['today','progress'].includes(next);summary.hidden=next!=='today';
    if(next==='calendar'){calendarHome.append(calendar);calendarHome.append(daily);}else{workspace.append(calendar);workspace.append(daily);}
    workspace.classList.toggle('today-workspace',next==='today');
    document.getElementById('today').hidden=!['today','calendar'].includes(next);
    goals.dataset.screenOnly='progress';
    closeMore();if(location.hash!== '#'+next)history.replaceState(null,'','#'+next);window.scrollTo(0,0);if(focus)heading.focus({preventScroll:true});
  }
  nav.addEventListener('click',event=>{const button=event.target.closest('button[data-screen]');if(button)showScreen(button.dataset.screen);});
  document.getElementById('choose-exercises').onclick=()=>showScreen('exercises');
  document.getElementById('log-activity').onclick=()=>{setMode('done');document.getElementById('add-activity').click();};
  document.getElementById('quick-import').onclick=()=>document.getElementById('import-screenshot').click();
  summary.onclick=()=>showScreen('progress');
  const originalSelect=selectDay;selectDay=function(key){originalSelect(key);if(screen==='progress')showScreen('calendar');};
  const originalRender=render;render=function(){originalRender();document.getElementById('summary-hours').textContent=document.getElementById('week-hours').textContent;document.getElementById('progress-date').value=selected;document.getElementById('picker-day').textContent=new Date(selected+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});};
  const filterLabel=document.createElement('label');filterLabel.className='muscle-select';filterLabel.innerHTML='Muscle group <select id="muscle-filter"><option>All moves</option></select>';document.getElementById('filters').before(filterLabel);
  const filters=document.getElementById('filters'),select=document.getElementById('muscle-filter');
  const syncFilters=()=>{const value=filter;select.replaceChildren(...Array.from(filters.children,button=>{const option=document.createElement('option');option.textContent=button.textContent;return option;}));select.value=value;};
  new MutationObserver(syncFilters).observe(filters,{childList:true});
  select.onchange=()=>{Array.from(filters.children).find(button=>button.textContent===select.value)?.click();};
  document.querySelector('.library h2').firstChild.textContent='Exercise library ';
  document.querySelector('.empty-day p')?.replaceChildren(document.createTextNode('Use Add exercise or Log activity to build your workout.'));
  const picker=document.createElement('div');picker.className='picker-footer';picker.innerHTML='<span>Adding to <strong id="picker-day"></strong></span><button type="button" class="primary" id="view-workout">View workout →</button>';library.append(picker);
  document.getElementById('view-workout').onclick=()=>showScreen('calendar');
  window.addEventListener('hashchange',()=>showScreen(location.hash.slice(1)));
  window.GymNavigation={show:showScreen};
  showScreen(location.hash.slice(1)||'today',false);render();
})();

