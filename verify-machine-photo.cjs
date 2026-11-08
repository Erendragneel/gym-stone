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
function makePng(width,height,pixel){
  const header=Buffer.alloc(13);
  header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const rowLength=1+width*4;
  const pixels=Buffer.alloc(height*rowLength);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*rowLength+1+x*4;
    pixels.set([...pixel(x,y),255],i);
  }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
const png=makePng(8,8,()=>[180,220,255]);
const lassoPhoto=makePng(96,72,(x,y)=>x>=20&&x<=76&&y>=16&&y<=60?[210,30,40]:[20,45,210]);
const expectedIds={
  'leg-press':['exp-45-degree-leg-press','exp-horizontal-leg-press','exp-single-leg-leg-press','exp-leg-press-calf-raise'],
  'leg-extension':['guide-leg-extension','exp-single-leg-leg-extension'],
  'plate-loaded-lat-pulldown':['exp-plate-loaded-lat-pulldown'],
  'smith-machine':['exp-smith-machine-squat','exp-smith-machine-hip-thrust','exp-smith-machine-seated-calf-raise','exp-smith-machine-standing-calf-raise']
};

(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1100},timezoneId:'Asia/Tokyo'});
    const page=await context.newPage(),errors=[],uploads=[];
    page.setDefaultTimeout(12000);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(request.method()!=='GET')uploads.push(request.url())});
    await context.route('**/cloud-config.js',route=>route.fulfill({contentType:'application/javascript',body:"window.GYM_STONE_CLOUD_CONFIG={url:'',key:''}"}));
    await context.route(/\/assets\/.*\.(?:webp|gif|png)(?:\?|$)/,route=>route.fulfill({contentType:'image/png',body:png}));
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
      window.machineCameraTest={mode:'live',requests:[]};
      navigator.mediaDevices.getUserMedia=async constraints=>{
        const {mode,requests}=window.machineCameraTest;
        const request={constraints};
        requests.push(request);
        if(mode==='denied')throw new DOMException('Camera permission denied','NotAllowedError');
        // Provide real video frames and MediaStreamTrack lifecycle without a host camera.
        const canvas=document.createElement('canvas');
        canvas.width=640;canvas.height=480;
        const context=canvas.getContext('2d');
        const stream=canvas.captureStream(20);
        let frame=0;
        const timer=setInterval(()=>{
          if(!stream.active){clearInterval(timer);return}
          context.fillStyle='#143c56';context.fillRect(0,0,640,480);
          context.fillStyle='#f3a141';context.fillRect(frame++%300,80,80,320);
        },50);
        request.stream=stream;
        if(mode==='pending')return new Promise(resolve=>{request.release=()=>resolve(stream)});
        return stream;
      };
    });
    async function enter(reload=false){
      if(reload)await page.reload();else await page.goto(url);
      await page.locator('#account-preview').click({timeout:10000}).catch(async error=>{console.error({errors,state:await page.evaluate(()=>({cloud:!!window.GymCloud,config:window.GYM_STONE_CLOUD_CONFIG,body:document.body.textContent.slice(-300),scripts:Array.from(document.scripts).map(s=>s.src)}))});throw error});
      await page.waitForFunction(()=>exercises.length>0&&window.GymMachinePhoto&&window.GymMachineData).catch(async error=>{console.error({errors,state:await page.evaluate(()=>({exercises:exercises.length,machinePhoto:!!window.GymMachinePhoto,machineData:!!window.GymMachineData,grid:document.getElementById('exercise-grid').textContent}))});throw error});
      await page.locator('.app-nav [data-screen=exercises]').click();
      await page.waitForFunction(()=>document.querySelectorAll('.exercise-card').length===exercises.filter(exerciseAvailable).length).catch(async error=>{console.error({errors,grid:await page.locator('#exercise-grid').textContent()});throw error});
    }
    async function cards(){return (await page.locator('.exercise-card h3').allTextContents()).sort()}
    async function assertFilter(id){
      const ids=await page.locator('.exercise-card h3').evaluateAll(elements=>elements.map(element=>exercises.find(e=>e.name===element.textContent).id).sort());
      assert.deepEqual(ids,[...expectedIds[id]].sort(),'Machine filter must show its exact catalog allowlist');
      assert.equal(await page.locator('#machine-choice').inputValue(),id);
      assert.equal(await page.locator('#machine-filter').isVisible(),true);
    }
    function messageCount(){
      return page.evaluate(()=>machineWorkers.reduce((total,w)=>total+w.messages.length,0));
    }
    async function reviewPhoto(selectPhoto){
      const before=await messageCount();
      await selectPhoto();
      await page.locator('#machine-photo-review').waitFor({state:'visible'});
      assert.equal(await messageCount(),before,'Preparing a photo must wait for Scan before starting recognition');
      assert.equal(await page.locator('#machine-photo-preview').isVisible(),false);
    }
    async function scanPhoto(){
      const before=await messageCount();
      await page.locator('#machine-run-scan').click();
      await page.waitForFunction(before=>machineWorkers.reduce((total,w)=>total+w.messages.length,0)>before,before).catch(async error=>{console.error('Photo status:',await page.locator('#machine-status').textContent());throw error});
      return page.evaluate(()=>machineWorkers.length-1);
    }
    function selectUpload(name,buffer=png){
      return page.locator('#machine-photo').setInputFiles({name,mimeType:'image/png',buffer});
    }
    async function upload(name='machine.png'){
      await reviewPhoto(()=>selectUpload(name));
      return scanPhoto();
    }
    async function draw(points,touch=false){
      const surface=page.locator('#machine-photo-source');
      await surface.scrollIntoViewIfNeeded();
      const box=await surface.boundingBox();
      assert(box,'Photo must have a visible drawing surface');
      const positions=points.map(([x,y])=>({x:box.x+box.width*x,y:box.y+box.height*y}));
      if(touch){
        const session=await context.newCDPSession(page);
        try{
          await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[positions[0]]});
          for(const point of positions.slice(1)){
            await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});
          }
          await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        }finally{await session.detach()}
      }else{
        await page.mouse.move(positions[0].x,positions[0].y);
        await page.mouse.down();
        for(const point of positions.slice(1))await page.mouse.move(point.x,point.y,{steps:4});
        await page.mouse.up();
      }
    }
    function scannedImage(index,points=[]){
      return page.evaluate(async ({index,points})=>{
        const {image}=machineWorkers[index].messages.at(-1);
        const bitmap=await createImageBitmap(await (await fetch(image)).blob());
        const {width,height}=bitmap;
        const canvas=document.createElement('canvas');
        canvas.width=width;canvas.height=height;
        const context=canvas.getContext('2d');
        context.drawImage(bitmap,0,0);
        bitmap.close();
        const samples=points.map(([x,y])=>Array.from(context.getImageData(Math.floor(x*width),Math.floor(y*height),1,1).data).slice(0,3));
        return {type:image.split(';',1)[0],width,height,samples};
      },{index,points});
    }
    async function openCamera(button,mode='live'){
      const index=await page.evaluate(mode=>{machineCameraTest.mode=mode;return machineCameraTest.requests.length},mode);
      await page.locator(button).click();
      await page.waitForFunction(index=>machineCameraTest.requests.length>index,index);
      if(mode==='live'){
        await page.locator('#machine-live-camera').waitFor({state:'visible'});
        await page.waitForFunction(()=>!document.getElementById('machine-capture').disabled&&document.getElementById('machine-video').videoWidth>0).catch(async error=>{
          const state=await page.evaluate(index=>{
            const video=document.getElementById('machine-video');
            return {status:document.getElementById('machine-status').textContent,stream:!!machineCameraTest.requests[index].stream,readyState:video.readyState,width:video.videoWidth,paused:video.paused,hidden:document.hidden};
          },index);
          console.error('Camera state',state);
          throw error;
        });
      }else if(mode==='pending'){
        await page.waitForFunction(index=>typeof machineCameraTest.requests[index].release==='function',index);
      }
      return index;
    }
    async function assertCameraStopped(index){
      await page.waitForFunction(index=>machineCameraTest.requests[index].stream.getTracks().every(track=>track.readyState==='ended'),index);
      assert.equal(await page.locator('#machine-video').evaluate(video=>video.srcObject),null);
      await page.locator('#machine-live-camera').waitFor({state:'hidden'});
    }
    async function emit(index,data,request=-1){await page.evaluate(({index,data,request})=>machineEmit(index,data,request),{index,data,request})}
    async function result(index,results){await emit(index,{type:'result',results});await page.locator('#machine-cancel').waitFor({state:'hidden'})}
    async function choose(id){
      if(!await page.locator('#machine-manual').evaluate(e=>e.open))await page.locator('#machine-manual summary').click();
      await page.locator('#machine-choice').selectOption(id);await assertFilter(id);
    }
    await enter();
    assert.equal(await page.locator('#machine-photo').getAttribute('accept'),'image/*');
    const all=await cards();assert.equal(all.length,await page.evaluate(()=>exercises.filter(exerciseAvailable).length));
    await page.locator('#search').fill('One-Arm Cable Curl');
    assert.deepEqual(await cards(),['Bayesian Cable Curl']);
    await page.locator('#search').fill('');
    const fixtures=await page.evaluate(()=>{
      const press=GymMachineData.get('leg-press'),extension=GymMachineData.get('leg-extension');
      if(!press||!extension||press.id===extension.id)throw Error('Distinct leg press and leg extension fixtures are required');
      return {press:{id:press.id,name:press.name},extension:{id:extension.id,name:extension.name}};
    });
    const press=fixtures.press,extension=fixtures.extension;
    // Scan uses a live camera and passes the captured frame to the same recognizer as uploads.
    await page.setViewportSize({width:390,height:844});
    const captureIndex=await openCamera('#machine-scan');
    const cameraInfo=await page.evaluate(index=>{
      const {constraints}=machineCameraTest.requests[index];
      const video=document.getElementById('machine-video');
      return {constraints,muted:video.muted,inline:video.playsInline};
    },captureIndex);
    assert.equal(cameraInfo.constraints.video.facingMode.ideal,'environment');
    assert(!cameraInfo.constraints.audio);
    assert(cameraInfo.muted&&cameraInfo.inline,'Camera should play inline without audio');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await reviewPhoto(()=>page.locator('#machine-capture').click());
    await assertCameraStopped(captureIndex);
    const captureWorker=await scanPhoto();
    const captured=await scannedImage(captureWorker);
    assert.equal(captured.type,'data:image/jpeg');
    assert.equal(captured.width,captured.height);
    assert(captured.width>0&&captured.width<=768);
    await result(captureWorker,[{id:'plate-loaded-lat-pulldown',score:0.8}]);
    await page.locator('#machine-suggestions [data-machine="plate-loaded-lat-pulldown"]').click();
    await assertFilter('plate-loaded-lat-pulldown');
    await page.locator('#machine-clear').click();

    const cancelIndex=await openCamera('#machine-take');
    await page.locator('#machine-stop-camera').click();
    await assertCameraStopped(cancelIndex);
    const pendingIndex=await openCamera('#machine-take','pending');
    await page.locator('#machine-close').click();
    await page.evaluate(index=>machineCameraTest.requests[index].release(),pendingIndex);
    await assertCameraStopped(pendingIndex);
    assert.equal(await page.locator('#machine-lookup').isVisible(),false);
    const navigationIndex=await openCamera('#machine-scan');
    await page.locator('.app-nav [data-screen=today]').click();
    await assertCameraStopped(navigationIndex);
    await page.locator('.app-nav [data-screen=exercises]').click();
    await openCamera('#machine-scan','denied');
    await page.waitForFunction(()=>/camera/i.test(document.getElementById('machine-status').textContent)&&document.getElementById('machine-manual').open);
    assert.equal(await page.locator('#machine-upload').isVisible(),true);
    assert.equal(await page.locator('#machine-choice').isVisible(),true);

    // Touch lasso selection changes the recognition input, including pixels inside its bounding box.
    await reviewPhoto(async()=>{
      const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.locator('#machine-upload').click()]);
      await chooser.setFiles({name:'machine.png',mimeType:'image/png',buffer:lassoPhoto});
    });
    const lasso=page.locator('#machine-tool-lasso'),blur=page.locator('#machine-tool-blur');
    const run=page.locator('#machine-run-scan');
    assert.equal(await run.textContent(),'Scan photo');
    await page.setViewportSize({width:320,height:740});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.locator('#machine-photo-review').evaluate(review=>review.scrollWidth>review.clientWidth+1),false);
    await page.setViewportSize({width:390,height:844});
    await lasso.click();
    assert.equal(await lasso.getAttribute('aria-pressed'),'true');
    const triangle=[[0.25,0.25],[0.5,0.25],[0.75,0.25],[0.62,0.5],[0.5,0.78],[0.37,0.5],[0.25,0.25]];
    await draw(triangle,true);
    assert.equal(await run.textContent(),'Scan selection');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('#machine-clear-edits').click();
    assert.equal(await run.textContent(),'Scan photo');
    if(await lasso.getAttribute('aria-pressed')!=='true')await lasso.click();
    await draw(triangle,true);
    const cropped=await scannedImage(await scanPhoto(),[[0.5,0.35],[0.18,0.78]]);
    assert.equal(cropped.width,cropped.height);
    assert(cropped.width<96,'The lasso crop must zoom into the outlined machine');
    assert(cropped.samples[0][0]>155&&cropped.samples[0][1]<95,'The lasso must retain the subject');
    assert(cropped.samples[1].every(channel=>channel>230),'Pixels outside the outline must be white inside the crop');
    await reviewPhoto(()=>page.locator('#machine-edit-photo').click());
    assert.equal(await run.textContent(),'Scan selection','Returning to the editor must preserve the outline');
    await page.setViewportSize({width:1440,height:1100});

    // A new photo starts with no selection. Blur stays applied after switching tools.
    await reviewPhoto(()=>selectUpload('blur-machine.png',lassoPhoto));
    assert.equal(await run.textContent(),'Scan photo');
    assert.equal(await lasso.getAttribute('aria-pressed'),'false');
    assert.equal(await blur.getAttribute('aria-pressed'),'false');
    await blur.click();
    await draw([[0.21,0.35],[0.21,0.52],[0.21,0.65]]);
    await lasso.click();
    assert.equal(await lasso.getAttribute('aria-pressed'),'true');
    assert.equal(await blur.getAttribute('aria-pressed'),'false');
    assert.equal(await run.textContent(),'Scan photo');
    const samplePoints=[[0.20,0.5],[0.22,0.5],[0.82,0.5]];
    const blurred=await scannedImage(await scanPhoto(),samplePoints);
    await reviewPhoto(()=>selectUpload('original-machine.png',lassoPhoto));
    assert.equal(await run.textContent(),'Scan photo');
    const brushAlpha=()=>page.locator('#machine-blur-layer').evaluate(canvas=>canvas.getContext('2d').getImageData(Math.round(canvas.width*0.21),Math.round(canvas.height*0.5),1,1).data[3]);
    assert.equal(await brushAlpha(),0,'A replacement photo must not inherit the previous brush marks');
    await blur.click();
    await draw([[0.21,0.35],[0.21,0.65]]);
    assert(await brushAlpha()>0);
    await page.locator('#machine-clear-edits').click();
    assert.equal(await brushAlpha(),0,'Clear edits must remove painted blur');
    let worker=await scanPhoto();
    const original=await scannedImage(worker,samplePoints);
    assert.equal(blurred.width,original.width);
    assert(blurred.samples.slice(0,2).some((sample,index)=>sample.reduce((distance,channel,channelIndex)=>distance+Math.abs(channel-original.samples[index][channelIndex]),0)>30),'Blur must change pixels sent to the recognition worker');
    assert(blurred.samples[2].every((channel,index)=>Math.abs(channel-original.samples[2][index])<15),'Blur must leave distant pixels unchanged');

    // Recognition offers candidates only; the user must confirm a machine.
    assert.equal(await page.locator('#machine-lookup').getAttribute('aria-busy'),'true');
    assert.equal(await page.locator('#machine-photo-preview').isVisible(),true);
    await emit(worker,{type:'progress',message:'Downloading recognition model…'});
    assert.equal(await page.locator('#machine-status').textContent(),'Downloading recognition model…');
    await result(worker,[{id:press.id,score:0.72},{id:extension.id,score:0.4}]);
    assert.equal(await page.locator('#machine-suggestions [data-machine]').count(),2);
    assert.equal(await page.locator('#machine-filter').isVisible(),false);
    assert.deepEqual(await cards(),all,'Recognition must not automatically filter the library');
    // Selecting a suggested machine clears incompatible search and library filters.
    await page.locator('.filter-disclosure summary').click();
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
    const obsolete=await upload('first-photo.png'),replacement=await upload('second-photo.png');
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
    await upload('after-reload.png');await choose(press.id);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gym-account-changed')));
    assert.equal(await page.locator('#machine-filter').isVisible(),false);
    assert.equal(await page.locator('#machine-choice').inputValue(),'');
    assert.deepEqual(uploads,[],'The photo recognition UI must not upload photos');assert.deepEqual(errors,[]);
    console.log('PASS: live camera and upload review, touch lasso and blur payloads, cleanup, recognition, manual fallback, workout dates, storage and responsive layout (fake camera, mock recognition worker).');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
