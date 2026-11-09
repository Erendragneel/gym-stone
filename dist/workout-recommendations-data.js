/* Goal-based starting points and rotation from the most recent completed workout. */
(() => {
 'use strict';

 const goals={
  general:'General fitness',strength:'Build strength',muscle:'Build muscle',
  endurance:'Improve endurance','weight-management':'Manage weight & stay active',mobility:'Improve mobility'
 };
 const equipment={bodyweight:'Bodyweight',dumbbells:'Dumbbells',gym:'Gym equipment'};
 const strengthSource={title:'ACSM resistance training guidelines',url:'https://acsm.org/resistance-training-guidelines-update-2026/'};
 const activitySource={title:'CDC adult activity guidelines',url:'https://www.cdc.gov/physical-activity-basics/guidelines/adults.html'};
 const mobilitySource={title:'NHS strength and flexibility guidance',url:'https://www.nhs.uk/live-well/exercise/how-to-improve-strength-flexibility/'};

 const lowerMuscles=new Set(['glutes','hipAbductors','hipRotators','hipFlexors','adductors','quads','hamstrings','gastrocnemius','soleus','tibialisAnterior']);
 const upperMuscles=new Set(['chest','frontDelts','sideDelts','rearDelts','rotatorCuff','serratus','biceps','brachialis','triceps','brachioradialis','forearmFlexors','forearmExtensors','lats','upperTraps','midTraps','rhomboids']);
 const groupFocus={
  'glutes & hips':'lower',quads:'lower',hamstrings:'lower',calves:'lower',legs:'lower','lower body':'lower',
  chest:'upper',back:'upper',shoulders:'upper',biceps:'upper',triceps:'upper',forearms:'upper','upper body':'upper',
  abs:'core',obliques:'core',core:'core','full body':'full',cardio:'cardio','cardio & activity':'cardio',mobility:'mobility'
 };
 const focusNames={lower:'legs',upper:'upper body',full:'full-body strength',core:'core',cardio:'cardio',mobility:'mobility'};

 const warmup=['Standing Torso Rotations','Arm Circles','Cat-Cow','Walking Knee Hugs'];
 const cooldown=['Cross-Body Shoulder Stretch','Seated Hamstring Stretch','Standing Calf Stretch','Seated Figure-Four Glute Stretch'];
 const mobility=['Thoracic Open Book','Cat-Cow','Knee-to-Wall Ankle Mobilization',"Child's Pose Lat Reach",'Wall Slides','Prone Press-Up'];
 const baseMoves={
  squat:['Bodyweight Squat','Reverse Lunge','Bodyweight Reverse Lunge'],
  hinge:['Bodyweight Glute Bridge','Single Leg Glute Bridge','Hamstring Walkout'],
  calf:['Standing Calf Raise','Single-Leg Standing Calf Raise'],
  push:['Kneeling Push-Up','Push Up'],
  pull:['Prone Cobra Hold'],
  shoulders:['Scapular Push-Up','Push Up']
 };
 const loadedMoves={
  dumbbells:{
   squat:['Goblet Squat','Dumbbell Split Squat'],
   hinge:['Dumbbell Romanian Deadlift','Dumbbell Glute Bridge'],
   calf:['Standing Dumbbell Calf Raise'],
   push:['Dumbbell Floor Press'],
   pull:['Single Arm Dumbbell Row'],
   shoulders:['Dumbbell Lateral Raise','Hammer Curl']
  },
  gym:{
   squat:['45-Degree Leg Press','Horizontal Leg Press','Goblet Squat'],
   hinge:['Seated Leg Curl','Prone Leg Curl','Dumbbell Romanian Deadlift'],
   calf:['Standing Calf Raise Machine','Standing Dumbbell Calf Raise'],
   push:['Machine Chest Press','Incline Machine Chest Press','Dumbbell Bench Press'],
   pull:['Neutral Grip Seated Cable Row','Wide Grip Lat Pulldown','Chest Supported Machine Row'],
   shoulders:['Machine Lateral Raise','Dumbbell Lateral Raise','Standing Cable Curl']
  }
 };
 const patterns={
  lower:['squat','hinge','core','calf','hinge'],
  upper:['push','pull','core','shoulders','pull'],
  full:['squat','push','pull','hinge','core']
 };

 function clean(value={},profile={}) {
  value=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const defaultGoal=Object.hasOwn(goals,profile.goal)?profile.goal:'general';
  const time=Number(value.duration??profile.minutesPerWorkout??25);
  return {
   goal:Object.hasOwn(goals,value.goal)?value.goal:defaultGoal,
   experience:value.experience==='regular'?'regular':'beginner',
   equipment:Object.hasOwn(equipment,value.equipment)?value.equipment:'bodyweight',
   duration:[15,25,40].includes(time)?time:25,
   ...(['postpartum','general'].includes(value.guidance)?{guidance:value.guidance}:{})
  };
 }

 function validDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date=new Date(day+'T12:00:00');
  return date.getFullYear()===Number(day.slice(0,4))&&
   date.getMonth()+1===Number(day.slice(5,7))&&date.getDate()===Number(day.slice(8));
 }

 function normalize(name) {
  return typeof name==='string'?name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim():'';
 }

 function movementFocus(record,exercise,muscles) {
  const category=exercise?.group||record.group;
  const group=typeof category==='string'?category.toLowerCase().trim():'';
  if (!exercise) {
   const name=normalize(record.name);
   if (/^(leg|legs|lower body) (day|workout|session)$/.test(name)) return 'lower';
   if (/^(upper body|chest|back|push|pull) (day|workout|session)$/.test(name)) return 'upper';
  }
  if (group==='cardio'||group==='cardio & activity'||group==='mobility') return groupFocus[group];
  const primary=muscles[exercise?.id]?.primary||[];
  const lower=primary.some(muscle=>lowerMuscles.has(muscle));
  const upper=primary.some(muscle=>upperMuscles.has(muscle));
  if (lower&&upper) return 'full';
  if (lower||upper) return lower?'lower':'upper';
  if (Object.hasOwn(groupFocus,group)) return groupFocus[group];
  return null;
 }

 function history(calendar,through,byId,byName,muscles,available) {
  const days=Object.keys(calendar).filter(day=>day<=through&&validDay(day)).sort().reverse();
  let lastWorkout=null,postpartum=false;
  for (const day of days) {
   if (!Array.isArray(calendar[day])) continue;
   const entries=[];
   for (const record of calendar[day]) {
    if (!record||typeof record!=='object') continue;
    const exercise=byId.get(record.id)||byName.get(normalize(record.name));
    if (record.postpartum||exercise?.postpartum) {
     postpartum=true;
     continue;
    }
    const phase=exercise?.phase||record.phase;
    if (lastWorkout||record.done!==true||record.recovery||phase==='warmup'||phase==='cooldown'||
     /^(warm-up|cooldown|recovery)$/i.test(exercise?.group||record.group||'')||
     (!exercise&&!normalize(record.name)&&!record.group)) continue;
    if ((exercise?.prenatal||record.prenatal)&&(!exercise||!available(exercise))) continue;
    entries.push({record,exercise});
   }
   if (entries.length) {
    const counts={lower:0,upper:0,full:0,core:0,cardio:0,mobility:0};
    for (const {record,exercise} of entries) {
     const focus=movementFocus(record,exercise,muscles);
     if (focus) counts[focus]++;
    }
    const focus=counts.lower>counts.upper?'lower':counts.upper>counts.lower?'upper':
     counts.lower||counts.full?'full':counts.core?'core':counts.cardio?'cardio':counts.mobility?'mobility':null;
    lastWorkout={day,focus,entries};
   }
   if (lastWorkout&&postpartum) break;
  }
  return {lastWorkout,postpartum};
 }

 function startingTarget(kind,exercise,prefs) {
  if (kind==='warmup'||kind==='cooldown') return '2–3 min, easy';
  if (kind==='cardio') {
   const minutes={15:'5–6',25:'8–10',40:'12–16'}[prefs.duration];
   return minutes+' min at a steady pace';
  }
  if (kind==='mobility') return ({15:'2–3',25:'3–5',40:'5–6'}[prefs.duration])+' min, comfortable range';
  if (exercise.tracking==='time') return '2 × 15–30 sec';
  if (kind==='core') return '2 sets × 6–10 per side';
  if (prefs.goal==='strength'&&prefs.experience==='regular') return '2–3 sets × 5–8 reps';
  if (prefs.goal==='muscle') return (prefs.experience==='regular'&&prefs.duration!==15?'3':'2')+' sets × 8–12 reps';
  if (prefs.goal==='endurance') return '2 sets × 12–15 reps';
  return '2 sets × 8–12 reps';
 }

 function build({catalog,calendar={},preferences,through,available=()=>true,overrides={},muscles={}}) {
  const prefs=clean(preferences),regular=prefs.experience==='regular';
  const lookup=new Map(catalog.map(exercise=>[exercise.name,exercise]));
  const byName=new Map(catalog.map(exercise=>[normalize(exercise.name),exercise]));
  const byId=new Map(catalog.map(exercise=>[exercise.id,exercise]));
  const {lastWorkout:session,postpartum}=history(calendar,through,byId,byName,muscles,available);
  const lastWorkout=session?{day:session.day,focus:session.focus}:null;
  if (prefs.guidance==='postpartum'||prefs.guidance!=='general'&&postpartum) return {
   type:'guided',libraryGroup:'Postpartum',focus:'Guided postpartum recovery',
   reason:(prefs.guidance==='postpartum'?'Postpartum recovery is selected.':'A postpartum recovery entry is in your calendar.')+' Choose individual movements from the Postpartum library with your maternity team. When appropriate, choose General fitness in Personalize to resume general suggestions and keep your recovery history.',
   slots:[],preferences:prefs,lastWorkout
  };
  const prenatalCutoff=new Date(through+'T12:00:00');
  prenatalCutoff.setDate(prenatalCutoff.getDate()-2);
  if (prefs.guidance!=='general'&&session?.entries.some(({exercise})=>exercise?.prenatal)&&
   new Date(session.day+'T12:00:00')>=prenatalCutoff) return {
   type:'guided',libraryGroup:'Pregnancy',focus:'Guided pregnancy exercises',
   reason:'Your recent workout includes pregnancy-specific exercises. Use the guided Pregnancy library to choose your next session.',
   slots:[],preferences:prefs,lastWorkout
  };

  const focus=session?.focus==='lower'?'upper':session?.focus==='upper'?'lower':'full';
  const goal=prefs.goal,usesCardio=['endurance','weight-management'].includes(goal);
  const count={15:2,25:3,40:5}[prefs.duration];
  const workout=goal==='mobility'?Array(count).fill('mobility'):
   focus==='full'&&goal==='strength'?['squat','push','hinge','pull','core']:
   focus==='full'&&count===2&&session?.focus==='full'&&session.entries.some(({exercise})=>exercise?.group==='Chest')?
    ['squat','pull']:patterns[focus];
  const gymCardio=prefs.equipment==='gym'&&focus!=='upper'?['Elliptical Trainer','Air Bike']:[];
  const pools={
   warmup:focus==='upper'?warmup.slice(0,3):warmup,
   cooldown:focus==='upper'?cooldown.slice(0,1):focus==='lower'?cooldown.slice(1):cooldown,
   cardio:[...gymCardio,'Shadow Boxing',...(focus==='upper'?[]:['Lateral Shuffle'])],
   mobility,core:['Bird Dog','Dead Bug','Forearm Plank']
  };
  for (const [kind,choices] of Object.entries(baseMoves)) {
   pools[kind]=[...(loadedMoves[prefs.equipment]?.[kind]||[]),...choices];
  }
  const kinds=['warmup',...(usesCardio?['cardio',...workout]:workout).slice(0,count),'cooldown'];
  const used=new Set(),recentIds=new Set((session?.entries||[]).map(({exercise})=>exercise?.id));
  const slots=kinds.map((kind,index)=>{
   const choices=pools[kind].map(name=>lookup.get(name)).filter(exercise=>exercise&&!exercise.prenatal&&!exercise.postpartum&&
    available(exercise)&&(regular||!['Advanced','Intermediate'].includes(exercise.difficulty)));
   const requested=choices.find(exercise=>exercise.id===overrides[index]&&!used.has(exercise.id));
   const remaining=choices.filter(exercise=>!used.has(exercise.id));
   const exercise=requested||remaining.find(exercise=>!recentIds.has(exercise.id))||remaining[0];
   if (!exercise) return null;
   used.add(exercise.id);
   const family=['squat','hinge','calf'].includes(kind)?'lower':['push','pull','shoulders'].includes(kind)?'upper':kind;
   return {key:index,family,exercise,choices,target:startingTarget(kind,exercise,prefs)};
  }).filter(Boolean);

  const dayLabel=lastWorkout?new Date(lastWorkout.day+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}):null;
  const completedFocus=focusNames[lastWorkout?.focus];
  const historyNote=lastWorkout?('Your last completed workout was '+dayLabel+(completedFocus?' and focused on '+completedFocus:'. Its focus wasn’t clear')+'.'):'Start with a session based on your goal and equipment.';
  const label=goal==='mobility'?'Mobility':usesCardio?(focus==='full'?'Cardio & full body':'Cardio & '+(focus==='upper'?'upper body':'legs')):
   focus==='lower'?'Legs & core':focus==='upper'?'Upper body & core':'Full body';
  const rotationNote=goal==='mobility'?' This session uses gentle mobility work.':
   focus==='upper'?' This session gives your upper body a turn.':focus==='lower'?' This session gives your legs a turn.':'';
  const guidanceNotes={
   general:'Use a comfortable effort and train all major muscle groups over the week.',
   strength:regular?'Use a challenging resistance you can control and take time to recover between sets.':'Start with a resistance you can control and add load gradually as the movements get easier.',
   muscle:'Build up your weekly resistance-training sets gradually for the muscles you want to develop.',
   endurance:'Build up your cardio time at a steady pace. At moderate effort you can still talk.',
   'weight-management':'Combine steady cardio with strength work to support an active routine.',
   mobility:'Move slowly and stay within a comfortable range.'
  };
  const sources=goal==='mobility'?[mobilitySource]:usesCardio?[activitySource,strengthSource]:[strengthSource,activitySource];
  return {type:'workout',focus:label,reason:historyNote+rotationNote,slots,preferences:prefs,lastWorkout,guidanceNote:guidanceNotes[goal],sources};
 }

 window.GymWorkoutRecommendationsData={goals,equipment,clean,build};
})();
