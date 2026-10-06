/* Emit reviewed movement-family mappings as explicit exercise IDs; never guess from a category at runtime. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = __dirname;
const definitions = {
  chest:'Chest', frontDelts:'Front shoulders', sideDelts:'Side shoulders', rearDelts:'Rear shoulders',
  rotatorCuff:'Rotator cuff', serratus:'Serratus anterior', biceps:'Biceps', brachialis:'Brachialis',
  triceps:'Triceps', brachioradialis:'Brachioradialis', forearmFlexors:'Forearm flexors & grip', forearmExtensors:'Forearm extensors',
  lats:'Lats', upperTraps:'Upper trapezius', midTraps:'Middle & lower trapezius', rhomboids:'Rhomboids',
  spinalErectors:'Spinal erectors', abs:'Abdominals', deepCore:'Deep core stabilizers', obliques:'Obliques',
  glutes:'Gluteus maximus', hipAbductors:'Hip abductors / gluteus medius', hipRotators:'Deep hip rotators',
  hipFlexors:'Hip flexors', adductors:'Adductors', quads:'Quadriceps', hamstrings:'Hamstrings',
  gastrocnemius:'Gastrocnemius', soleus:'Soleus', tibialis:'Tibialis anterior', neck:'Neck muscles'
};
const sources = [
  {title:'NASM exercise library',url:'https://www.nasm.org/workout-exercise-guidance'},
  {title:'NASM: Goblet Squat',url:'https://www.nasm.org/resource-center/exercise-library/goblet-squat'},
  {title:'NASM: Calf training',url:'https://www.nasm.org/resource-center/blog/training/calf-training-how-to-program-this-stubborn-muscle-group-for-clients'},
  {title:'ACE exercise library',url:'https://www.acefitness.org/resources/everyone/exercise-library/'}
];
const split = s => s ? s.split(' ') : [];
const profile = (primary,secondary='',kind='strength') => ({primary:split(primary),secondary:split(secondary),kind});
const core='abs deepCore obliques';
const squat=()=>profile('quads glutes','adductors hamstrings hipAbductors abs deepCore obliques spinalErectors gastrocnemius soleus');
const lunge=()=>profile('quads glutes','adductors hamstrings hipAbductors abs deepCore obliques spinalErectors gastrocnemius soleus');
const hinge=()=>profile('hamstrings glutes','spinalErectors adductors abs deepCore obliques forearmFlexors upperTraps lats');
const press=()=>profile('chest','frontDelts triceps serratus');
function classify(e) {
  const n=e.name.toLowerCase().replace(/[-']/g,' ').replace(/\s+/g,' ').trim();
  const group=e.group;
  // Mobility and stretch roles describe tissues moved/stretched, rather than loading or EMG intensity.
  const mobility = {
    'standing calf stretch':['gastrocnemius soleus',''], 'supported calf stretch':['gastrocnemius soleus',''],
    'standing quadriceps stretch':['quads','hipFlexors'], 'seated hamstring stretch':['hamstrings','gastrocnemius'],
    'half kneeling hip flexor stretch':['hipFlexors','quads'], 'seated figure four glute stretch':['glutes hipRotators','hipAbductors'],
    'seated figure four stretch':['glutes hipRotators','hipAbductors'], 'cross body shoulder stretch':['rearDelts','rotatorCuff midTraps'],
    '90 90 hip switch':['hipRotators','glutes hipAbductors adductors hipFlexors'],
    'thoracic open book':['obliques spinalErectors','chest rearDelts'], 'quadruped thread the needle':['midTraps rhomboids rearDelts','obliques spinalErectors'],
    'wall slides':['serratus midTraps','frontDelts sideDelts rotatorCuff'], 'knee to wall ankle mobilization':['soleus','gastrocnemius tibialis'],
    'quadruped adductor rock back':['adductors','glutes hamstrings'], 'child s pose lat reach':['lats spinalErectors','rearDelts'],
    'quadruped wrist rock':['forearmFlexors forearmExtensors',''], 'gentle neck rotation':['neck','upperTraps'],
    'prone press up':['abs','hipFlexors spinalErectors'], 'doorway chest stretch':['chest','frontDelts'],
    'gentle cat arch':['spinalErectors','abs deepCore'], 'cat cow':['spinalErectors abs','deepCore'],
    'arm circles':['frontDelts sideDelts rearDelts','rotatorCuff upperTraps serratus'],
    'standing torso rotations':['obliques','abs deepCore spinalErectors'],
    'front to back leg swings':['hipFlexors glutes hamstrings','quads abs deepCore hipAbductors'],
    'lateral leg swings':['hipAbductors adductors','hipRotators abs deepCore'],
    'walking knee hugs':['hipFlexors','glutes hamstrings abs deepCore gastrocnemius soleus']
  };
  if(mobility[n])return profile(...mobility[n],group==='Warm-up'?'mobility':'stretch');
  if(n==='comfortable walk')return profile('quads glutes gastrocnemius soleus','hamstrings hipFlexors hipAbductors tibialis abs deepCore','cardio');
  if(n==='upright stationary cycling')return profile('quads glutes','hamstrings hipFlexors gastrocnemius soleus abs deepCore','cardio');
  if(n==='supported marching')return profile('hipFlexors quads','glutes hipAbductors gastrocnemius soleus abs deepCore','cardio');
  if(n==='chair sit to stand')return squat();
  if(n==='all fours leg extension')return profile('glutes','hamstrings abs deepCore obliques spinalErectors frontDelts');
  if(n==='standing wall pelvic tilt')return profile('abs deepCore','glutes obliques');
  if(/calf (raise|press)/.test(n))return /seated/.test(n)?profile('soleus','gastrocnemius'):profile('gastrocnemius soleus','tibialis');
  if(/hip adduction|side lying hip adduction|copenhagen/.test(n))return /copenhagen/.test(n)?profile('adductors obliques','abs deepCore hipAbductors frontDelts'):profile('adductors','abs deepCore hipAbductors');
  if(/clamshell/.test(n))return profile('hipAbductors hipRotators','glutes');
  if(/hip abduction|fire hydrant|monster walk|lateral band walk/.test(n))return profile('hipAbductors','hipRotators glutes abs deepCore');
  if(/hip thrust|glute bridge|frog pump/.test(n))return profile('glutes','hamstrings adductors abs deepCore obliques'+(/single leg/.test(n)?' hipAbductors':''));
  if(/hip extension|donkey kick|glute kickback/.test(n))return profile('glutes','hamstrings abs deepCore hipAbductors');
  if(/leg extension/.test(n))return profile('quads',/standing/.test(n)?'hipFlexors glutes hipAbductors abs deepCore':'');
  if(/leg curl|hamstring curl|nordic|glute ham raise|hamstring walkout/.test(n))return profile('hamstrings','gastrocnemius'+(/slider|ball|suspension|walkout|glute ham/.test(n)?' glutes abs deepCore spinalErectors':''));
  if(/suitcase deadlift/.test(n))return profile('glutes hamstrings quads','obliques abs deepCore spinalErectors forearmFlexors upperTraps hipAbductors');
  if(/deadlift/.test(n)&&!/romanian/.test(n))return profile('glutes hamstrings quads','spinalErectors adductors abs deepCore obliques forearmFlexors upperTraps lats');
  if(/romanian|\brdl\b|good morning|hip hinge|pull through/.test(n)){const p=hinge();if(/bodyweight|good morning/.test(n))p.secondary=p.secondary.filter(m=>!['forearmFlexors','upperTraps','lats'].includes(m));return p;}
  if(/kettlebell swing/.test(n))return profile('glutes hamstrings','quads spinalErectors abs deepCore obliques lats forearmFlexors gastrocnemius soleus');
  if(/back extension|reverse hyperextension|superman/.test(n))return profile('spinalErectors glutes','hamstrings deepCore'+(/superman/.test(n)?' rearDelts midTraps':''));
  if(/thruster/.test(n))return profile('quads glutes frontDelts sideDelts','triceps abs deepCore obliques spinalErectors adductors hamstrings upperTraps serratus forearmFlexors');
  if(/squat|leg press|wall sit|step down/.test(n)){
    const p=squat();if(/sumo/.test(n))p.primary.push('adductors');
    if(/leg press|hack squat|belt squat/.test(n))p.secondary=p.secondary.filter(m=>!['spinalErectors','abs','deepCore','obliques'].includes(m));
    if(n==='goblet squat')p.secondary.push('biceps','forearmFlexors','frontDelts');
    return p;
  }
  if(/lunge|step up|split squat/.test(n)){const p=lunge();if(/lateral/.test(n))p.primary.push('adductors');return p;}
  if(/close grip.*(push up|press)|bench dip|triceps dip/.test(n))return profile('triceps','chest frontDelts serratus'+(/push up/.test(n)?' abs deepCore':''));
  if(/triceps|pressdown|pushdown/.test(n)||(group==='Triceps'&&/extension/.test(n)))return profile('triceps','forearmFlexors'+(/overhead|lying/.test(n)?' frontDelts rotatorCuff':'' )+(/suspension|bodyweight/.test(n)?' abs deepCore':'') );
  if(/scapular push up|serratus punch/.test(n))return profile('serratus','chest frontDelts'+(/push up/.test(n)?' triceps abs deepCore':''));
  if(/external rotation/.test(n))return profile('rotatorCuff','rearDelts midTraps');
  if(/internal rotation/.test(n))return profile('rotatorCuff','chest lats frontDelts');
  if(/cuban rotation/.test(n))return profile('rotatorCuff frontDelts sideDelts','rearDelts upperTraps midTraps triceps serratus');
  if(/face pull|\bw (raise|pull)\b/.test(n))return profile('rearDelts rotatorCuff midTraps rhomboids','biceps forearmFlexors');
  if(/rear delt|reverse pec deck|band pull apart/.test(n))return profile('rearDelts','midTraps rhomboids rotatorCuff');
  if(/\by raise\b|\bi raise\b/.test(n))return profile('midTraps','rearDelts rotatorCuff serratus upperTraps');
  if(/lateral raise|leaning lateral/.test(n))return profile('sideDelts','upperTraps rotatorCuff');
  if(/front raise/.test(n))return profile('frontDelts','sideDelts upperTraps serratus');
  if(/scaption/.test(n))return profile('frontDelts sideDelts','rotatorCuff upperTraps serratus');
  if(/upright row/.test(n))return profile('sideDelts upperTraps','frontDelts biceps forearmFlexors');
  if(/push press/.test(n))return profile('frontDelts sideDelts triceps','quads glutes abs deepCore obliques upperTraps serratus');
  if(/shoulder press|overhead press|arnold press|landmine press|pike push up/.test(n))return profile('frontDelts sideDelts','triceps upperTraps serratus rotatorCuff'+(/standing|kneeling|pike|landmine/.test(n)?' abs deepCore obliques':''));
  if(/chest fly|cable.*fly|pec deck/.test(n)&&group==='Chest')return profile('chest','frontDelts serratus'+(/standing|suspension/.test(n)?' abs deepCore obliques':''));
  if(/bench press|floor press|chest press|squeeze press|push up|medicine ball chest pass/.test(n)&&(group==='Chest'||n==='wall push up')){
    const p=press();if(/push up|standing|single arm|suspension|medicine ball/.test(n))p.secondary.push('abs','deepCore','obliques');return p;
  }
  if(/shrug/.test(n))return profile('upperTraps','forearmFlexors');
  if(/prone cobra/.test(n))return profile('spinalErectors midTraps rhomboids','rearDelts rotatorCuff glutes');
  if(/scapular pull up/.test(n))return profile('midTraps lats','rhomboids forearmFlexors');
  if(/pull up|pulldown|chin up|pullover/.test(n)){
    const straight=/straight arm|pullover/.test(n);
    return profile('lats'+(/chin up/.test(n)?' biceps':''),straight?'chest serratus triceps abs deepCore forearmFlexors':'biceps brachialis forearmFlexors midTraps rhomboids rearDelts abs deepCore');
  }
  if(/row/.test(n)&&(group==='Back'||n==='underhand inverted row'))return profile('lats rhomboids midTraps'+(n==='underhand inverted row'?' biceps':''),'rearDelts biceps brachialis forearmFlexors'+(/bent over|pendlay|t bar|single arm|standing|renegade|suspension|inverted/.test(n)?' spinalErectors abs deepCore obliques':''));
  if(n==='seated band row')return profile('lats rhomboids midTraps','rearDelts biceps brachialis forearmFlexors');
  if(/wrist curl/.test(n))return /reverse/.test(n)?profile('forearmExtensors',''):profile('forearmFlexors','');
  if(/pinch hold|hand gripper/.test(n))return profile('forearmFlexors','');
  if(/finger band extension/.test(n))return profile('forearmExtensors','');
  if(/wrist roller|pronation and supination|radial deviation/.test(n))return profile('forearmFlexors forearmExtensors','brachioradialis');
  if(/dead hang/.test(n))return profile('forearmFlexors','lats midTraps rotatorCuff');
  if(/curl/.test(n)&&group==='Biceps')return /reverse/.test(n)?profile('brachialis brachioradialis','biceps forearmFlexors forearmExtensors'): /hammer/.test(n)?profile('biceps brachialis brachioradialis','forearmFlexors'): /zottman/.test(n)?profile('biceps brachialis brachioradialis','forearmFlexors forearmExtensors'):profile('biceps brachialis','brachioradialis forearmFlexors');
  if(n==='seated band biceps curl')return profile('biceps brachialis','forearmFlexors');
  if(/bird dog/.test(n))return profile('deepCore spinalErectors','abs obliques glutes hamstrings rearDelts');
  if(/dead bug/.test(n))return profile('abs deepCore','obliques hipFlexors');
  if(/pallof/.test(n))return profile('obliques deepCore','abs glutes hipAbductors frontDelts forearmFlexors');
  if(/cable row/.test(n)&&group==='Obliques')return profile('obliques deepCore lats','abs rhomboids midTraps rearDelts biceps glutes hipAbductors frontDelts');
  if(/side plank/.test(n))return profile('obliques deepCore','abs hipAbductors glutes frontDelts serratus');
  if(/suitcase carry/.test(n))return profile('obliques deepCore forearmFlexors','abs spinalErectors upperTraps glutes hipAbductors quads gastrocnemius soleus');
  if(/overhead carry/.test(n))return profile('obliques deepCore frontDelts sideDelts','abs rotatorCuff upperTraps serratus triceps forearmFlexors glutes hipAbductors quads gastrocnemius soleus');
  if(/windmill/.test(n))return profile('obliques deepCore','abs spinalErectors glutes hamstrings rotatorCuff frontDelts sideDelts forearmFlexors');
  if(/bear plank dumbbell drag/.test(n))return profile('obliques abs deepCore','frontDelts triceps serratus quads glutes forearmFlexors lats');
  if(/bicycle|cross body crunch|heel touches|side bend|oblique crunch|side lying oblique/.test(n))return profile('obliques abs','deepCore'+(/bicycle|v up/.test(n)?' hipFlexors':''));
  if(/windshield|hanging.*(twist|oblique)|reverse crunch with rotation/.test(n))return profile('obliques abs hipFlexors','deepCore'+(/hanging/.test(n)?' forearmFlexors lats':''));
  if(/russian twist|woodchop|cable rotation|landmine rotation|rotational (throw|slam)/.test(n))return profile('obliques abs','deepCore spinalErectors glutes frontDelts forearmFlexors'+(/throw|slam|standing|landmine/.test(n)?' quads hipAbductors':''));
  if(/mountain climber/.test(n))return profile('hipFlexors abs'+(/cross body/.test(n)?' obliques':''),'deepCore obliques frontDelts triceps serratus quads glutes');
  if(/leg raise|knee raise|flutter kick|v up|sit up|knee tuck/.test(n))return profile('abs hipFlexors','deepCore obliques'+(/hanging/.test(n)?' forearmFlexors lats':'')+(/knee tuck/.test(n)?' frontDelts triceps serratus':''));
  if(/crunch/.test(n))return profile('abs','obliques deepCore');
  if(/plank|hollow body|ab wheel|body saw/.test(n))return profile('abs deepCore','obliques glutes frontDelts serratus'+(/wheel|body saw/.test(n)?' lats triceps hipFlexors':'')+(/bear/.test(n)?' quads hipFlexors':''));
  if(/jumping jack/.test(n))return profile('quads glutes hipAbductors gastrocnemius soleus','adductors hamstrings frontDelts sideDelts abs deepCore','cardio');
  const cardio={
    'treadmill jog':['quads glutes hamstrings gastrocnemius soleus','hipFlexors hipAbductors tibialis abs deepCore'],
    'elliptical trainer':['quads glutes hamstrings','gastrocnemius soleus hipFlexors abs deepCore lats biceps triceps frontDelts'],
    'rowing machine':['quads glutes lats','hamstrings spinalErectors abs deepCore obliques rhomboids midTraps rearDelts biceps forearmFlexors gastrocnemius soleus'],
    'air bike':['quads glutes','hamstrings gastrocnemius soleus hipFlexors chest frontDelts triceps lats biceps abs deepCore'],
    'stair climber':['quads glutes gastrocnemius soleus','hamstrings hipFlexors hipAbductors abs deepCore'],
    'jump rope':['gastrocnemius soleus quads','glutes hamstrings hipFlexors abs deepCore frontDelts forearmFlexors forearmExtensors'],
    'shadow boxing':['frontDelts triceps serratus obliques','chest abs deepCore hipFlexors glutes quads gastrocnemius soleus'],
    'lateral shuffle':['quads glutes hipAbductors adductors','hamstrings gastrocnemius soleus abs deepCore'],
    'high knees':['hipFlexors quads','glutes hamstrings gastrocnemius soleus abs deepCore obliques'],
    'butt kicks':['hamstrings gastrocnemius soleus','quads glutes hipFlexors abs deepCore'],
    'step back burpee':['quads glutes chest triceps','hamstrings gastrocnemius soleus frontDelts abs deepCore obliques serratus'],
    'medicine ball slam':['lats abs obliques','quads glutes hamstrings spinalErectors frontDelts triceps forearmFlexors deepCore'],
    'sled push':['quads glutes gastrocnemius soleus','hamstrings abs deepCore obliques chest frontDelts triceps'],
    'backward sled drag':['quads','glutes hamstrings gastrocnemius soleus abs deepCore forearmFlexors'],
    'battle rope alternating waves':['frontDelts sideDelts forearmFlexors','biceps triceps lats abs deepCore obliques quads glutes'],
    'farmer s carry':['forearmFlexors upperTraps deepCore','abs obliques spinalErectors glutes hipAbductors quads hamstrings gastrocnemius soleus'],
    'sandbag bear hug carry':['biceps forearmFlexors abs deepCore','frontDelts chest spinalErectors obliques glutes quads hamstrings gastrocnemius soleus'],
    'bear crawl':['abs deepCore frontDelts quads','obliques triceps serratus hipFlexors glutes gastrocnemius soleus'],
    'inchworm walkout':['abs deepCore frontDelts','obliques serratus triceps hamstrings glutes gastrocnemius soleus']
  };
  if(cardio[n])return profile(...cardio[n],group==='Cardio'?'cardio':'strength');
  throw Error('No reviewed movement profile for '+e.id+' / '+e.name);
}
const catalog=JSON.parse(fs.readFileSync(path.join(root,'dist/exercises.json'),'utf8'));
const expansionPath=path.join(root,'animation-source/expansion-v16/jobs.json');
const planned=fs.existsSync(expansionPath)?JSON.parse(fs.readFileSync(expansionPath,'utf8')):[];
const all=[...new Map([...catalog,...planned].map(e=>[e.id,e])).values()];
const exercises={};
for(const e of all){
  const p=classify(e);
  p.primary=[...new Set(p.primary.flat())];
  p.secondary=[...new Set(p.secondary.flat())].filter(m=>!p.primary.includes(m));
  if(!p.primary.length||[...p.primary,...p.secondary].some(m=>!definitions[m]))throw Error('Invalid muscle keys for '+e.name);
  exercises[e.id]={name:e.name,...p};
}
const data={definitions,sources,exercises};
fs.writeFileSync(path.join(root,'dist/exercise-muscles.js'),'/* Explicit muscle roles; movement-family review sources are listed below. */\nwindow.GymMuscleData = '+JSON.stringify(data,null,2)+';\n');
console.log('Muscle coverage: '+catalog.length+' active exercises; '+all.length+' total reviewed exercise IDs.');
