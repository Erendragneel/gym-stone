/* One fixed drawing surface for every pose; timing controls never transform it. */
(() => {
 const dialog=document.querySelector('#exercise-dialog'),image=document.querySelector('#preview-image');
 if(!dialog||!image)return;
 const canvas=document.createElement('canvas');canvas.className='clean-motion-canvas';canvas.hidden=true;canvas.width=600;canvas.height=484;canvas.setAttribute('role','img');
 const controls=document.createElement('div');controls.className='clean-motion-controls';controls.hidden=true;
 controls.innerHTML='<button type="button" data-motion-play>Pause</button><label>Speed <select aria-label="Movement speed"><option value="1">Normal</option><option value="0.75">Three-quarter speed</option><option value="0.5">Slow</option></select></label><label>Pose <input type="range" min="0" value="0" aria-label="Exercise pose"></label>';
 image.after(canvas,controls);
 const play=controls.querySelector('button'),speed=controls.querySelector('select'),slider=controls.querySelector('input'),context=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const variants=new Map();let active=null,atlas=null,frame=0,paused=reduced.matches,request=0,last=0,elapsed=0,generation=0;
 function stop(){cancelAnimationFrame(request);request=0;last=0;}
 function paint(){if(!active||!atlas)return;const a=active.animation,stored=a.poseSequence?.[frame]??frame,w=a.atlasFrameWidth||a.frameWidth,h=a.atlasFrameHeight||a.frameHeight;context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(atlas,(stored%a.columns)*w,Math.floor(stored/a.columns)*h,w,h,a.atlasOffsetX||0,a.atlasOffsetY||0,w,h);slider.value=String(frame);canvas.setAttribute('aria-label',image.alt+' · pose '+(frame+1)+' of '+a.keyframes);}
 function atTraversalEnd(){return active?.animation?.playbackMode==='one-shot'&&frame===active.animation.keyframes-1;}
 function tick(now){request=0;if(paused||!dialog.open||document.hidden||!atlas)return;elapsed+=(last?Math.min(now-last,100):0)*Number(speed.value);last=now;while(elapsed>=active.animation.delayMs[frame]){elapsed-=active.animation.delayMs[frame];if(atTraversalEnd()){paused=true;elapsed=0;start();return;}frame=(frame+1)%active.animation.keyframes;paint()}request=requestAnimationFrame(tick);}
 function start(){stop();if(!paused&&dialog.open&&!document.hidden&&atlas)request=requestAnimationFrame(tick);play.textContent=paused?(atTraversalEnd()?'Replay':'Play'):'Pause';}
 function choose(){
  stop();const token=++generation,v=variants.get(new URL(image.getAttribute('src')||'',location.href).href);
  active=v||null;atlas=null;frame=0;elapsed=0;paused=reduced.matches;slider.value='0';
  if(!v?.animation?.atlas){canvas.hidden=controls.hidden=true;image.hidden=false;return;}
  const a=v.animation;canvas.width=a.frameWidth;canvas.height=a.frameHeight;context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);canvas.hidden=false;image.hidden=true;controls.hidden=true;
  const loading=new Image();loading.onload=()=>{if(token!==generation)return;atlas=loading;slider.max=String(a.keyframes-1);controls.hidden=false;paint();start()};
  loading.onerror=()=>{if(token!==generation)return;canvas.hidden=controls.hidden=true;image.hidden=false;};loading.src=a.atlas;
 }
 play.addEventListener('click',()=>{if(paused&&atTraversalEnd()){frame=0;paint();}paused=!paused;elapsed=0;start()});speed.addEventListener('change',start);
 slider.addEventListener('input',()=>{paused=true;frame=Number(slider.value);elapsed=0;paint();start()});
 new MutationObserver(records=>{if(records.some(r=>r.attributeName==='src'))choose()}).observe(image,{attributes:true,attributeFilter:['src']});
 new MutationObserver(()=>{if(dialog.open){if(active&&atlas){image.hidden=true;start()}else choose()}else stop()}).observe(dialog,{attributes:true,attributeFilter:['open']});
 dialog.addEventListener('close',stop);document.addEventListener('visibilitychange',start);
 function galleryMotion(){for(const img of document.querySelectorAll('#exercise-grid .exercise-visual img')){const v=variants.get(new URL(img.getAttribute('src')||'',location.href).href);if(!v?.poster)continue;const next=reduced.matches||v.animation.playbackMode==='one-shot'?v.poster:v.image;if(new URL(next,location.href).href!==img.src)img.src=next;}}
 const grid=document.querySelector('#exercise-grid');if(grid)new MutationObserver(galleryMotion).observe(grid,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
 reduced.addEventListener('change',e=>{paused=e.matches;start();galleryMotion()});
 fetch('exercises.json').then(r=>r.json()).then(rows=>{for(const e of rows)for(const v of Object.values(e.variants||{}))if(v.animation?.atlas){variants.set(new URL(v.image,location.href).href,v);if(v.poster)variants.set(new URL(v.poster,location.href).href,v);}galleryMotion();if(dialog.open)choose()}).catch(()=>{});
})();
