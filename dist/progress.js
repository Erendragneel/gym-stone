(() => {
  'use strict';
  const data=window.GymProgressData;
  let chosenGroup='',chosenMetric='',current=null;
  const announced=new Set();
  const section=document.createElement('section');section.id='performance-progress';section.className='performance-progress';
  section.setAttribute('aria-labelledby','performance-title');
  section.innerHTML='<div class="performance-heading"><div><span class="eyebrow">YOUR PERSONAL BESTS</span><h2 id="performance-title">See how far you have come</h2></div><span id="performance-through"></span></div><div id="record-totals" class="record-totals"></div><p class="record-reward-rule">Beat an earlier personal best to earn +50 bonus XP. One bonus per completed workout; your first log sets the starting point.</p><div id="performance-empty" class="performance-empty" hidden>Log a completed exercise with its weight, reps, distance or hold time to start tracking your results.</div><div id="performance-results"><div class="performance-filters"><label>Exercise or activity<select id="progress-exercise" aria-label="Exercise or activity for progress"></select></label><label>Compare<select id="progress-metric" aria-label="Progress metric"></select></label></div><div id="latest-result" class="latest-result"></div><div id="result-comparisons" class="result-comparisons"></div><p id="last-different-result" class="last-different-result" hidden></p><div class="result-chart-heading"><h3 id="result-chart-title"></h3><span id="result-chart-note"></span></div><div id="result-chart" class="result-chart"></div><div class="result-history"><table><caption>Recent logged results</caption><thead><tr><th scope="col">Date</th><th scope="col">Result</th><th scope="col">From previous</th><th scope="col">Personal best</th></tr></thead><tbody id="result-history-body"></tbody></table></div></div><div id="recent-records" class="recent-records"></div>';
  document.getElementById('progress-date').closest('.progress-date').after(section);
  const get=id=>document.getElementById(id),element=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node};
  const date=day=>new Date(day+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  const number=value=>Number(value.toFixed(3)).toLocaleString(undefined,{maximumFractionDigits:3});
  function unit(key,point){return key==='weight'||key==='assistance'?point.weightUnit:key==='distance'?point.distanceUnit:key==='speed'?point.distanceUnit==='mi'?'mph':'km/h':key==='hold'?'min':'reps'}
  function amount(value,key,point){const chosen=unit(key,point);return value/(chosen==='lb'?data.KG_PER_LB:chosen==='mi'||chosen==='mph'?data.KM_PER_MI:chosen==='m'?0.001:1)}
  function format(value,key,point){return number(amount(value,key,point))+' '+unit(key,point)}
  function pace(speed,point){const miles=point.distanceUnit==='mi',seconds=Math.round(3600/speed*(miles?data.KM_PER_MI:1));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+' /'+(miles?'mi':'km')}
  function change(latest,previous,key,point){
    if(previous===null)return 'Starting log';if(data.equal(latest,previous,key))return 'No change';
    const delta=latest-previous,percent=previous===0?null:Math.abs(delta/previous*100);
    const difference=(delta>0?'+':'−')+format(Math.abs(delta),key,point);
    return difference+(percent===null?'':' ('+(delta>0?'+':'−')+number(percent)+'%)');
  }
  function comparison(label,point,latest,key){
    const card=element('div',null,'comparison-card');card.append(element('span',label));
    card.append(element('strong',point?format(point.value,key,latest):'No earlier log'));
    if(point){card.append(element('small',date(point.day)));if(label!=='Personal best')card.append(element('p',change(latest.value,point.value,key,latest),(latest.value-point.value)*data.definitions[key].direction>0&&!data.equal(latest.value,point.value,key)?'result-gain':'result-change'))}
    return card;
  }
  function drawChart(series,key,latest){
    const NS='http://www.w3.org/2000/svg',chart=get('result-chart');chart.replaceChildren();
    const points=series.slice(-24),svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 640 220');svg.setAttribute('role','img');svg.setAttribute('aria-label',data.definitions[key].label+' history for '+current.groups.find(group=>group.key===chosenGroup)?.name);
    const make=(tag,attrs,text)=>{const node=document.createElementNS(NS,tag);for(const [name,value]of Object.entries(attrs))node.setAttribute(name,String(value));if(text!=null)node.textContent=text;svg.append(node);return node};
    const max=Math.max(1,...points.map(point=>amount(point.value,key,latest)))*1.15;
    for(let tick=0;tick<3;tick++){const y=175-tick*72;make('line',{x1:66,y1:y,x2:610,y2:y,class:'result-grid'});make('text',{x:56,y:y+5,'text-anchor':'end',class:'result-axis'},number(max*tick/2))}
    const coords=points.map((point,index)=>({point,x:points.length===1?338:66+index/(points.length-1)*544,y:175-amount(point.value,key,latest)/max*144}));
    make('polyline',{points:coords.map(({x,y})=>x+','+y).join(' '),class:'result-line'});
    for(const {point,x,y}of coords){const dot=make('circle',{cx:x,cy:y,r:point===latest?6:4,class:point.isRecord?'result-dot record-dot':'result-dot'});const title=document.createElementNS(NS,'title');title.textContent=date(point.day)+' · '+format(point.value,key,latest);dot.append(title)}
    make('text',{x:66,y:205,class:'result-axis'},date(points[0].day));make('text',{x:610,y:205,'text-anchor':'end',class:'result-axis'},date(points.at(-1).day));
    chart.append(svg);get('result-chart-note').textContent=points.length+' logged result'+(points.length===1?'':'s')+' · '+unit(key,latest);
  }
  function renderResult(){
    if(!current?.groups.length)return;
    const group=current.groups.find(group=>group.key===chosenGroup)||current.groups[0];chosenGroup=group.key;get('progress-exercise').value=chosenGroup;
    const metrics=Object.keys(group.series);if(!metrics.includes(chosenMetric))chosenMetric=metrics[0];
    const metricSelect=get('progress-metric');metricSelect.replaceChildren(...metrics.map(key=>{const option=element('option',data.definitions[key].label);option.value=key;return option}));metricSelect.value=chosenMetric;
    const key=chosenMetric,series=group.series[key],{latest,first,previous,best,lastDifferent}=data.stats(series,key),definition=data.definitions[key];
    const hero=get('latest-result');hero.replaceChildren();const heading=element('div');heading.append(element('span','Latest · '+date(latest.day)),element('strong',format(latest.value,key,latest)));
    if(key==='speed')heading.append(element('p','Pace '+pace(latest.value,latest)));
    if(key==='weight'&&latest.sets&&latest.reps)heading.append(element('p',latest.sets+' sets × '+latest.reps+' reps / set'));
    if(key==='assistance')heading.append(element('p','Less assistance is an improvement.'));
    hero.append(heading);
    hero.append(element('span',latest.isRecord?definition.recordLabel:series.length===1?'Starting log':data.equal(latest.value,best.value,key)?'Matched best':'Latest result',latest.isRecord?'personal-record-badge':'result-status'));
    if(latest.isRecord)hero.append(element('span','+50 bonus XP','record-xp'));
    const comparisons=get('result-comparisons');comparisons.replaceChildren(comparison('First log',first,latest,key),comparison('Previous log',previous,latest,key),comparison('Personal best',best,latest,key));
    get('last-different-result').hidden=!['weight','assistance'].includes(key)||!lastDifferent;
    if(lastDifferent)get('last-different-result').textContent='Last different '+(key==='assistance'?'assistance':'weight')+': '+format(lastDifferent.value,key,latest)+' on '+date(lastDifferent.day)+' · '+change(latest.value,lastDifferent.value,key,latest);
    get('result-chart-title').textContent=definition.label+' over time';drawChart(series,key,latest);
    const body=get('result-history-body');body.replaceChildren();
    series.slice(-8).reverse().forEach(point=>{const index=series.indexOf(point),row=document.createElement('tr');row.append(element('td',date(point.day)),element('td',format(point.value,key,latest)),element('td',change(point.value,index?series[index-1].value:null,key,latest)),element('td',point.isRecord?definition.recordLabel:index===0?'Starting log':'—',point.isRecord?'record-history-best':''));body.append(row)});
  }
  function render(snapshot,records,lookup,selected,today){
    const through=selected<today?selected:today;current=through===today?snapshot:data.build(records,lookup,{through});
    get('performance-through').textContent='Through '+date(through);
    get('record-totals').replaceChildren(...[['Personal best workouts',current.achievements.length],['Bonus XP earned','+'+current.bonusXP],['Tracked exercises',current.groups.length]].map(([label,value])=>{const card=element('div');card.append(element('span',label),element('strong',String(value)));return card}));
    get('performance-empty').hidden=!!current.groups.length;get('performance-results').hidden=!current.groups.length;
    get('progress-exercise').replaceChildren(...current.groups.map(group=>{const option=element('option',group.name);option.value=group.key;return option}));renderResult();
    const recent=get('recent-records');recent.replaceChildren();
    if(current.achievements.length){recent.append(element('h3','Recent personal bests'));for(const award of current.achievements.slice(-5).reverse()){
      const button=element('button',null,'achievement-card');button.type='button';button.setAttribute('aria-label','View personal best for '+award.name+' on '+date(award.day));
      const content=element('span');content.append(element('strong',award.name),element('small',date(award.day)),element('span',award.records.map(result=>data.definitions[result.metric].recordLabel+': '+format(result.value,result.metric,result.point)).join(' · ')));
      button.append(content,element('b','+50 XP'));button.onclick=()=>{chosenGroup=award.groupKey;chosenMetric=award.records[0].metric;renderResult();get('progress-exercise').focus()};recent.append(button);
    }}
  }
  function announce(previous,next,day=null,currentSnapshot=next){
    const owner=window.GymCloud?.user?.id||'guest';
    const earned=next.achievements.filter(award=>(!day||award.day===day)&&!previous?.byEntry?.[award.token]&&currentSnapshot?.byEntry?.[award.token]&&!announced.has(owner+'|'+award.token));if(!earned.length)return;
    const token=earned.at(-1).token,announcementKey=owner+'|'+token;announced.add(announcementKey);
    window.setTimeout(()=>{
      const award=progressSnapshot?.byEntry?.[token];
      if(!award||(window.GymCloud?.user?.id||'guest')!==owner){announced.delete(announcementKey);return}
      const record=award.records[0];notify('🏆 '+award.name+' · '+data.definitions[record.metric].recordLabel+': '+format(record.value,record.metric,record.point)+' · +50 bonus XP');
    },0);
  }
  window.addEventListener('gym-account-changed',()=>announced.clear());
  get('progress-exercise').onchange=event=>{chosenGroup=event.target.value;chosenMetric='';renderResult()};get('progress-metric').onchange=event=>{chosenMetric=event.target.value;renderResult()};
  window.GymProgress={render,announce};
  // The app owns the current player records and its normal rendering lifecycle.
  window.render();
})();
