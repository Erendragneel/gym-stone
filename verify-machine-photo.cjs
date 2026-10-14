const {chromium}=require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {deflateSync}=require('node:zlib');
const url=process.env.GYM_TEST_URL||'http://127.0.0.1:5191';
function chunk(name,data){
  const type=Buffer.from(name),body=Buffer.concat([type,data]),size=Buffer.alloc(4),checksum=Buffer.alloc(4);
  size.writeUInt32BE(data.length);let crc=0xffffffff;
  for(const byte of body){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
  checksum.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([size,body,checksum]);
}
const header=Buffer.alloc(13);header.writeUInt32BE(8,0);header.writeUInt32BE(8,4);header[8]=8;header[9]=6;
const pixels=Buffer.alloc(8*(1+8*4));for(let y=0;y<8;y++)for(let x=0;x<8;x++){const i=y*33+1+x*4;pixels[i]=180;pixels[i+1]=220;pixels[i+2]=255;pixels[i+3]=255}
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
const expectedIds={
  'leg-press':['exp-45-degree-leg-press','exp-horizontal-leg-press','exp-single-leg-leg-press','exp-leg-press-calf-raise'],
  'leg-extension':['guide-leg-extension','exp-single-leg-leg-extension'],
  'smith-machine':['exp-smith-machine-squat','exp-smith-machine-hip-thrust','exp-smith-machine-seated-calf-raise','exp-smith-machine-standing-calf-raise']
};

(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1100},timezoneId:'Asia/Tokyo'});
    const page=await context.newPage(),errors=[],uploads=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(request.method()!=='GET')uploads.push(request.url())});
    await context.route('**/cloud-config.js',route=>route.fulfill({contentType:'application/javascript',body:"window.GYM_STONE_CLOUD_CONFIG={url:'',key:''}"}));
    await context.route('**/assets/*.webp',route=>route.fulfill({contentType:'image/png',body:png}));
    await context.addInitScript(()=>{
      localStorage.setItem('gym-stone-profile-v1',JSON.stringify({name:'Machine tester',gender:'female',birthday:'1996-10-05',weight:65,weightUnit:'kg',goal:'strength',daysPerWeek:3,completed:true,updatedAt:Date.now()}));
      const OriginalWorker=window.Worker;
      window.machineWorkers=[];
      window.Worker=class {
        constructor(workerUrl,options){
          if(!String(workerUrl).includes('machine-worker.js'))return new OriginalWorker(workerUrl,options);
          this.messages=[];this.terminated=false;this.onmessage=null;this.onerror=null;window.machineWorkers.push(this);
        }
        postMessage(message){this.messages.push(message)}
        terminate(){this.terminated=true}
      };
      window.machineEmit=(index,data,request=-1)=>{
        const worker=window.machineWorkers[index],message=worker.messages.at(request);
        worker.onmessage?.({data:{requestId:message?.requestId,...data}});
      };
    });
    async function enter(reload=false){
      if(reload)await page.reload();else await page.goto(url);
      await page.locator('#account-preview').click({timeout:10000}).catch(async error=>{console.error({errors,state:await page.evaluate(()=>({cloud:!!window.GymCloud,config:window.GYM_STONE_CLOUD_CONFIG,body:document.body.textContent.slice(-300),scripts:Array.from(document.scripts).map(s=>s.src)}))});throw error});
      await page.waitForFunction(()=>exercises.length===425&&window.GymMachinePhoto&&window.GymMachineData).catch(async error=>{console.error({errors,state:await page.evaluate(()=>({exercises:exercises.length,machinePhoto:!!window.GymMachinePhoto,machineData:!!window.GymMachineData,grid:document.getElementById('exercise-grid').textContent}))});throw error});
      await page.locator('.app-nav [data-screen=exercises]').click();
      await page.waitForFunction(()=>document.querySelectorAll('.exercise-card').length===425).catch(async error=>{console.error({errors,grid:await page.locator('#exercise-grid').textContent()});throw error});
    }
    async function cards(){return (await page.locator('.exercise-card h3').allTextContents()).sort()}
    async function assertFilter(id){
      const ids=await page.locator('.exercise-card h3').evaluateAll(elements=>elements.map(element=>exercises.find(e=>e.name===element.textContent).id).sort());
      assert.deepEqual(ids,[...expectedIds[id]].sort(),'Machine filter must show its exact catalog allowlist');
      assert.equal(await page.locator('#machine-choice').inputValue(),id);
      assert.equal(await page.locator('#machine-filter').isVisible(),true);
    }
    async function upload(name='machine.png',input='#machine-photo'){
      const before=await page.evaluate(()=>machineWorkers.reduce((total,w)=>total+w.messages.length,0));
      await page.locator(input).setInputFiles({name,mimeType:'image/png',buffer:png});
      await page.waitForFunction(before=>machineWorkers.reduce((total,w)=>total+w.messages.length,0)>before,before).catch(async error=>{console.error('Photo status:',await page.locator('#machine-status').textContent());throw error});
      return page.evaluate(()=>machineWorkers.length-1);
    }
    async function emit(index,data,request=-1){await page.evaluate(({index,data,request})=>machineEmit(index,data,request),{index,data,request})}
    async function result(index,results){await emit(index,{type:'result',results});await page.locator('#machine-cancel').waitFor({state:'hidden'})}
    async function choose(id){
      if(!await page.locator('#machine-manual').evaluate(e=>e.open))await page.locator('#machine-manual summary').click();
      await page.locator('#machine-choice').selectOption(id);await assertFilter(id);
    }
    await enter();
    assert.equal(await page.locator('#machine-camera').getAttribute('capture'),'environment');
    assert.equal(await page.locator('#machine-photo').getAttribute('accept'),'image/*');
    assert.equal(await page.locator('#machine-camera').getAttribute('accept'),'image/*');
    const all=await cards();assert.equal(all.length,425);
    const fixtures=await page.evaluate(()=>{
      const press=GymMachineData.get('leg-press'),extension=GymMachineData.get('leg-extension');
      if(!press||!extension||press.id===extension.id)throw Error('Distinct leg press and leg extension fixtures are required');
      return {press:{id:press.id,name:press.name},extension:{id:extension.id,name:extension.name}};
    });
    const press=fixtures.press,extension=fixtures.extension;
    // Recognition offers candidates only; the user must confirm a machine.
    let worker=await upload();
    assert.equal(await page.locator('#machine-lookup').getAttribute('aria-busy'),'true');
    assert.equal(await page.locator('#machine-photo-preview').isVisible(),true);
    await emit(worker,{type:'progress',message:'Downloading recognition model…'});
    assert.equal(await page.locator('#machine-status').textContent(),'Downloading recognition model…');
    await result(worker,[{id:press.id,score:0.72},{id:extension.id,score:0.4}]);
    assert.equal(await page.locator('#machine-suggestions [data-machine]').count(),2);
    assert.equal(await page.locator('#machine-filter').isVisible(),false);
    assert.deepEqual(await cards(),all,'Recognition must not automatically filter the library');
    // Selecting a suggested machine clears incompatible search and library filters.
    await page.locator('#equipment-filter').selectOption('Dumbbells');
    await page.locator('#difficulty-filter').selectOption('Advanced');
    await page.locator('#search').fill('curl');
    await page.locator('#machine-suggestions [data-machine="'+press.id+'"]').click();
    await assertFilter(press.id);
    assert.equal(await page.locator('#search').inputValue(),'');
    assert.equal(await page.locator('#equipment-filter').inputValue(),'All equipment');
    assert.equal(await page.locator('#difficulty-filter').inputValue(),'All levels');
    assert.equal(await page.locator('#muscle-filter').inputValue(),'All moves');
    assert.match(await page.locator('#machine-filter-label').textContent(),new RegExp(press.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.equal(await page.locator('#machine-suggestions [data-machine="'+press.id+'"]').getAttribute('aria-pressed'),'true');
    await page.locator('#machine-clear').click();assert.deepEqual(await cards(),all);
    assert.equal(await page.locator('#machine-photo-preview').isVisible(),false);
    assert.equal(await page.locator('#machine-photo-preview').getAttribute('src'),null);
    assert.equal(await page.locator('#machine-suggestions [data-machine]').count(),0);
    // Negative model candidates (a person, animal or unrelated object) expose the manual fallback.
    for(const id of ['person','animal','not-gym']){
      worker=await upload('unrecognized-'+id+'.png');
      await result(worker,[{id,score:0.75},{id:press.id,score:0.15}]);
      assert.equal(await page.locator('#machine-suggestions [data-machine]').count(),0,'Non-machine top result must not present a match');
      assert.equal(await page.locator('#machine-manual').evaluate(e=>e.open),true);
      assert.equal(await page.locator('#machine-filter').isVisible(),false);assert.deepEqual(await cards(),all);
    }
    await choose(extension.id);await page.locator('#machine-clear').click();
    await choose('smith-machine');
    assert.equal(await page.getByRole('button',{name:'Preview Barbell Back Squat',exact:true}).count(),0,'Smith filter must exclude free-weight squats');
    for(const group of ['Warm-up','Cooldown','Pregnancy']){
      await choose('smith-machine');
      await page.locator('#stretch-tabs [data-group="'+group+'"]').click();
      assert.equal(await page.locator('#machine-filter').isVisible(),false,'Machine filter must clear for '+group);
      const count=await page.evaluate(group=>exercises.filter(e=>e.group===group&&exerciseAvailable(e)).length,group);
      assert.equal(await page.locator('.exercise-card').count(),count,'Guided moves must remain available in '+group);
      await page.locator('#stretch-tabs [data-group="All moves"]').click();
    }
    await page.locator('#reset-library-filters').click();
    // Empty/unknown results and model errors leave a usable manual selector.
    worker=await upload('empty-result.png');await result(worker,[]);
    assert.match(await page.locator('#machine-status').textContent(),/No clear|unclear/i);
    assert.equal(await page.locator('#machine-manual').evaluate(e=>e.open),true);
    worker=await upload('model-error.png');
    await emit(worker,{type:'error',message:'Model download unavailable. Choose the machine manually.'});
    assert.match(await page.locator('#machine-status').textContent(),/download unavailable/);
    assert.equal(await page.locator('#machine-cancel').isVisible(),false);
    assert.equal(await page.locator('#machine-manual').evaluate(e=>e.open),true);
    // Cancelling must ignore callbacks from the terminated worker.
    worker=await upload('cancel.png');
    await page.locator('#machine-cancel').click();
    assert.equal(await page.evaluate(index=>machineWorkers[index].terminated,worker),true);
    const cancelled=await page.locator('#machine-status').textContent();
    await emit(worker,{type:'progress',message:'STALE PROGRESS'});
    await emit(worker,{type:'result',results:[{id:press.id,score:0.99}]});
    assert.equal(await page.locator('#machine-status').textContent(),cancelled);
    assert.equal(await page.locator('#machine-suggestions [data-machine]').count(),0);
    assert.equal(await page.locator('#machine-filter').isVisible(),false);
    // A new upload cancels the prior request and also rejects old request IDs.
    const obsolete=await upload('first-photo.png'),replacement=await upload('second-photo.png','#machine-camera');
    assert.notEqual(obsolete,replacement);assert.equal(await page.evaluate(index=>machineWorkers[index].terminated,obsolete),true);
    await emit(obsolete,{type:'result',results:[{id:press.id,score:0.99}]});
    assert.equal(await page.locator('#machine-suggestions [data-machine]').count(),0);
    await emit(replacement,{type:'result',requestId:-1,results:[{id:press.id,score:0.99}]});
    assert.equal(await page.locator('#machine-cancel').isVisible(),true);
    await result(replacement,[{id:extension.id,score:0.65}]);
    assert.deepEqual(await page.locator('#machine-suggestions [data-machine]').evaluateAll(elements=>elements.map(e=>e.dataset.machine)),[extension.id]);
    // A manual correction while inference runs cancels it; stale results cannot undo it.
    worker=await upload('manual-correction.png');await choose(press.id);
    assert.equal(await page.evaluate(index=>machineWorkers[index].terminated,worker),true);
    await emit(worker,{type:'result',results:[{id:extension.id,score:0.99}]});await assertFilter(press.id);
    await page.locator('#reset-library-filters').click();
    assert.equal(await page.locator('#machine-filter').isVisible(),false);assert.deepEqual(await cards(),all);
    worker=await upload('choose-all-during-recognition.png');
    await page.locator('#machine-choice').selectOption('');
    assert.equal(await page.locator('#machine-cancel').isVisible(),false,'Choosing all machines must cancel recognition');
    await emit(worker,{type:'result',results:[{id:press.id,score:0.99}]});
    assert.equal(await page.locator('#machine-suggestions [data-machine]').count(),0);
    assert.deepEqual(await cards(),all);
    await choose(press.id);
    await page.locator('#search').fill('no matching exercise');
    await page.locator('#equipment-filter').selectOption('Dumbbells');
    await page.locator('#difficulty-filter').selectOption('Advanced');
    await page.locator('#machine-clear').click();
    assert.deepEqual(await cards(),all,'Show all exercises must reset every library filter');
    assert.equal(await page.locator('#search').inputValue(),'');
    assert.equal(await page.locator('#equipment-filter').inputValue(),'All equipment');
    assert.equal(await page.locator('#difficulty-filter').inputValue(),'All levels');
    // Invalid types and image decoding failures never start inference.
    const messages=await page.evaluate(()=>machineWorkers.reduce((n,w)=>n+w.messages.length,0));
    await page.locator('#machine-photo').setInputFiles({name:'not-photo.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')});
    assert.match(await page.locator('#machine-status').textContent(),/Choose a photo/);
    await page.locator('#machine-photo').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
    await page.waitForFunction(()=>document.getElementById('machine-status').textContent.includes('could not be opened'));
    assert.equal(await page.locator('#machine-cancel').isVisible(),false);
    assert.equal(await page.locator('#machine-manual').evaluate(e=>e.open),true);
    assert.equal(await page.evaluate(()=>machineWorkers.reduce((n,w)=>n+w.messages.length,0)),messages);
    worker=await upload('worker-crash.png');await page.evaluate(index=>machineWorkers[index].onerror({message:'worker failed'}),worker);
    assert.match(await page.locator('#machine-status').textContent(),/could not start/);assert.equal(await page.locator('#machine-cancel').isVisible(),false);
    // Preview and add use the existing exercise flow, including the selected date.
    await choose(press.id);
    const names=await cards(),first=names[0];assert(names.length>0);
    const firstId=await page.evaluate(name=>exercises.find(e=>e.name===name).id,first);
    const dates=await page.evaluate(()=>{const past=new Date(today+'T12:00:00'),future=new Date(today+'T12:00:00');past.setDate(past.getDate()-1);future.setDate(future.getDate()+1);return {past:dateKey(past),future:dateKey(future)}});
    await page.evaluate(day=>selectDay(day),dates.past);
    await page.getByRole('button',{name:'Preview '+first,exact:true}).click();
    assert.equal(await page.locator('#preview-name').textContent(),first);
    await page.waitForFunction(()=>document.getElementById('preview-image').naturalWidth>0);
    await page.locator('#preview-add').click();
    await page.getByRole('button',{name:'Close exercise preview',exact:true}).click();
    await page.evaluate(()=>GymScreenshotStore.whenIdle());
    const saved=await page.evaluate(()=>GymScreenshotStore.getRecords()),entry=saved[dates.past]?.find(r=>r.id===firstId);
    assert(entry,'Machine exercise must be added to the selected past day');assert.equal(entry.done,false);
    assert.equal(saved[dates.future],undefined);
    await page.evaluate(day=>selectDay(day),dates.future);
    await page.locator('#mode-done').click();
    await page.getByRole('button',{name:'Add to selected day: '+first,exact:true}).click();
    assert.match(await page.locator('#toast').textContent(),/Future days are for planning/);
    assert.equal(await page.evaluate(()=>rows().length),0);
    await page.locator('#mode-plan').click();
    await page.getByRole('button',{name:'Add to selected day: '+first,exact:true}).click();
    await page.locator('#view-workout').click();
    await page.getByRole('button',{name:'Complete: '+first,exact:true}).click();
    assert.match(await page.locator('#toast').textContent(),/today or a past day/);
    assert.equal(await page.evaluate(()=>rows()[0].done),false);
    await page.evaluate(()=>GymScreenshotStore.whenIdle());const persisted=await page.evaluate(()=>GymScreenshotStore.getRecords());
    await page.locator('.app-nav [data-screen=exercises]').click();await choose(press.id);
    worker=await upload('responsive.png');await result(worker,[{id:press.id,score:0.72},{id:extension.id,score:0.3}]);
    await page.locator('#machine-suggestions [data-machine="'+press.id+'"]').click();
    for(const width of [320,390,1440]){
      await page.setViewportSize({width,height:width===1440?1100:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Page overflow at '+width);
      assert.equal(await page.locator('#machine-lookup').evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'Machine controls overflow at '+width);
      assert.equal(await page.locator('#machine-choice').evaluate(e=>{const box=e.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth}),true,'Selector extends beyond viewport at '+width);
    }
    await enter(true);
    assert.equal(await page.locator('#machine-filter').isVisible(),false);
    assert.equal(await page.locator('#machine-photo-preview').isVisible(),false);
    assert.equal(await page.locator('#machine-status').textContent(),'');
    assert.deepEqual(await cards(),all);
    assert.deepEqual(await page.evaluate(()=>GymScreenshotStore.getRecords()),persisted,'Exercise records must survive reload');
    assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('data:image/')),false,'Machine photo must not be persisted in localStorage');
    await choose(press.id);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gym-account-changed')));
    assert.equal(await page.locator('#machine-filter').isVisible(),false);
    assert.equal(await page.locator('#machine-choice').inputValue(),'');
    assert.deepEqual(uploads,[],'The photo recognition UI must not upload photos');assert.deepEqual(errors,[]);
    console.log('PASS: photo/camera input, progress, confirmed exact exercise allowlists, negative/manual fallback, cancellation and stale requests, invalid photos, model errors, preview/date/future guards, storage separation and 320/390/1440px layout (mock recognition worker).');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
