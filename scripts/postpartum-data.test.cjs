const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),window={};
for(const file of ['workout-tracking.js','progress-data.js','workout-recommendations-data.js'])vm.runInNewContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),{window,console});
const catalog=JSON.parse(fs.readFileSync(path.join(root,'dist/exercises.json'))),guides=catalog.filter(e=>e.postpartum),data=window.GymWorkoutRecommendationsData;
assert.equal(catalog.length,431);assert.equal(guides.length,6);assert.equal(new Set(catalog.map(e=>e.id)).size,catalog.length);
assert.equal(guides.filter(e=>e.postpartumCategory==='Clinician guided').length,2);
for(const exercise of guides){
 assert.equal(exercise.group,'Postpartum');assert.equal(exercise.prenatal,undefined);assert.equal(exercise.tracking,'time');assert.equal(exercise.defaultMinutes,undefined);assert(exercise.readiness&&exercise.adjustment&&exercise.cues.length&&exercise.guidanceUrl.startsWith('https://'));
 assert.equal(window.GymTracking.supportsWeight({},exercise),false);assert.equal(window.GymTracking.supportsDistance({},exercise),false);
 assert.equal(Object.keys(window.GymProgressData.values({done:true,tracking:'reps',sets:10,reps:100,weight:300,minutes:60,distance:{value:50,unit:'km'}},exercise)).length,0);
 assert.equal(Object.keys(window.GymProgressData.values({postpartum:true,tracking:'time',minutes:60,distance:{value:50,unit:'km'}})).length,0);
 const svg=fs.readFileSync(path.join(root,'dist',exercise.image),'utf8');assert.match(svg,/<title /);assert.match(svg,/POSITION GUIDE/);assert.doesNotMatch(svg,/<animate|<script|onload=/i);
}
const record={id:guides[0].id,postpartum:true,done:false},build=(calendar,preferences)=>data.build({catalog,calendar,preferences,through:'2026-10-17'});
assert.equal(build({'2023-01-01':[record]}).libraryGroup,'Postpartum');assert.equal(build({'2026-10-17':[record]}).type,'guided');assert.notEqual(build({'2026-10-18':[record]}).type,'guided');assert.notEqual(build({}).type,'guided');
assert.equal(build({}, {guidance:'postpartum'}).libraryGroup,'Postpartum');assert.notEqual(build({'2023-01-01':[record]}, {guidance:'general'}).type,'guided');
assert.equal(Object.hasOwn(data.clean({guidance:'auto'}),'guidance'),false);assert.equal(Object.hasOwn(data.clean({guidance:'invalid'}),'guidance'),false);
for(const goal of Object.keys(data.goals))for(const experience of ['beginner','regular'])for(const equipment of ['bodyweight','dumbbells'])for(const duration of [15,25,40]){
 const plan=build({}, {goal,experience,equipment,duration});assert.notEqual(plan.type,'guided');assert(plan.slots.length);assert(plan.slots.every(slot=>!slot.exercise.postpartum&&!slot.exercise.prenatal&&slot.choices.every(e=>!e.postpartum&&!e.prenatal)));
}
console.log('PASS: postpartum metadata, static guides, optional quantities, no competitive metrics, guidance preferences and ordinary suggestion isolation.');
