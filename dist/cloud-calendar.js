(() => {
  'use strict';
  let active=null;
  const clone=value=>structuredClone(value);
  // Postgres JSONB can return object keys in a different order. Compare JSON
  // values instead of insertion order, or accepted saves stay in the outbox.
  const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,ordered(value[key])])):value;
  const same=(a,b)=>JSON.stringify(ordered(a||[]))===JSON.stringify(ordered(b||[]));
  const player=()=>window.GymCloud?.user?.id||null;
  const current=ctx=>ctx===active&&ctx.owner===player();
  const meta=ctx=>clone({owner:ctx.owner,base:ctx.base,pending:ctx.pending,conflicts:ctx.conflicts});
  function status(ctx=active){
    if(!ctx||!current(ctx))return '● Saved on this device';
    if(Object.keys(ctx.conflicts).length)return '◉ Review sync changes';
    if(ctx.busy)return '○ Syncing…';
    if(ctx.error||Object.keys(ctx.pending).length)return '○ Saved on device · Sync pending';
    return '● Synced to your account';
  }
  function announce(ctx){if(current(ctx))window.dispatchEvent(new CustomEvent('gym-calendar-status',{detail:{text:status(ctx),conflicts:Object.keys(ctx.conflicts).length}}));}
  function reconcile(ctx,records){
    ctx.desired=clone(records);
    for(const day of new Set([...Object.keys(ctx.base),...Object.keys(records),...Object.keys(ctx.pending)])){
      const items=records[day]||[];
      if(same(items,ctx.base[day]?.items)){delete ctx.pending[day];delete ctx.conflicts[day];}
      else ctx.pending[day]=clone(items);
    }
  }
  function prepareSnapshot(records){
    if(!active||!current(active))return null;
    active.version++;
    const draft=meta(active);reconcile(draft,records);return meta(draft);
  }
  function commitSnapshot(records,saved){
    if(!active||!current(active)||saved?.owner!==active.owner)return;
    reconcile(active,records);
  }
  async function persist(ctx,includeRecords=false){
    if(!current(ctx))return;
    if(includeRecords)await GymScreenshotStore.putRecords(clone(ctx.desired),{syncMeta:meta(ctx)});
    else await GymScreenshotStore.putCalendarMeta(meta(ctx));
  }
  async function start(records){
    const owner=player();active=null;
    if(!owner)return records;
    const stored=await GymScreenshotStore.getCalendarMeta();
    if(owner!==player())return records;
    const ctx=active={owner,base:stored?.base||{},pending:stored?.pending||{},conflicts:stored?.conflicts||{},desired:clone(records),version:0,busy:false,error:false,worker:null};
    reconcile(ctx,records);
    // An outbox is committed with each local edit, before contacting the server.
    await persist(ctx);kick(true);return records;
  }
  async function refresh(ctx){
    const rows=await GymCloud.loadCalendar();if(!current(ctx))return;
    await GymScreenshotStore.whenIdle();if(!current(ctx))return;
    if(!Array.isArray(rows))throw Error('Calendar sync returned invalid data.');
    for(const row of rows){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(row.day)||!Array.isArray(row.items))continue;
      const remote={items:clone(row.items),revision:Number(row.revision)};
      if(Object.hasOwn(ctx.pending,row.day)&&!same(ctx.pending[row.day],remote.items)){
        if((ctx.base[row.day]?.revision||0)!==remote.revision)ctx.conflicts[row.day]=remote;
      }else{
        ctx.base[row.day]=remote;ctx.desired[row.day]=clone(remote.items);
        delete ctx.pending[row.day];delete ctx.conflicts[row.day];
      }
    }
    if(!current(ctx))return;
    const version=ctx.version;await persist(ctx,true);
    if(current(ctx)&&ctx.version===version)window.dispatchEvent(new CustomEvent('gym-calendar-records',{detail:clone(ctx.desired)}));
  }
  async function flush(ctx){
    for(const day of Object.keys(ctx.pending)){
      if(!current(ctx)||ctx.conflicts[day])continue;
      // Read the latest desired value: editing while a request runs queues a second revision.
      while(current(ctx)&&Object.hasOwn(ctx.pending,day)&&!ctx.conflicts[day]){
        const sent=clone(ctx.pending[day]),revision=ctx.base[day]?.revision||0;
        const result=await GymCloud.saveCalendarDay(day,sent,revision);
        await GymScreenshotStore.whenIdle();
        if(!current(ctx))return;
        if(!result||!Array.isArray(result.items)||!Number.isInteger(Number(result.revision)))throw Error('Calendar sync returned invalid data.');
        const remote={items:clone(result.items),revision:Number(result.revision)};
        if(result.accepted||same(ctx.desired[day],remote.items)){
          ctx.base[day]=remote;
          if(same(ctx.desired[day],remote.items))delete ctx.pending[day];
          else ctx.pending[day]=clone(ctx.desired[day]||[]);
          delete ctx.conflicts[day];
        }else ctx.conflicts[day]=remote;
        await persist(ctx);
      }
    }
  }
  function kick(refreshFirst=false){
    const ctx=active;if(!ctx||!current(ctx))return Promise.resolve();
    if(ctx.worker){ctx.again=true;ctx.againRefresh=ctx.againRefresh||refreshFirst;return ctx.worker;}
    ctx.busy=true;ctx.error=false;announce(ctx);
    ctx.worker=(async()=>{
      try{if(refreshFirst)await refresh(ctx);await flush(ctx);}
      catch{ctx.error=true;}
      finally{ctx.busy=false;ctx.worker=null;announce(ctx);if(ctx.again&&current(ctx)){const refreshNext=ctx.againRefresh;ctx.again=false;ctx.againRefresh=false;if(!ctx.error)kick(refreshNext);}}
    })();return ctx.worker;
  }
  function openConflicts(){
    const ctx=active;if(!ctx||!current(ctx))return;
    const list=document.getElementById('sync-conflicts');list.replaceChildren();
    for(const [day,remote]of Object.entries(ctx.conflicts)){
      const card=document.createElement('section'),heading=document.createElement('h3');heading.textContent=new Date(day+'T12:00:00').toLocaleDateString();card.append(heading);
      for(const [label,items]of [['This device',ctx.desired[day]||[]],['Saved online',remote.items]]){
        const title=document.createElement('b'),ul=document.createElement('ul');title.textContent=label;
        if(!items.length){const li=document.createElement('li');li.textContent='No exercises';ul.append(li);}
        for(const item of items){const li=document.createElement('li'),name=item.name||window.GymCalendarNames?.(item)||item.id,mode=window.GymTracking?.mode(item,{name});const details=mode==='reps'?(item.sets&&item.reps?' · '+item.sets+' sets × '+item.reps+' reps':''):(item.minutes?' · '+item.minutes+' min':'');li.textContent=(item.done?'Completed: ':'Planned: ')+name+details+(window.GymTracking?.weightText(item)?' · '+GymTracking.weightText(item):'');ul.append(li);}
        card.append(title,ul);
      }
      for(const [label,useLocal]of [['Keep this device’s day',true],['Use saved online day',false]]){
        const button=document.createElement('button');button.className='secondary';button.textContent=label;
        button.onclick=async()=>{
          if(!current(ctx))return;button.disabled=true;
          ctx.base[day]=clone(remote);delete ctx.conflicts[day];
          if(useLocal)ctx.pending[day]=clone(ctx.desired[day]||[]);
          else{ctx.desired[day]=clone(remote.items);delete ctx.pending[day];}
          try{await persist(ctx,true);if(!current(ctx))return;window.dispatchEvent(new CustomEvent('gym-calendar-records',{detail:clone(ctx.desired)}));openConflicts();kick();}
          catch{ctx.error=true;announce(ctx);button.disabled=false;}
        };card.append(button);
      }
      list.append(card);
    }
    const dialog=document.getElementById('sync-dialog');
    if(Object.keys(ctx.conflicts).length){if(!dialog.open)dialog.showModal();}else if(dialog.open)dialog.close();
  }
  window.GymCalendar={start,prepareSnapshot,commitSnapshot,kick,status,openConflicts,reset(){active=null;document.getElementById('sync-dialog')?.close();window.dispatchEvent(new CustomEvent('gym-calendar-status',{detail:{text:status(),conflicts:0}}));}};
  window.addEventListener('online',()=>kick(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)kick(true);});
  document.getElementById('review-sync').onclick=openConflicts;
  document.getElementById('close-sync').onclick=()=>document.getElementById('sync-dialog').close();
})();
