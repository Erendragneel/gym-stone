(function(global){'use strict';
const $=id=>document.getElementById(id);let api,file,hash,duplicate,previewURL,viewURL,currentView,worker,workerPromise,ocrGeneration=0,activeOCRGeneration=null,queuedOCRGeneration=null,busy=false,ocrBusy=false,galleryPage=0,galleryDay=false,galleryGeneration=0,galleryURLs=[];
const dirtyFields=new Set();
const sourceLabels={Garmin:'Garmin Connect',Apple:'Apple Fitness',Samsung:'Samsung Health'};
function cleanError(error){if(error?.name==='QuotaExceededError')return 'Your browser is out of storage. Delete an older screenshot or free space, then try again.';if(error?.name==='ConstraintError')return 'This screenshot was just saved in another tab. Choose the image again to update its existing workout.';return error?.message||'This could not be saved. Please try again.'}
function revokePreview(){if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null}}
function displayNotice(message){$('import-notice').textContent=message;$('import-notice').hidden=!message}
function linkedWorkouts(records,id){const linked=[];for(const [date,rs]of Object.entries(records))rs.forEach((row,index)=>{if((row.screenshotIds||[]).includes(id))linked.push({date,row,index})});return linked}
function updateTargets(preferMove=false){
  const selected=$('import-target').value,day=$('import-date').value,records=api?.getRecords()||{},rs=records[day]||[],linked=duplicate?linkedWorkouts(records,duplicate.id):[];
  const select=$('import-target');select.replaceChildren();const option=document.createElement('option');option.value='new';option.textContent='Create a new completed activity';select.append(option);
  const canMove=linked.length===1&&linked[0].date!==day;
  if(canMove){const move=document.createElement('option');move.value='move';move.textContent='Move linked workout to this date';select.append(move)}
  for(const row of rs){const o=document.createElement('option');o.value=row.id;o.textContent='Update: '+api.nameOf(row)+(row.done?' (completed)':' (planned)');select.append(o)}
  if(canMove&&(preferMove||selected==='move'))select.value='move';else if(rs.some(r=>r.id===selected))select.value=selected;
}
function resetDraft(){queuedOCRGeneration=null;dirtyFields.clear();$('screenshot-form').reset();$('import-date').value=api.getDay();$('ocr-status').textContent='';$('import-error').textContent='';displayNotice('');updateTargets()}
function reset(){ocrGeneration++;file=hash=duplicate=null;revokePreview();$('screenshot-file').value='';$('screenshot-preview').hidden=true;$('screenshot-preview').removeAttribute('src');resetDraft();$('read-screenshot').disabled=true;$('save-screenshot').disabled=true}
function openImport(){reset();$('screenshot-dialog').showModal()}
async function selectFile(){const chosen=$('screenshot-file').files[0];if(!chosen)return;const generation=++ocrGeneration;file=hash=duplicate=null;revokePreview();$('screenshot-preview').hidden=true;$('screenshot-preview').removeAttribute('src');resetDraft();$('save-screenshot').disabled=true;$('read-screenshot').disabled=true;if(!['image/png','image/jpeg','image/webp'].includes(chosen.type)){return $('import-error').textContent='Choose a PNG, JPG, or WebP screenshot. Export HEIC images as PNG or JPG first.'}if(chosen.size>15*1024*1024){return $('import-error').textContent='This screenshot is larger than 15 MB. Choose a smaller image.'}try{const validatedImage=await createImageBitmap(chosen);validatedImage.close();const bytes=await chosen.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',bytes);if(generation!==ocrGeneration)return;hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');const existing=await GymScreenshotStore.list();if(generation!==ocrGeneration)return;duplicate=existing.find(s=>s.hash===hash)||null;file=chosen;previewURL=URL.createObjectURL(file);$('screenshot-preview').src=previewURL;$('screenshot-preview').hidden=false;$('save-screenshot').disabled=false;$('read-screenshot').disabled=ocrBusy;if(duplicate){applySaved(duplicate);displayNotice('This screenshot is already saved. Update its linked workout, or change the date and choose “Move linked workout to this date.”')}else{$('ocr-status').textContent='Ready to read. You can also fill in the details yourself.';await recognize()}}catch(e){if(generation===ocrGeneration){$('import-error').textContent=cleanError(e);$('screenshot-preview').hidden=true}}}
function loadOCR(){if(global.Tesseract)return Promise.resolve(global.Tesseract);return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/ocr/tesseract.min.js';script.onload=()=>resolve(global.Tesseract);script.onerror=()=>{script.remove();reject(new Error('Text recognition could not load. Enter the details manually or retry.'))};document.head.append(script)})}
async function getWorker(){if(worker)return worker;if(workerPromise)return workerPromise;workerPromise=(async()=>{const Tesseract=await loadOCR();return Tesseract.createWorker('eng',1,{workerPath:new URL('vendor/ocr/worker.min.js',location.href).href,corePath:new URL('vendor/ocr/tesseract-core-lstm.wasm.js',location.href).href,langPath:new URL('vendor/ocr/lang/',location.href).href,workerBlobURL:false,logger:m=>{if(!ocrBusy||activeOCRGeneration!==ocrGeneration||!$('screenshot-dialog').open)return;const pct=typeof m.progress==='number'?Math.round(m.progress*100):0;$('ocr-status').textContent=(m.status==='recognizing text'?'Reading screenshot':'Preparing text recognition')+(pct?' · '+pct+'%':'')}})})().then(w=>{worker=w;return w}).catch(e=>{workerPromise=null;throw e});return workerPromise}
async function recognize(){
  if(!file)return;
  if(ocrBusy){if(activeOCRGeneration!==ocrGeneration){queuedOCRGeneration=ocrGeneration;$('ocr-status').textContent='Waiting to read this screenshot…'}return}
  const generation=ocrGeneration,chosen=file;ocrBusy=true;activeOCRGeneration=generation;queuedOCRGeneration=null;$('read-screenshot').disabled=true;$('ocr-status').textContent='Preparing text recognition…';
  try{
    const w=await getWorker();if(generation!==ocrGeneration)return;
    const result=await w.recognize(chosen);if(generation!==ocrGeneration)return;let text=result.data?.text||'';
    if(!GymScreenshotParser.parse(text,{today:api.today}).provider){
      const image=await createImageBitmap(chosen);if(generation!==ocrGeneration){image.close();return}
      const canvas=document.createElement('canvas'),scale=Math.min(1,2200/Math.max(image.width,image.height));canvas.width=Math.round(image.width*scale);const cropHeight=Math.max(1,Math.round(image.height*.2));canvas.height=Math.round(cropHeight*scale);
      const ctx=canvas.getContext('2d');ctx.filter='invert(1)';ctx.drawImage(image,0,0,image.width,cropHeight,0,0,canvas.width,canvas.height);image.close();
      const alternate=await w.recognize(canvas);if(generation!==ocrGeneration)return;text=(alternate.data?.text||'')+'\n'+text;
    }
    if(!dirtyFields.has('import-text'))$('import-text').value=text;applySuggestions(text,true);
    $('ocr-status').textContent=text.trim()?'Text read. Your manual changes were kept; confirm the details before saving.':'No clear text found. Fill in the details manually.';
  }catch(e){console.warn('Screenshot text recognition failed',e?.message||String(e));if(generation===ocrGeneration)$('ocr-status').textContent='Text could not be read. You can still fill in the details and save the screenshot.'}
  finally{
    ocrBusy=false;activeOCRGeneration=null;$('read-screenshot').disabled=!file;
    if(queuedOCRGeneration===ocrGeneration&&file&&!duplicate&&$('screenshot-dialog').open){queuedOCRGeneration=null;void recognize()}
    else if(generation!==ocrGeneration&&$('screenshot-dialog').open&&!duplicate)$('ocr-status').textContent=file?'Ready to read this screenshot.':'';
  }
}
function applySuggestions(text,preserveEdits=false){
  const p=GymScreenshotParser.parse(text,{today:api.today});
  function suggest(id,value){if(!preserveEdits||!dirtyFields.has(id)){$(id).value=value;if(!preserveEdits)dirtyFields.add(id)}}
  if(p.provider)suggest('import-source',sourceLabels[p.provider]||'Other');if(p.activityName)suggest('import-activity',p.activityName);if(p.date)suggest('import-date',p.date);if(p.time)suggest('import-time',p.time);
  if(p.minutes!==null)suggest('import-minutes',Math.round(p.minutes*100)/100);if(p.calories!==null)suggest('import-calories',p.calories);if(p.distance){suggest('import-distance',p.distance.value);suggest('import-distance-unit',p.distance.unit)}
  const warnings=[...p.warnings];if(!p.date)warnings.push('Date was not detected. The selected calendar day is shown—confirm it.');if(!p.minutes)warnings.push('Duration was not detected. Enter minutes to include this activity in your training hours.');displayNotice([...new Set(warnings)].join('\n'));updateTargets();
  const matches=(api.getRecords()[$('import-date').value]||[]).filter(r=>!r.done&&api.nameOf(r).toLowerCase()===$('import-activity').value.toLowerCase());
  if(matches.length===1&&!dirtyFields.has('import-target')&&!duplicate){$('import-target').value=matches[0].id;displayNotice($('import-notice').textContent+'\nA matching workout was found. Review the update target below.')}
}
function applySaved(s){$('import-source').value=s.provider||'Other';$('import-activity').value=s.activityName||'';$('import-date').value=s.date;$('import-time').value=s.time||'';$('import-minutes').value=s.minutes??'';$('import-calories').value=s.calories??'';$('import-distance').value=s.distance?.value??'';$('import-distance-unit').value=s.distance?.unit||'km';$('import-text').value=s.rawText||'';updateTargets();const exists=(api.getRecords()[s.date]||[]).some(r=>r.id===s.entryId);if(exists)$('import-target').value=s.entryId}
function numberValue(id,max){const v=$(id).value;if(v==='')return null;const n=Number(v);if(!Number.isFinite(n)||n<0||n>max)throw new Error('Check the numeric fields. Values must be positive and within the displayed limits.');return n}
async function submit(event){
  event.preventDefault();if(busy||!file)return;$('import-error').textContent='';
  try{
    const date=$('import-date').value,d=new Date(date+'T12:00:00');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(d)||api.dateKey(d)!==date)throw new Error('Choose a valid workout date.');if(date>api.today)throw new Error('A completed workout must be today or a past date. Future days are for planning.');
    const name=$('import-activity').value.trim();if(!name)throw new Error('Enter the activity or exercise name.');
    const target=$('import-target').value,current=api.getRecords(),next=structuredClone(current),rs=next[date]||[],linked=duplicate?linkedWorkouts(next,duplicate.id):[];
    let entry;
    if(target==='move'){
      if(linked.length!==1||linked[0].date===date)throw new Error('The linked workout changed. Choose its original date to update it.');
      const previous=linked[0];entry=previous.row;
      if(rs.some(row=>row.id===entry.id))throw new Error('This date already has that exercise. Remove its separate plan first, or keep the screenshot on its original date.');
      if((entry.screenshotIds||[]).length>1)throw new Error('This workout has several screenshots. Delete its extra screenshots before moving the workout date.');
      next[previous.date].splice(previous.index,1);rs.push(entry);
    }else{
      entry=target==='new'?null:rs.find(row=>row.id===target);if(target!=='new'&&!entry)throw new Error('That workout is no longer available. Choose another target.');
      if(linked.length&&!linked.some(link=>link.date===date&&link.row===entry))throw new Error('This screenshot is already linked to a workout. Select its existing workout, or change the date and choose “Move linked workout to this date.”');
    }
    const minutes=numberValue('import-minutes',1440),calories=numberValue('import-calories',100000),distance=numberValue('import-distance',100000);
    if(!entry){entry={id:'activity-'+crypto.randomUUID(),name,group:'Activity',done:true,minutes:minutes||0,time:$('import-time').value};rs.push(entry)}else{entry.done=true;if(entry.name)entry.name=name;if(minutes!==null)entry.minutes=minutes;if($('import-time').value)entry.time=$('import-time').value}
    const id=duplicate?.id||crypto.randomUUID();next[date]=rs;
    for(const [day,dayRows]of Object.entries(next))for(const row of dayRows)if(day!==date||row!==entry)row.screenshotIds=(row.screenshotIds||[]).filter(x=>x!==id);
    entry.screenshotIds=Array.from(new Set([...(entry.screenshotIds||[]),id]));entry.source=$('import-source').value||'Other';if(distance!==null)entry.distance={value:distance,unit:$('import-distance-unit').value};if(calories!==null)entry.calories=calories;
    const s={id,hash,blob:file,filename:file.name,contentType:file.type,provider:entry.source,activityName:name,date,time:$('import-time').value,minutes:minutes??entry.minutes??0,distance:distance===null?null:{value:distance,unit:$('import-distance-unit').value},calories,rawText:$('import-text').value,entryId:entry.id,createdAt:duplicate?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    busy=true;api.setImportBusy(true);$('save-screenshot').disabled=true;$('save-screenshot').textContent='Saving…';await GymScreenshotStore.saveWithRecords(s,next);api.setRecords(next);api.selectDay(date);$('screenshot-dialog').close();api.notify(target==='new'?'Screenshot and completed activity saved':target==='move'?'Screenshot saved · Workout moved to the corrected date':'Screenshot saved · Workout updated');
  }catch(e){$('import-error').textContent=cleanError(e)}finally{busy=false;api.setImportBusy(false);$('save-screenshot').disabled=!file;$('save-screenshot').textContent='Save screenshot & workout'}
}
function clearGalleryURLs(){for(const url of galleryURLs)URL.revokeObjectURL(url);galleryURLs=[]}
async function renderGallery(){const generation=++galleryGeneration,dayOnly=galleryDay,selectedDay=api.getDay(),requestedPage=galleryPage;clearGalleryURLs();$('screenshot-gallery-list').replaceChildren();$('gallery-error').textContent='';try{let items=await GymScreenshotStore.list();if(generation!==galleryGeneration||!$('screenshot-gallery-dialog').open)return;items.sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));if(dayOnly)items=items.filter(s=>s.date===selectedDay);const pages=Math.max(1,Math.ceil(items.length/12));galleryPage=Math.max(0,Math.min(requestedPage,pages-1));$('gallery-count').textContent=items.length+' screenshot'+(items.length===1?'':'s');$('gallery-prev').disabled=galleryPage===0;$('gallery-next').disabled=galleryPage>=pages-1;for(const s of items.slice(galleryPage*12,galleryPage*12+12)){const card=document.createElement('article');card.className='screenshot-item';const button=document.createElement('button');button.className='screenshot-thumb';button.setAttribute('aria-label','View screenshot: '+s.activityName);const img=document.createElement('img');img.src=URL.createObjectURL(s.blob);galleryURLs.push(img.src);img.alt=s.activityName+' screenshot';button.append(img);button.onclick=()=>openView(s.id);const details=document.createElement('div');details.className='screenshot-details';const title=document.createElement('strong');title.textContent=s.activityName;const p=document.createElement('p');p.textContent=s.provider+' · '+s.date+' · '+s.minutes+' min';const attached=Object.values(api.getRecords()).flat().some(r=>(r.screenshotIds||[]).includes(s.id));const status=document.createElement('span');status.className='file-help';status.textContent=attached?'Linked to a workout':'Screenshot kept · workout removed';details.append(title,p,status);card.append(button,details);$('screenshot-gallery-list').append(card)}if(!items.length){const p=document.createElement('p');p.className='screenshot-empty';p.textContent=dayOnly?'No screenshots saved for this day.':'Your imported workout screenshots will appear here.';$('screenshot-gallery-list').append(p)}}catch(e){if(generation===galleryGeneration&&$('screenshot-gallery-dialog').open)$('gallery-error').textContent=cleanError(e)}}
function openGallery(){galleryPage=0;$('screenshot-gallery-dialog').showModal();renderGallery()}
async function openView(id){$('screenshot-view-error').textContent='';try{const s=await GymScreenshotStore.get(id);if(!s)return api.notify('This screenshot is no longer available.');currentView=s;if(viewURL)URL.revokeObjectURL(viewURL);viewURL=URL.createObjectURL(s.blob);$('saved-screenshot-image').src=viewURL;$('saved-screenshot-source').textContent=s.provider;$('saved-screenshot-title').textContent=s.activityName;$('saved-screenshot-details').textContent=s.date+(s.time?' · '+s.time:'')+' · '+s.minutes+' min'+(s.distance?' · '+s.distance.value+' '+s.distance.unit:'')+(s.calories!==null?' · '+s.calories+' kcal':'');$('saved-screenshot-text').textContent=s.rawText||'No recognized text saved.';$('screenshot-delete-confirm').hidden=true;$('screenshot-view-dialog').showModal()}catch(e){api.notify(cleanError(e))}}
async function deleteScreenshot(){if(busy||!currentView)return;busy=true;api.setImportBusy(true);$('confirm-delete-screenshot').disabled=true;try{const next=structuredClone(api.getRecords());for(const rs of Object.values(next))for(const r of rs)r.screenshotIds=(r.screenshotIds||[]).filter(id=>id!==currentView.id);await GymScreenshotStore.deleteWithRecords(currentView.id,next);api.setRecords(next);api.render();$('screenshot-view-dialog').close();if($('screenshot-gallery-dialog').open)renderGallery();api.notify('Screenshot deleted · Workout kept')}catch(e){$('screenshot-view-error').textContent=cleanError(e)}finally{busy=false;api.setImportBusy(false);$('confirm-delete-screenshot').disabled=false}}
function closeImport(){if(busy)return;$('screenshot-dialog').close()}
function connect(config){
  api=config;$('import-screenshot').onclick=openImport;$('open-screenshots').onclick=openGallery;$('screenshot-file').onchange=selectFile;$('screenshot-form').onsubmit=submit;
  const markDirty=event=>{if(event.target.id)dirtyFields.add(event.target.id)};$('screenshot-form').addEventListener('input',markDirty);$('screenshot-form').addEventListener('change',markDirty);
  $('import-date').onchange=()=>updateTargets(true);$('read-screenshot').onclick=recognize;$('parse-import-text').onclick=()=>applySuggestions($('import-text').value);
  $('close-import').onclick=closeImport;$('cancel-import').onclick=closeImport;$('screenshot-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault()});$('screenshot-dialog').addEventListener('close',()=>{ocrGeneration++;queuedOCRGeneration=null;revokePreview()});
  $('close-gallery').onclick=()=>$('screenshot-gallery-dialog').close();$('screenshot-gallery-dialog').addEventListener('close',()=>{galleryGeneration++;clearGalleryURLs();$('screenshot-gallery-list').replaceChildren()});
  $('gallery-all').onclick=()=>{galleryDay=false;galleryPage=0;galleryFilter();renderGallery()};$('gallery-day').onclick=()=>{galleryDay=true;galleryPage=0;galleryFilter();renderGallery()};$('gallery-prev').onclick=()=>{galleryPage=Math.max(0,galleryPage-1);renderGallery()};$('gallery-next').onclick=()=>{galleryPage++;renderGallery()};
  $('close-screenshot-view').onclick=()=>$('screenshot-view-dialog').close();$('screenshot-view-dialog').addEventListener('close',()=>{if(viewURL)URL.revokeObjectURL(viewURL);viewURL=null;$('saved-screenshot-image').removeAttribute('src')});$('delete-screenshot').onclick=()=>$('screenshot-delete-confirm').hidden=false;$('cancel-delete-screenshot').onclick=()=>$('screenshot-delete-confirm').hidden=true;$('confirm-delete-screenshot').onclick=deleteScreenshot;
  $('jump-screenshot-day').onclick=()=>{api.selectDay(currentView.date);$('screenshot-view-dialog').close();$('screenshot-gallery-dialog').close()};window.addEventListener('pagehide',()=>{ocrGeneration++;queuedOCRGeneration=null;galleryGeneration++;revokePreview();clearGalleryURLs();if(viewURL)URL.revokeObjectURL(viewURL);worker?.terminate()});
}
function galleryFilter(){for(const [id,value]of [['gallery-all',false],['gallery-day',true]]){$(id).classList.toggle('active',galleryDay===value);$(id).setAttribute('aria-pressed',String(galleryDay===value))}}
global.GymScreenshotImport={connect,openView,get busy(){return busy}};
})(window);



