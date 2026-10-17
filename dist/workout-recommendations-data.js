/* Deterministic suggestions from a small, equipment-aware subset of the existing catalog. */
(() => {
 'use strict';
 const goals={'general':'General fitness',strength:'Build strength',muscle:'Build muscle',endurance:'Improve endurance',mobility:'Mobility'};
 function clean(value={},profile={}) {
  value=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const defaultGoal={strength:'strength',endurance:'endurance',mobility:'mobility'}[profile.goal]||'general';
  const time=Number(value.duration??profile.minutesPerWorkout??25);
  return {goal:Object.hasOwn(goals,value.goal)?value.goal:defaultGoal,experience:value.experience==='regular'?'regular':'beginner',equipment:value.equipment==='dumbbells'?'dumbbells':'bodyweight',duration:[15,25,40].includes(time)?time:25,...(['postpartum','general'].includes(value.guidance)?{guidance:value.guidance}:{})};
 }
 function build({catalog,calendar={},preferences,through,available=()=>true,overrides={}}) {
  const prefs=clean(preferences),lookup=new Map(catalog.map(e=>[e.name,e])),byId=new Map(catalog.map(e=>[e.id,e]));
  const recovering=Object.entries(calendar).some(([day,entries])=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&day<=through&&Array.isArray(entries)&&entries.some(record=>record&&(record.postpartum||byId.get(record.id)?.postpartum)));
  if(prefs.guidance==='postpartum'||prefs.guidance!=='general'&&recovering)return {type:'guided',libraryGroup:'Postpartum',focus:'Guided postpartum recovery',reason:(prefs.guidance==='postpartum'?'Postpartum recovery is selected.':'A postpartum recovery entry is in your calendar.')+' Choose individual movements from the Postpartum library with your maternity team. When appropriate, choose General fitness in Personalize to resume general suggestions and keep your recovery history.',slots:[],preferences:prefs};
  const recentCutoff=new Date(through+'T12:00:00');recentCutoff.setDate(recentCutoff.getDate()-2);
  const cutoff=`${recentCutoff.getFullYear()}-${String(recentCutoff.getMonth()+1).padStart(2,'0')}-${String(recentCutoff.getDate()).padStart(2,'0')}`;
  const latest=Object.keys(calendar).filter(day=>day<=through&&day>=cutoff&&Array.isArray(calendar[day])&&calendar[day].some(r=>r.done&&!r.recovery)).sort().at(-1);
  const recent=(calendar[latest]||[]).filter(r=>r.done&&!r.recovery).map(r=>catalog.find(e=>e.id===r.id)).filter(Boolean);
  if(prefs.guidance!=='general'&&recent.some(e=>e.prenatal&&available(e)))return {type:'guided',libraryGroup:'Pregnancy',focus:'Guided pregnancy exercises',reason:'Your recent workout includes pregnancy-specific exercises. Use the guided Pregnancy library to choose your next session.',slots:[],preferences:prefs};
  const lower=/quads|glutes|hips|hamstrings|calves/i,upper=/chest|back|shoulders|biceps|triceps/i;
  const lowerCount=recent.filter(e=>lower.test(e.group)).length,upperCount=recent.filter(e=>upper.test(e.group)).length;
  const focus=upperCount>lowerCount?'lower':lowerCount>upperCount?'upper':'full';
  const regular=prefs.experience==='regular',weighted=prefs.equipment==='dumbbells',used=new Set();
  const pools={
   warmup:['Standing Torso Rotations','Arm Circles','Cat-Cow','Walking Knee Hugs'],
   lower:weighted?['Goblet Squat','Standing Dumbbell Calf Raise','Bodyweight Glute Bridge','Bodyweight Squat']:regular?['Bodyweight Squat','Bodyweight Reverse Lunge','Single Leg Glute Bridge','Standing Calf Raise','Bodyweight Glute Bridge']:['Bodyweight Squat','Bodyweight Glute Bridge','Standing Calf Raise'],
   upper:weighted?['Dumbbell Lateral Raise','Hammer Curl','Kneeling Push-Up','Push Up']:regular?['Push Up','Scapular Push-Up','Kneeling Push-Up']:['Kneeling Push-Up','Scapular Push-Up'],
   core:['Bird Dog','Dead Bug'],cardio:['Shadow Boxing','Lateral Shuffle'],
   cooldown:focus==='upper'?['Cross-Body Shoulder Stretch','Seated Hamstring Stretch']:['Standing Calf Stretch','Seated Figure-Four Glute Stretch','Seated Hamstring Stretch'],
   mobility:['Cat-Cow','Standing Torso Rotations','Cross-Body Shoulder Stretch','Seated Hamstring Stretch']
  };
  let families=prefs.goal==='mobility'?['mobility','mobility','mobility']:focus==='lower'?['lower','lower','core']:focus==='upper'?['upper','upper','core']:['lower','upper','core'];
  if(focus==='full'&&prefs.goal==='strength')families=['lower','upper','lower'];
  if(focus==='full'&&prefs.goal==='muscle')families=['lower','upper','upper'];
  if(prefs.goal==='endurance')families=['cardio',...families];
  const count=prefs.duration===15?2:prefs.duration===40?5:3;
  while(families.length<count)families.push(focus==='upper'?'upper':'lower', 'core');
  families=families.slice(0,count);
  const slotFamilies=['warmup',...families,'cooldown'];
  const slots=slotFamilies.map((family,index)=>{
   const choices=pools[family].map(name=>lookup.get(name)).filter(e=>e&&!e.prenatal&&!e.postpartum&&available(e)&&(regular||e.difficulty!=='Advanced'&&e.difficulty!=='Intermediate'));
   const requested=choices.find(e=>e.id===overrides[index]);
   const exercise=requested&&!used.has(requested.id)?requested:choices.find(e=>!used.has(e.id)&&!recent.some(r=>r.id===e.id))||choices.find(e=>!used.has(e.id));
   if(!exercise)return null;used.add(exercise.id);
   return {key:index,family,exercise,choices};
  }).filter(Boolean);
  const reason=recent.length?(focus==='full'?'Your recent completed workout covered several areas. This suggestion spreads the next session across legs, upper body and core.':focus==='lower'?'Your recent completed workout focused more on upper body. This suggestion gives legs and core a turn.':'Your recent completed workout focused more on legs. This suggestion gives upper body and core a turn.'):'Start with a balanced session based on your preferences. Recommendations will adapt as you complete workouts.';
  return {type:'workout',focus:prefs.goal==='mobility'?'Mobility':prefs.goal==='endurance'?'Cardio & movement':focus==='lower'?'Legs & core':focus==='upper'?'Upper body & core':'Full body',reason,slots,preferences:prefs};
 }
 window.GymWorkoutRecommendationsData={goals,clean,build};
})();
