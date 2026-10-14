const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'dist/workout-recommendations-data.js'),'utf8'),scope);
const data=scope.window.GymWorkoutRecommendationsData;
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'dist/exercises.json'),'utf8'));
const through='2026-10-14';
const build=(preferences={},calendar={})=>data.build({catalog,calendar,preferences,through});
assert.equal(data.clean(null,{goal:'strength'}).goal,'strength');
assert.equal(data.clean({goal:'invalid',duration:-1}).duration,25);
assert.equal(data.clean([]).equipment,'bodyweight');
for(const goal of Object.keys(data.goals))for(const equipment of ['bodyweight','dumbbells'])for(const experience of ['beginner','regular'])for(const duration of [15,25,40]) {
 const plan=build({goal,equipment,experience,duration});
 assert(plan.slots.length>=3);
 assert.equal(new Set(plan.slots.map(slot=>slot.exercise.id)).size,plan.slots.length);
 for(const {exercise} of plan.slots){
  assert(!exercise.prenatal);
  if(experience==='beginner')assert(!['Intermediate','Advanced'].includes(exercise.difficulty));
  if(equipment==='bodyweight')assert(!/dumbbell|cable|machine|goblet|hammer curl|barbell/i.test(exercise.name));
 }
}
const normal=build(),strength=build({goal:'strength'});
assert(normal.slots.some(slot=>slot.family==='core'));
assert(strength.slots.filter(slot=>slot.family==='lower').length>normal.slots.filter(slot=>slot.family==='lower').length);
assert(build({goal:'endurance'}).slots.some(slot=>slot.family==='cardio'));
assert(build({goal:'mobility'}).slots.some(slot=>slot.family==='mobility'));
const push=catalog.find(e=>e.name==='Push Up'),squat=catalog.find(e=>e.name==='Bodyweight Squat'),prenatal=catalog.find(e=>e.prenatal);
assert.equal(build({}, {[through]:[{id:push.id,done:true}]}).focus,'Legs & core');
assert.equal(build({}, {[through]:[{id:squat.id,done:true}]}).focus,'Upper body & core');
assert.equal(build({}, {'2026-10-15':[{id:push.id,done:true}]}).focus,'Full body');
assert.equal(build({}, {[through]:[{id:push.id,done:false}]}).focus,'Full body');
assert.equal(build({}, {'2026-10-01':[{id:push.id,done:true}]}).focus,'Full body');
assert.equal(build({}, {[through]:[{id:prenatal.id,done:true}]}).type,'guided');
assert.equal(data.build({catalog,through,calendar:{[through]:[{id:prenatal.id,done:true}]},preferences:{},available:e=>!e.prenatal}).type,'workout');
const first=normal.slots.find(slot=>slot.choices.some(e=>!normal.slots.some(s=>s.exercise.id===e.id)));
const alternative=first.choices.find(e=>!normal.slots.some(s=>s.exercise.id===e.id));
const replaced=data.build({catalog,through,preferences:{},overrides:{[first.key]:alternative.id}});
assert.equal(replaced.slots.find(slot=>slot.key===first.key).exercise.id,alternative.id);
assert.equal(data.build({catalog,through,preferences:{},available:()=>false}).slots.length,0);
console.log('PASS: recommendation defaults, goal/equipment/experience/time combinations, unique moves, completed-history balance, guided pregnancy boundaries and replacements.');
