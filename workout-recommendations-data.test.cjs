const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'dist/exercise-muscles.js'),'utf8'),scope);
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'dist/workout-recommendations-data.js'),'utf8'),scope);
const data=scope.window.GymWorkoutRecommendationsData;
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'dist/exercises.json'),'utf8'));
const through='2026-10-14';
const muscles=scope.window.GymMuscleData.exercises;
const build=(preferences={},calendar={},date=through)=>data.build({catalog,calendar,preferences,through:date,muscles});
assert.equal(data.clean(null,{goal:'strength'}).goal,'strength');
assert.equal(data.clean({goal:'invalid',duration:-1}).duration,25);
assert.equal(data.clean([]).equipment,'bodyweight');
assert.equal(data.clean(null,{goal:'weight-management'}).goal,'weight-management');
for(const goal of Object.keys(data.goals))for(const equipment of Object.keys(data.equipment))for(const experience of ['beginner','regular'])for(const duration of [15,25,40]) {
 const plan=build({goal,equipment,experience,duration});
 assert(plan.slots.length>=3);
 assert.equal(new Set(plan.slots.map(slot=>slot.exercise.id)).size,plan.slots.length);
 assert(plan.sources.length&&plan.guidanceNote&&plan.slots.every(slot=>slot.target));
 for(const {exercise} of plan.slots){
  assert(!exercise.prenatal);
  if(experience==='beginner')assert(!['Intermediate','Advanced'].includes(exercise.difficulty));
  if(equipment==='bodyweight')assert(!/dumbbell|cable|machine|goblet|hammer curl|barbell/i.test(exercise.name));
 }
}
const normal=build(),strength=build({goal:'strength'});
assert(normal.slots.filter(slot=>slot.family==='upper').some(slot=>slot.exercise.group==='Back'));
assert(strength.slots.filter(slot=>slot.family==='lower').length>normal.slots.filter(slot=>slot.family==='lower').length);
assert(build({goal:'endurance'}).slots.some(slot=>slot.family==='cardio'));
assert(build({goal:'mobility'}).slots.some(slot=>slot.family==='mobility'));
const push=catalog.find(e=>e.name==='Push Up'),squat=catalog.find(e=>e.name==='Bodyweight Squat'),prenatal=catalog.find(e=>e.prenatal);
assert.equal(build({}, {[through]:[{id:push.id,done:true}]}).focus,'Legs & core');
assert.equal(build({}, {[through]:[{id:squat.id,done:true}]}).focus,'Upper body & core');
const shortAfterMixed=build({duration:15},{[through]:[{id:squat.id,done:true},{id:push.id,done:true}]});
assert(shortAfterMixed.slots.some(slot=>slot.family==='upper'&&slot.exercise.group==='Back'));
assert.equal(build({}, {'2026-10-15':[{id:push.id,done:true}]}).focus,'Full body');
assert.equal(build({}, {[through]:[{id:push.id,done:false}]}).focus,'Full body');
assert.equal(build({}, {'2026-10-01':[{id:push.id,done:true}]}).focus,'Legs & core');
const monday='2026-11-09',friday='2026-11-06';
const weekend={
 [friday]:[{id:squat.id,done:true}],
 '2026-11-07':[{id:push.id,done:false}],
 '2026-11-08':[{id:'recovery',done:true,recovery:true}],
 '2026-11-10':[{id:push.id,done:true}],
 '2026-02-30':[{id:push.id,done:true}],
 [monday]:[{id:'stretch-arm-circles',done:true}]
};
for(const goal of ['general','strength','muscle','endurance','weight-management','mobility']) {
 const afterLegs=build({goal,equipment:'gym'},weekend,monday);
 assert.equal(afterLegs.lastWorkout.day,friday);
 assert.equal(afterLegs.lastWorkout.focus,'lower');
 assert(afterLegs.slots.every(slot=>slot.family!=='lower'));
 if(goal!=='mobility')assert(afterLegs.slots.some(slot=>slot.family==='upper'));
}
const romanian=catalog.find(e=>e.name==='Romanian Deadlift');
assert.equal(romanian.group,'Back');
assert.equal(build({}, {[friday]:[{id:romanian.id,done:true}]},monday).lastWorkout.focus,'lower');
const custom=build({}, {[friday]:[{id:'manual',name:'Leg Day',group:'Strength',done:true}]},monday);
assert.equal(custom.focus,'Upper body & core');
assert.equal(build({}, {[friday]:[{id:'older-name',name:'BODYWEIGHT SQUAT',done:true}]},monday).focus,'Upper body & core');
assert.equal(build({}, {'2026-11-07':[{id:'legacy-lower',group:'Legs',done:true}]},monday).focus,'Upper body & core');
assert.equal(build({}, {'2026-11-99':[{id:push.id,done:true}], '2026-10-33':[{id:squat.id,done:true}]},monday).lastWorkout,null);
const latestUnknown=build({}, {...weekend,[monday]:[{id:'manual',name:'Workout',group:'Strength',done:true}]},monday);
assert.equal(latestUnknown.lastWorkout.day,monday);
assert.equal(latestUnknown.lastWorkout.focus,null);
assert.equal(latestUnknown.focus,'Full body');
const cardio=build({}, {...weekend,[monday]:[{id:'exp-shadow-boxing',done:true}]},monday);
assert.equal(cardio.lastWorkout.focus,'cardio');
assert.equal(cardio.focus,'Full body');
const heavy=build({goal:'strength',experience:'regular',equipment:'gym'},weekend,monday);
const muscle=build({goal:'muscle',experience:'regular',equipment:'gym'},weekend,monday);
assert(heavy.slots.some(slot=>slot.family==='upper'&&slot.exercise.name==='Machine Chest Press'));
assert(heavy.slots.some(slot=>slot.target.includes('5–8 reps')));
assert(muscle.slots.some(slot=>slot.target==='3 sets × 8–12 reps'));
assert(build({goal:'weight-management'},weekend,monday).slots.some(slot=>slot.family==='cardio'));
assert(build({goal:'mobility'},weekend,monday).slots.filter(slot=>slot.family==='mobility').every(slot=>slot.target.includes('comfortable range')));
assert.equal(build({}, {[through]:[{id:prenatal.id,done:true}]}).type,'guided');
assert.equal(build({}, {[friday]:[{id:prenatal.id,done:true}]},monday).type,'workout');
assert.equal(data.build({catalog,through,calendar:{[through]:[{id:prenatal.id,done:true}]},preferences:{},available:e=>!e.prenatal}).type,'workout');
const first=normal.slots.find(slot=>slot.choices.some(e=>!normal.slots.some(s=>s.exercise.id===e.id)));
const alternative=first.choices.find(e=>!normal.slots.some(s=>s.exercise.id===e.id));
const replaced=data.build({catalog,through,preferences:{},overrides:{[first.key]:alternative.id}});
assert.equal(replaced.slots.find(slot=>slot.key===first.key).exercise.id,alternative.id);
assert.equal(data.build({catalog,through,preferences:{},available:()=>false}).slots.length,0);
console.log('PASS: goal targets, equipment, rest-day rotation, calendar exclusions, muscle roles, older and custom logs, guided pregnancy boundaries and replacements.');
