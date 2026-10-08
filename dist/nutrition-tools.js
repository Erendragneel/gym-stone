(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const nutrients=['calories','protein','carbs','fat'];
  const tools=document.createElement('section');tools.className='panel nutrition-tools';
  tools.innerHTML=`<div class="nutrition-panel-heading"><div><span class="eyebrow">FIND YOUR FOOD</span><h2>Food lookup & photos</h2></div></div>
    <form id="food-search-form"><label for="food-search">Food name or product barcode</label><div class="food-search-row"><input id="food-search" maxlength="120" placeholder="e.g. rice, cooked" required><button class="primary" id="food-search-button">Search</button></div><label for="food-source">Look in</label><select id="food-source"><option value="usda">Everyday foods · USDA (English)</option><option value="products">Packaged products · Open Food Facts</option></select></form>
    <div class="food-actions"><button class="secondary" id="food-recent">Use a previous food</button><label class="secondary food-photo-button">Choose meal photo<input id="food-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><label class="secondary food-photo-button">Take meal photo<input id="food-camera" type="file" accept="image/*" capture="environment" hidden></label><button id="food-cancel" class="secondary" hidden>Cancel recognition</button></div>
    <p class="nutrition-help">Find everyday foods in English, or search packaged products in their own language. Barcodes search products directly. Match cooked or raw preparation and confirm your portion.</p>
    <p id="food-status" role="status" aria-live="polite"></p><img id="food-photo-preview" alt="Your selected meal" hidden><div id="food-photo-results"></div><div id="food-results"></div>
    <p class="nutrition-help">Photo recognition is experimental and recognizes 101 dish types. It suggests a dish, not ingredients, portion size or calories. Photos stay on your device. First use downloads a model; later use reuses it when browser storage allows.</p>
    <p class="nutrition-help">Everyday foods: <a href="https://fdc.nal.usda.gov/download-datasets/" target="_blank" rel="noopener">USDA SR Legacy (2018)</a>, per 100 g; recipes vary. Product data: <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL</a>. Community records may be incomplete. Product lookup needs internet.</p>`;
  $('nutrition-summary').before(tools);
  const trends=document.createElement('section');trends.className='panel nutrition-trends';trends.innerHTML='<h2>Last 7 days</h2><p class="nutrition-help">Calories logged through the selected day. A blank day means no food was logged.</p><div id="nutrition-week"></div>';
  document.querySelector('.nutrition-storage').before(trends);
  const portion=document.createElement('dialog');portion.className='nutrition-dialog';portion.id='food-portion-dialog';
  portion.innerHTML=`<button class="dialog-close" id="food-portion-close" aria-label="Close portion">×</button><h2 id="food-portion-name"></h2><p id="food-portion-brand"></p><p id="food-portion-source" class="nutrition-help"></p><form id="food-portion-form"><label id="food-portion-label" for="food-portion-amount">Portion in grams</label><input id="food-portion-amount" type="number" min="0.1" max="10000" step="0.1" required value="100"><div id="food-portion-total"></div><p class="nutrition-help">Check these values before saving. Missing nutrients stay unknown.</p><button class="primary">Review food entry</button></form>`;
  document.body.append(portion);
  let activeFood,request,searchGeneration=0,lastSearch=0,worker,photoGeneration=0,photoURL,library;
  const fmt=v=>v===null?'Unknown':Number(v.toFixed(1)).toLocaleString();
  const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
  function normalize(p){
    const n=p.nutriments||{},c=number(n['energy-kcal_100g'])??(number(n.energy_100g)!==null&&n.energy_unit==='kJ'?n.energy_100g/4.184:null);
    if(c===null||!p.product_name)return null;
    return {name:String(p.product_name).slice(0,100),brand:String(p.brands||''),unit:/\bml\b/i.test(p.serving_size||'')?'mL':'g',base:100,calories:c,protein:number(n.proteins_100g),carbs:number(n.carbohydrates_100g),fat:number(n.fat_100g),code:String(p.code||''),source:'Open Food Facts · per 100 g / 100 mL as listed on the label'};
  }
  function showFoods(foods,message){
    $('food-results').replaceChildren();$('food-status').textContent=message;
    for(const food of foods){const button=document.createElement('button');button.type='button';button.className='food-result secondary';
      const name=document.createElement('strong');name.textContent=food.name;const detail=document.createElement('span');detail.textContent=(food.brand?food.brand+' · ':'')+fmt(food.calories)+' kcal / '+(food.base===100?'100 '+food.unit:'previous portion');button.append(name,detail);button.onclick=()=>openPortion(food);$('food-results').append(button);}
  }
  async function search(){
    const query=$('food-search').value.trim();if(!query)return;
    if($('food-source').value==='usda'&&!/^\d{8,14}$/.test(query)){
      request?.abort();const current=++searchGeneration;$('food-search-button').disabled=false;
      try{library ||= fetch('food-library.json').then(r=>{if(!r.ok)throw Error();return r.json();}).catch(e=>{library=null;throw e;});const data=await library;if(current!==searchGeneration)return;
        const terms=query.toLowerCase().split(/[\s,]+/).filter(Boolean);const foods=data.foods.filter(f=>terms.every(t=>f.name.toLowerCase().includes(t))).sort((a,b)=>a.name.length-b.name.length).slice(0,25).map(f=>({...f,base:100,unit:'g',source:data.source+' · per 100 g'}));
        showFoods(foods,foods.length?'Choose the food and preparation that match your meal.':'No everyday foods matched. Try fewer English words, or switch to packaged products.');
      }catch{if(current===searchGeneration)$('food-status').textContent='Food library unavailable. Connect once to download it, or use a previous food.';}return;
    }
    if(Date.now()-lastSearch<6500){$('food-status').textContent='Please wait a few seconds before searching again.';return;}
    lastSearch=Date.now();request?.abort();request=new AbortController();const current=++searchGeneration;
    $('food-status').textContent='Searching Open Food Facts…';$('food-search-button').disabled=true;
    const controller=request;const timer=setTimeout(()=>controller.abort(),25000);
    try{
      const fields='code,product_name,brands,nutriments,serving_size,nutrition_data_per';
      const barcode=/^\d{8,14}$/.test(query);
      const url=barcode?'https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(query)+'.json?fields='+fields:
        'https://world.openfoodfacts.org/cgi/search.pl?search_terms='+encodeURIComponent(query)+'&search_simple=1&action=process&json=1&page_size=12&fields='+fields;
      const response=await fetch(url,{signal:request.signal});if(!response.ok)throw Error('Lookup service unavailable');
      const data=await response.json();if(current!==searchGeneration)return;
      const foods=(barcode?[data.product]:(data.products||[])).filter(Boolean).map(normalize).filter(Boolean);
      showFoods(foods,foods.length?'Select the exact product, then check its portion.':'No products with calorie data found. Try a brand, barcode, or log the label manually.');
    }catch{if(current===searchGeneration)$('food-status').textContent='Online lookup could not finish. Try again later, use a previous food, or enter the package label manually.';}
    finally{clearTimeout(timer);if(current===searchGeneration)$('food-search-button').disabled=false;}
  }
  $('food-search-form').onsubmit=e=>{e.preventDefault();search();};
  $('food-recent').onclick=()=>{
    request?.abort();searchGeneration++;$('food-search-button').disabled=false;
    const foods=[],seen=new Set();for(const day of Object.keys(GymNutrition.value.days).sort().reverse())for(const meal of GymNutrition.value.days[day].meals){const key=meal.name+'|'+meal.serving;if(!seen.has(key)){seen.add(key);foods.push({...meal,base:1,unit:'portion',source:'Your previous food entry · values for one previously logged portion'});}}
    showFoods(foods.slice(0,30),foods.length?'Choose a previous entry. Adjust how many portions you ate.':'No previous foods yet. Log your first food using its label.');
  };
  function openPortion(food){activeFood=food;$('food-portion-name').textContent=food.name;$('food-portion-brand').textContent=food.brand||'';$('food-portion-source').textContent=food.source;
    $('food-portion-label').textContent=food.base===1?'Number of previous portions':'Amount in '+food.unit;$('food-portion-amount').value=food.base;updatePortion();portion.showModal();}
  function scaled(){const factor=Number($('food-portion-amount').value)/activeFood.base;return Object.fromEntries(nutrients.map(k=>[k,activeFood[k]===null?null:Math.round(activeFood[k]*factor*10)/10]));}
  function updatePortion(){if(!activeFood)return;const values=scaled();$('food-portion-total').textContent=nutrients.map(k=>k+': '+fmt(values[k])+(values[k]===null?'':k==='calories'?' kcal':' g')).join(' · ');}
  $('food-portion-amount').oninput=updatePortion;$('food-portion-close').onclick=()=>portion.close();
  $('food-portion-form').onsubmit=e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;const row={name:activeFood.name,source:activeFood.source,serving:$('food-portion-amount').value+' '+activeFood.unit,...scaled()};portion.close();GymNutrition.openFood(row);};
  function cancelPhoto(){photoGeneration++;worker?.terminate();worker=null;$('food-cancel').hidden=true;}
  async function recognize(file){
    if(!$('food-cancel').hidden)cancelPhoto();const current=++photoGeneration;$('food-photo-results').replaceChildren();
    if(!file||!file.type.startsWith('image/')||file.size>15*1024*1024){$('food-status').textContent='Choose an image smaller than 15 MB.';return;}
    if(photoURL)URL.revokeObjectURL(photoURL);photoURL=URL.createObjectURL(file);$('food-photo-preview').src=photoURL;$('food-photo-preview').hidden=false;
    $('food-status').textContent='Preparing photo…';$('food-cancel').hidden=false;
    try{
      const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});const scale=Math.min(1,640/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      if(current!==photoGeneration)return;
      const image=canvas.toDataURL('image/jpeg',0.9);worker ||= new Worker('food-worker.js',{type:'module'});
      worker.onmessage=({data})=>{if(current!==photoGeneration)return;if(data.type==='progress')$('food-status').textContent=data.message;
        if(data.type==='error'){$('food-status').textContent=data.message;cancelPhoto();}
        if(data.type==='result'){
          $('food-cancel').hidden=true;const top=data.results[0];$('food-status').textContent=(top?.score<0.5?'No clear match. ':'Possible dishes. ')+(data.milliseconds/1000).toFixed(1)+' seconds to recognize. Choose only if it matches your meal.';
          for(const result of data.results){const label=result.label.replaceAll('_',' ');const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=label+' · model score '+Math.round(result.score*100)+'%';button.onclick=()=>{$('food-search').value=label;$('food-search').focus();$('food-status').textContent='Dish selected. Search for a matching product, or use Log food with the recipe or label. A dish name does not determine its calories.';};$('food-photo-results').append(button);}
          window.GymFoodRecognitionLast={results:data.results,milliseconds:data.milliseconds};
        }};
      worker.onerror=()=>{if(current===photoGeneration){$('food-status').textContent='Food model could not start. Retry with an internet connection or log the meal manually.';cancelPhoto();}};
      worker.postMessage({image});
    }catch{if(current===photoGeneration){$('food-status').textContent='This image could not be read. Try a JPEG or PNG.';cancelPhoto();}}
  }
  for(const id of ['food-photo','food-camera'])$(id).onchange=e=>{recognize(e.target.files[0]);e.target.value='';};
  $('food-cancel').onclick=()=>{cancelPhoto();$('food-status').textContent='Recognition cancelled.';};
  function week(){if(!window.GymNutrition)return;const days=GymNutrition.value.days,end=new Date(GymNutrition.date+'T12:00:00'),rows=[];
    for(let offset=6;offset>=0;offset--){const date=new Date(end);date.setDate(date.getDate()-offset);const key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');const meals=days[key]?.meals||[];rows.push({date,key,value:meals.length?meals.reduce((sum,m)=>sum+m.calories,0):null});}
    const max=Math.max(1,...rows.map(r=>r.value||0));$('nutrition-week').replaceChildren();for(const row of rows){const column=document.createElement('div');column.className='nutrition-day-column';const bar=document.createElement('div');bar.className='nutrition-day-bar';bar.style.height=(row.value===null?0:Math.max(3,row.value/max*90))+'px';const label=document.createElement('span');label.textContent=row.date.toLocaleDateString(undefined,{weekday:'short'});const value=document.createElement('strong');value.textContent=row.value===null?'—':fmt(row.value);column.title=row.key+(row.value===null?' · No food logged':' · '+fmt(row.value)+' kcal');column.append(value,bar,label);$('nutrition-week').append(column);}
  }
  new MutationObserver(week).observe($('nutrition-summary'),{childList:true});week();
  window.addEventListener('gym-account-changed',()=>{cancelPhoto();request?.abort();searchGeneration++;$('food-search-button').disabled=false;portion.close();activeFood=null;$('food-results').replaceChildren();$('food-photo-results').replaceChildren();$('food-photo-preview').hidden=true;$('food-search').value='';$('food-status').textContent='';if(photoURL)URL.revokeObjectURL(photoURL);});
})();
