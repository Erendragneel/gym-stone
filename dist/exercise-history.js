/* History is derived from the current player's existing calendar, including synced records. */
(() => {
  'use strict';
  const section=document.createElement('section');
  section.className='exercise-history';section.setAttribute('aria-labelledby','exercise-history-title');
  section.innerHTML='<div class="history-heading"><h3 id="exercise-history-title">Your exercise history</h3><span id="history-count"></span></div><div class="history-tabs" role="group" aria-label="Exercise history view"><button type="button" data-history="recent" aria-pressed="true">Recently used</button><button type="button" data-history="common" aria-pressed="false">Most used</button></div><p id="history-caption"></p><div id="history-grid" class="history-grid"></div><button id="history-more" type="button" hidden>Show all</button>';
  document.querySelector('.library').prepend(section);
  const grid=section.querySelector('#history-grid'),caption=section.querySelector('#history-caption'),more=section.querySelector('#history-more');
  const previewLimit=2;
  let mode='recent',expanded=false,owner=workoutCacheKey();
  function summarize(calendar,catalog,through,available) {
    const lookup=new Map(catalog.map(exercise=>[exercise.id,exercise])),history=new Map();
    for(const [day,entries] of Object.entries(calendar||{})) {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day>through||!Array.isArray(entries))continue;
      const seen=new Set();
      for(const row of entries) {
        const exercise=lookup.get(row?.id);
        if(!exercise||!available(exercise)||seen.has(row.id))continue;
        seen.add(row.id);
        const item=history.get(row.id)||{exercise,count:0,completed:0,lastDay:day,lastDone:false};
        item.count++;if(row.done)item.completed++;
        if(day>=item.lastDay){item.lastDay=day;item.lastDone=!!row.done;}
        history.set(row.id,item);
      }
    }
    return Array.from(history.values());
  }
  function lastUse(item) {
    const yesterday=new Date(today+'T12:00:00');yesterday.setDate(yesterday.getDate()-1);
    const when=item.lastDay===today?'today':item.lastDay===dateKey(yesterday)?'yesterday':new Date(item.lastDay+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',...(item.lastDay.slice(0,4)!==today.slice(0,4)?{year:'numeric'}:{})});
    return (item.lastDone?'Completed ':'Planned ')+when;
  }
  function render(calendar,catalog) {
    const nextOwner=workoutCacheKey();if(nextOwner!==owner){owner=nextOwner;expanded=false;mode='recent';}
    const history=summarize(calendar,catalog,today,exerciseAvailable);
    history.sort((a,b)=>(mode==='common'?b.count-a.count:0)||b.lastDay.localeCompare(a.lastDay)||a.exercise.name.localeCompare(b.exercise.name));
    section.querySelector('#history-count').textContent=history.length?history.length+' moves':'';
    section.querySelectorAll('[data-history]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.history===mode)));
    caption.textContent=history.length?(mode==='recent'?'Last used, newest first':'Your most-used exercises, most frequent first'):'Exercises you plan or complete on today or past days will appear here.';
    // Keep keyboard focus on the same exercise when saving causes a rerender.
    const focused=document.activeElement,focusId=focused?.closest('[data-history-id]')?.dataset.historyId,focusAction=focused?.classList.contains('exercise-visual')?'preview':focused?.classList.contains('add-exercise')?'add':null;
    grid.replaceChildren();
    for(const item of expanded?history:history.slice(0,previewLimit)) {
      const card=createExerciseCard(item.exercise);card.className='history-exercise-card';card.dataset.historyId=item.exercise.id;
      const visual=card.querySelector('.exercise-visual'),button=card.querySelector('.add-exercise');
      visual.setAttribute('aria-label','Preview from history: '+item.exercise.name);
      button.setAttribute('aria-label',(button.disabled?'Already added from history: ':'Add again to selected day: ')+item.exercise.name);
      const metadata=document.createElement('p');metadata.className='history-last-use';metadata.textContent=lastUse(item);
      const frequency=document.createElement('span');frequency.className='history-frequency';frequency.textContent='Used on '+item.count+' '+(item.count===1?'day':'days');
      if(mode==='common')metadata.append(document.createElement('br'),frequency);
      card.querySelector('h3').after(metadata);grid.append(card);
      if(focusId===item.exercise.id&&focusAction)(focusAction==='preview'||button.disabled?visual:button).focus({preventScroll:true});
    }
    more.hidden=history.length<=previewLimit;more.textContent=expanded?'Show fewer':'Show all '+history.length+' exercises';more.setAttribute('aria-expanded',String(expanded));
  }
  section.querySelectorAll('[data-history]').forEach(button=>button.onclick=()=>{mode=button.dataset.history;expanded=false;render(records,exercises);});
  more.onclick=()=>{expanded=!expanded;render(records,exercises);};
  window.GymExerciseHistory={render,summarize};
  render(records,exercises);
})();
