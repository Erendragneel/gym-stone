(function(global){'use strict';
  let connection, connectionKey,blocked=false;const recordWrites=new Set(),leases=new Map();
  function track(promise){recordWrites.add(promise);promise.then(()=>recordWrites.delete(promise),()=>recordWrites.delete(promise));return promise}
  async function whenIdle(){await Promise.allSettled([...recordWrites])}
  function blockTab(message){
    blocked=true;let dialog=document.getElementById('storage-tab-dialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='storage-tab-dialog';dialog.className='profile-dialog';dialog.setAttribute('aria-labelledby','storage-tab-title');const heading=document.createElement('h2'),text=document.createElement('p'),retry=document.createElement('button');heading.id='storage-tab-title';heading.textContent='Open Gym Stone in one tab';text.textContent=message;retry.className='primary';retry.textContent='Retry in this tab';retry.onclick=()=>location.reload();dialog.append(heading,text,retry);dialog.addEventListener('cancel',event=>event.preventDefault());document.body.append(dialog);}
    if(!dialog.open)dialog.showModal();return Error(message);
  }
  function lease(name){
    if(leases.has(name))return leases.get(name).ready;
    const entry={release:null};entry.ready=new Promise((resolve,reject)=>{
      if(!navigator.locks)return reject(blockTab('This browser cannot protect workouts across tabs. Open Gym Stone in a current Chrome, Edge, Firefox, or Safari browser.'));
      navigator.locks.request('gym-stone-editor:'+name,{ifAvailable:true},async lock=>{
        if(!lock){reject(blockTab('Gym Stone is already open for this player in another tab. Close that tab, then retry here to keep your workouts safe.'));return;}
        await new Promise(done=>{entry.release=done;resolve();});
      }).catch(reject);
    });leases.set(name,entry);return entry.ready;
  }
  // One writer per player and browser prevents stale tabs replacing the shared
  // IndexedDB snapshot/outbox. Independent devices still use server revisions.
  global.addEventListener('gym-account-changed',()=>{const name=global.GymCloud?.user?'gym-stone-records:'+GymCloud.user.id:'gym-stone-records';const previous=[...leases].filter(([key])=>key!==name);whenIdle().then(()=>{for(const [key,entry]of previous){entry.release?.();leases.delete(key);}});});
  function open(){const name=global.GymCloud?.user?'gym-stone-records:'+GymCloud.user.id:'gym-stone-records';if(connection&&connectionKey===name)return connection;connectionKey=name;const pending=connection=lease(name).then(()=>new Promise((resolve,reject)=>{if(!global.indexedDB)return reject(new Error('Screenshot storage is unavailable in this browser.'));const request=indexedDB.open(name,1);request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('screenshots',{keyPath:'id'}).createIndex('hash','hash',{unique:true});db.createObjectStore('state',{keyPath:'id'})};request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();if(connection===pending)connection=undefined};resolve(db)};request.onerror=()=>reject(new Error('Screenshot storage could not be opened. Check browser storage settings.'));request.onblocked=()=>reject(new Error('Close other Gym Stone tabs and try again.'))}));pending.catch(()=>{if(connection===pending)connection=undefined});return pending}
  async function read(store,key){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Saved records could not be read.'))})}
  async function getRecords(){const state=await read('state','workouts');return state?.records||null}
  function writeRecords(state,records,meta){state.put({id:'workouts',records});if(meta)state.put({id:'calendar-sync',meta})}
  function putRecords(records,options={}){const meta=options.syncMeta||global.GymCalendar?.prepareSnapshot(records),dbPromise=open();return track((async()=>{const db=await dbPromise;return new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');writeRecords(tx.objectStore('state'),records,meta);tx.oncomplete=()=>{if(!options.syncMeta)global.GymCalendar?.commitSnapshot(records,meta);resolve()};tx.onabort=tx.onerror=()=>reject(tx.error||new Error('Workout records could not be saved.'))})})())}
  async function getCalendarMeta(){return (await read('state','calendar-sync'))?.meta||null}
  async function putCalendarMeta(meta){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({id:'calendar-sync',meta});tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||new Error('Sync details could not be saved.'))})}
  async function getProfile(){const state=await read('state','profile');return state?.profile||null}
  async function putProfile(profile){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({id:'profile',profile});tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||new Error('Profile could not be saved.'))})}
  async function getNutrition(){const state=await read('state','nutrition');return state?.nutrition||null}
  function putNutrition(nutrition){const dbPromise=open();return track((async()=>{const db=await dbPromise;return new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({id:'nutrition',nutrition});tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||new Error('Nutrition records could not be saved.'))})})())}
  async function list(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('screenshots','readonly'),r=tx.objectStore('screenshots').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Screenshots could not be loaded.'))})}
  async function saveWithRecords(screenshot,records){const meta=global.GymCalendar?.prepareSnapshot(records),db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(['screenshots','state'],'readwrite');tx.objectStore('screenshots').put(screenshot);writeRecords(tx.objectStore('state'),records,meta);tx.oncomplete=()=>{global.GymCalendar?.commitSnapshot(records,meta);resolve()};tx.onabort=tx.onerror=()=>reject(tx.error||new Error('The screenshot could not be saved. Your browser may be out of storage.'))})}
  async function deleteWithRecords(id,records){const meta=global.GymCalendar?.prepareSnapshot(records),db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(['screenshots','state'],'readwrite');tx.objectStore('screenshots').delete(id);writeRecords(tx.objectStore('state'),records,meta);tx.oncomplete=()=>{global.GymCalendar?.commitSnapshot(records,meta);resolve()};tx.onabort=tx.onerror=()=>reject(tx.error||new Error('The screenshot could not be deleted.'))})}
  async function guestHistory(includePhotos=false){
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('gym-stone-records',1);request.onupgradeneeded=()=>{request.result.createObjectStore('screenshots',{keyPath:'id'}).createIndex('hash','hash',{unique:true});request.result.createObjectStore('state',{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    try{return await new Promise((resolve,reject)=>{const tx=db.transaction(['state','screenshots'],'readonly'),r=tx.objectStore('state').get('workouts'),photos=includePhotos?tx.objectStore('screenshots').getAll():null;tx.oncomplete=()=>resolve({records:r.result?.records||{},screenshots:photos?.result||[]});tx.onabort=tx.onerror=()=>reject(tx.error)})}finally{db.close()}
  }
  async function importGuestHistory(){
    const owner=global.GymCloud?.user?.id;if(!owner)throw Error('Sign in to import this device’s workouts.');
    const guest=await guestHistory(true),saved=await getRecords()||{},photos=await list(),hashes=new Map(photos.map(p=>[p.hash,p.id])),ids=new Map(),copies=[];
    for(const photo of guest.screenshots){const existing=hashes.get(photo.hash);ids.set(photo.id,existing||photo.id);if(!existing){copies.push(photo);hashes.set(photo.hash,photo.id)}}
    const next=structuredClone(saved);
    for(const [day,items]of Object.entries(guest.records)){const target=next[day]||(next[day]=[]);for(const original of items){const item=structuredClone(original);item.screenshotIds=(item.screenshotIds||[]).map(id=>ids.get(id)||id);const existing=target.find(r=>r.id===item.id);if(existing)existing.screenshotIds=[...new Set([...(existing.screenshotIds||[]),...item.screenshotIds])];else target.push(item)}}
    if(owner!==global.GymCloud?.user?.id)throw Error('The signed-in player changed.');
    const meta=global.GymCalendar?.prepareSnapshot(next),db=await open();
    await track(new Promise((resolve,reject)=>{const tx=db.transaction(['state','screenshots'],'readwrite');for(const photo of copies)tx.objectStore('screenshots').put(photo);writeRecords(tx.objectStore('state'),next,meta);tx.oncomplete=()=>{global.GymCalendar?.commitSnapshot(next,meta);resolve()};tx.onabort=tx.onerror=()=>reject(tx.error||Error('Previous workouts could not be imported. Check available browser storage.'))}));
    if(owner!==global.GymCloud?.user?.id)throw Error('The signed-in player changed.');
    window.dispatchEvent(new CustomEvent('gym-calendar-records',{detail:next}));global.GymCalendar?.kick();return next;
  }
  global.GymScreenshotStore={get blocked(){return blocked},open,getRecords,putRecords,whenIdle,getCalendarMeta,putCalendarMeta,getProfile,putProfile,getNutrition,putNutrition,list,get:id=>read('screenshots',id),guestHistory,importGuestHistory,saveWithRecords:(...args)=>track(saveWithRecords(...args)),deleteWithRecords:(...args)=>track(deleteWithRecords(...args))};
})(window);

