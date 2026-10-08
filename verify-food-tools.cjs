const {chromium}=require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 await context.route('**/cloud-config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.GYM_STONE_CLOUD_CONFIG={url:'',key:''};"}));
 await context.addInitScript(()=>localStorage.setItem('gym-stone-profile-v1',JSON.stringify({name:'Test',gender:'female',birthday:'1996-10-05',weight:65,weightUnit:'kg',goal:'stay-active',daysPerWeek:3,completed:true})));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5180/#nutrition');await page.locator('#account-preview').click();await page.evaluate(()=>GymNutrition.ready);await page.locator('.app-nav [data-screen="nutrition"]').click();
 await page.locator('#food-search').fill('rice cooked');await page.locator('#food-search-button').click();await page.locator('.food-result').first().waitFor();
 await page.locator('.food-result').first().click();await page.locator('#food-portion-amount').fill('150');
 const name=await page.locator('#food-portion-name').textContent();await page.locator('#food-portion-form button').click();assert.equal(await page.locator('#nutrition-name').inputValue(),name);await page.locator('#nutrition-entry-save').click();await page.locator('#nutrition-entry-dialog').waitFor({state:'hidden'});
 await page.locator('#food-recent').click();await page.locator('.food-result').first().click();await page.locator('#food-portion-amount').fill('0.5');await page.locator('#food-portion-form button').click();await page.locator('#nutrition-entry-save').click();await page.locator('#nutrition-entry-dialog').waitFor({state:'hidden'});
 assert.equal(await page.locator('.nutrition-day-column').count(),7);
 await context.route('https://world.openfoodfacts.org/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({products:[{code:'1234567890123',product_name:'Test Yogurt',brands:'Fixture',nutriments:{'energy-kcal_100g':80,proteins_100g:5,carbohydrates_100g:9,fat_100g:2},serving_size:'100g'}]})}));
 await page.locator('#food-source').selectOption('products');await page.locator('#food-search').fill('yogurt');await page.locator('#food-search-button').click();await page.getByRole('button',{name:/Test Yogurt/}).click();await page.locator('#food-portion-amount').fill('200');await page.locator('#food-portion-form button').click();assert.equal(await page.locator('#nutrition-calories').inputValue(),'160');assert.equal(await page.locator('#nutrition-protein').inputValue(),'10');await page.locator('#nutrition-entry-cancel').click();
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 console.log('PASS: USDA lookup, portion scaling, diary save, previous-food reuse, product mapping, weekly chart, mobile widths.');
 fs.mkdirSync(path.join(__dirname,'meal-photo-test'),{recursive:true});
 const results=[];for(const offset of [0,1500,8000,20000]){
  const response=await fetch('https://datasets-server.huggingface.co/rows?dataset=ethz/food101&config=default&split=validation&offset='+offset+'&length=1');const sample=(await response.json()).rows[0];const image=Buffer.from(await(await fetch(sample.row.image.src)).arrayBuffer());const file=path.join(__dirname,'meal-photo-test',offset+'.jpg');fs.writeFileSync(file,image);
  await page.evaluate(()=>{window.GymFoodRecognitionLast=null;});const start=Date.now();await page.locator('#food-photo').setInputFiles(file);console.log('Testing meal photo offset '+offset+' (label '+sample.row.label+')');
  await page.waitForFunction(()=>window.GymFoodRecognitionLast||document.querySelector('#food-status').textContent.includes('could not'),null,{timeout:240000});
  const result=await page.evaluate(()=>({result:window.GymFoodRecognitionLast,status:document.querySelector('#food-status').textContent}));if(!result.result)throw Error(result.status);
  results.push({offset,expectedLabelId:sample.row.label,totalMilliseconds:Date.now()-start,...result.result});console.log(JSON.stringify(results.at(-1)));
 }
 fs.writeFileSync(path.join(__dirname,'meal-photo-test/results.json'),JSON.stringify(results,null,2));await page.screenshot({path:path.join(__dirname,'nutrition-food-tools.png'),fullPage:true});assert.deepEqual(errors,[]);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
