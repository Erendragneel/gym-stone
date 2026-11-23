/* Add the gym floor-plan supplement without replacing existing exercise records. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Existing artwork has an independent immutable proof. These metadata fields may
// legitimately acquire more precise equipment names and search aliases.
const preservedMetadata = exercise => Object.fromEntries(Object.entries(exercise)
  .filter(([key]) => !['image', 'poster', 'gif', 'style', 'animation', 'variants', 'equipment', 'aliases', 'machineType'].includes(key)));
const specs = [
  {
    id: 'gym-floor-pendulum-squat', name: 'Pendulum Squat', group: 'Quads', equipment: 'Machine', machineType: 'pendulum-squat',
    aliases: ['ペンデュラムスクワット', 'Pendulum Squat Machine'],
    cues: ['Use the pendulum squat station with its shoulder and back supports adjusted for you', 'Keep your feet supported on the platform as your hips and knees bend', 'Return smoothly through a controlled range and use the station release and stops as labeled'],
    muscles: {primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings', 'deepCore']}
  },
  {
    id: 'gym-floor-v-squat', name: 'V-Squat', group: 'Quads', equipment: 'Machine', machineType: 'v-squat',
    aliases: ['Vスクワット', 'V Squat', 'V-Squat Machine'],
    cues: ['Use the V-squat station in the orientation shown on its label', 'Keep your feet planted and your torso against the intended supports', 'Bend and straighten your hips and knees without bouncing or snapping the knees straight'],
    muscles: {primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings', 'deepCore']}
  },
  {
    id: 'gym-floor-standing-hip-thrust', name: 'Standing Hip Thrust', group: 'Glutes & hips', equipment: 'Machine', machineType: 'standing-hip-thrust',
    aliases: ['スタンディングヒップスラスト', 'Standing Hip Thrust Machine'],
    cues: ['Use the dedicated standing hip-thrust station and its intended pelvis support', 'Press through your feet and extend your hips while keeping your ribs and pelvis controlled', 'Return with control rather than leaning backward to increase the range'],
    muscles: {primary: ['glutes'], secondary: ['hamstrings', 'adductors', 'abs', 'deepCore']}
  },
  {
    id: 'gym-floor-standing-machine-hip-abduction', name: 'Standing Machine Hip Abduction', group: 'Glutes & hips', equipment: 'Machine', machineType: 'standing-hip-abduction',
    aliases: ['スタンディングアウターサイ', 'Standing Hip Abduction Machine', 'Standing Outer Thigh Machine'],
    cues: ['Stand on the machine platforms and use its intended support handles and thigh pads', 'Move your legs outward against the resistance while keeping your pelvis steady', 'Return slowly without letting the resistance pull the legs together'],
    muscles: {primary: ['hipAbductors'], secondary: ['glutes', 'hipRotators', 'deepCore']}
  },
  {
    id: 'gym-floor-stationary-cycling', name: 'Stationary Cycling', group: 'Cardio', equipment: 'Upright stationary bike', machineType: 'stationary-bike',
    aliases: ['自転車', 'Stationary Bicycle', 'Exercise Bike', 'Upright Stationary Cycling'], difficulty: 'Beginner', tracking: 'time', supportsWeight: false, supportsDistance: true,
    cues: ['Adjust the seat so you can pedal comfortably without locking your knees', 'Remain seated upright and pedal smoothly at your chosen resistance', 'Record the time and, if available, the distance shown by the bike'],
    muscles: {primary: ['quads', 'glutes'], secondary: ['hamstrings', 'gastrocnemius', 'soleus']}
  },
  {
    id: 'gym-floor-decline-machine-chest-press', name: 'Decline Machine Chest Press', group: 'Chest', equipment: 'Machine', machineType: 'decline-chest-press',
    aliases: ['デクラインチェストプレス', 'Decline Chest Press Machine'],
    cues: ['Use the dedicated decline chest-press station and adjust the seat to its handles', 'Keep your back supported and wrists aligned with your forearms as you press', 'Return along the machine path with control without forcing a deep shoulder stretch'],
    muscles: {primary: ['chest'], secondary: ['triceps', 'frontDelts', 'serratus']}
  },
  {
    id: 'gym-floor-standing-machine-chest-press', name: 'Standing Machine Chest Press', group: 'Chest', equipment: 'Machine', machineType: 'standing-chest-press',
    aliases: ['スタンディングチェストプレス', 'Standing Chest Press Machine'],
    cues: ['Use the dedicated standing press machine with the supports and foot position shown on its label', 'Keep your torso steady as you press the handles forward', 'Return smoothly along the intended lever path; this is a machine press rather than a cable press'],
    muscles: {primary: ['chest'], secondary: ['triceps', 'frontDelts', 'serratus', 'abs', 'deepCore']}
  },
  {
    id: 'gym-floor-incline-machine-chest-fly', name: 'Incline Machine Chest Fly', group: 'Chest', equipment: 'Machine', machineType: 'incline-machine-fly',
    aliases: ['インクラインフライ', 'Incline Fly Machine', 'Incline Machine Fly'],
    cues: ['Use the dedicated incline fly station and adjust its seat and starting position', 'Maintain a soft elbow bend as you bring the supported arms together', 'Return with control within a comfortable shoulder range without turning the fly into a press'],
    muscles: {primary: ['chest'], secondary: ['frontDelts', 'serratus']}
  },
  {
    id: 'gym-floor-smith-machine-bench-press', name: 'Smith Machine Bench Press', group: 'Chest', equipment: 'Machine', machineType: 'smith-machine',
    aliases: ['Smith Bench Press', 'Flat Smith Machine Bench Press', 'スミスベンチプレス'],
    cues: ['Position a stable flat bench under the Smith bar and set the catches', 'Keep your shoulders supported and wrists above your forearms while lowering toward your chest', 'Press along the rail path and rerack the bar before leaving the bench'],
    muscles: {primary: ['chest'], secondary: ['triceps', 'frontDelts', 'serratus']}
  },
  {
    id: 'gym-floor-incline-smith-machine-bench-press', name: 'Incline Smith Machine Bench Press', group: 'Chest', equipment: 'Machine', machineType: 'smith-machine',
    aliases: ['Smith Incline Bench Press', 'Incline Smith Press', 'スミスインクラインベンチプレス'],
    cues: ['Place a stable incline bench beneath the Smith bar and adjust the catches', 'Keep your upper back against the bench and lower the bar toward your upper chest', 'Press along the rails without lifting your hips or forcing the shoulder range'],
    muscles: {primary: ['chest'], secondary: ['frontDelts', 'triceps', 'serratus']}
  },
  {
    id: 'gym-floor-smith-machine-shoulder-press', name: 'Smith Machine Shoulder Press', group: 'Shoulders', equipment: 'Machine', machineType: 'smith-machine',
    aliases: ['Smith Overhead Press', 'Seated Smith Shoulder Press', 'スミスショルダープレス'],
    cues: ['Use a stable supported bench positioned for a front-of-head Smith press and set the catches', 'Keep your ribs controlled and forearms beneath the bar', 'Press overhead within your available range, then lower with control in front of your head'],
    muscles: {primary: ['frontDelts', 'sideDelts'], secondary: ['triceps', 'upperTraps', 'serratus', 'deepCore']}
  },
  {
    id: 'gym-floor-smith-machine-row', name: 'Smith Machine Row', group: 'Back', equipment: 'Machine', machineType: 'smith-machine',
    aliases: ['Smith Bent-Over Row', 'Smith Machine Bent Over Row', 'スミスローイング'],
    cues: ['Hinge at your hips and take an overhand grip on the Smith bar', 'Keep your torso steady as you draw your elbows back and bring the bar toward your lower ribs', 'Lower the bar with control rather than jerking your torso upward'],
    muscles: {primary: ['lats', 'rhomboids', 'midTraps'], secondary: ['biceps', 'rearDelts', 'spinalErectors', 'forearmFlexors']}
  },
  {
    id: 'gym-floor-close-grip-smith-machine-bench-press', name: 'Close-Grip Smith Machine Bench Press', group: 'Triceps', equipment: 'Machine', machineType: 'smith-machine',
    aliases: ['Close Grip Smith Machine Bench Press', 'Smith Close-Grip Bench Press', 'スミスナローベンチプレス'],
    cues: ['Use a stable flat bench, set the catches, and choose a grip around shoulder width', 'Keep your wrists stacked above your forearms and elbows controlled as the bar lowers', 'Press along the Smith rails without allowing the wrists to fold back'],
    muscles: {primary: ['triceps'], secondary: ['chest', 'frontDelts', 'serratus']}
  },
  {
    id: 'gym-floor-rack-pull', name: 'Rack Pull', group: 'Back', equipment: 'Barbell', machineType: 'power-rack',
    aliases: ['Rack Deadlift', 'ラックプル'],
    cues: ['Set the rack supports to a height that lets you hinge to the bar with a controlled spine', 'Brace, keep the bar close, and stand by extending your hips and knees', 'Return the bar to the supports smoothly rather than dropping or bouncing it'],
    muscles: {primary: ['glutes', 'spinalErectors'], secondary: ['hamstrings', 'upperTraps', 'lats', 'forearmFlexors', 'deepCore']}
  },
  {
    id: 'gym-floor-neutral-grip-dumbbell-bench-press', name: 'Neutral-Grip Dumbbell Bench Press', group: 'Chest', equipment: 'Dumbbells', machineType: 'dumbbells',
    aliases: ['Neutral Grip Dumbbell Bench Press', 'Palms-In Dumbbell Bench Press', 'ニュートラルグリップダンベルプレス'],
    cues: ['Lie on a stable flat bench with a dumbbell in each hand and palms facing each other', 'Lower the weights with wrists above your forearms and elbows controlled beside the torso', 'Press upward without rotating into a palms-forward grip or bouncing at the bottom'],
    muscles: {primary: ['chest'], secondary: ['triceps', 'frontDelts', 'serratus']}
  },
  {
    id: 'gym-floor-underhand-barbell-row', name: 'Underhand Barbell Row', group: 'Back', equipment: 'Barbell', machineType: 'power-rack',
    aliases: ['Reverse-Grip Barbell Row', 'Supinated Barbell Row', 'アンダーグリップバーベルロー'],
    cues: ['Hinge at your hips and hold the bar with an underhand grip', 'Keep your torso steady and draw the bar toward the lower ribs with elbows close', 'Lower with control without using a backward torso swing to lift the bar'],
    muscles: {primary: ['lats', 'rhomboids', 'midTraps'], secondary: ['biceps', 'spinalErectors', 'rearDelts', 'forearmFlexors']}
  },
  {
    id: 'gym-floor-two-arm-bent-over-dumbbell-row', name: 'Two-Arm Bent-Over Dumbbell Row', group: 'Back', equipment: 'Dumbbells', machineType: 'dumbbells',
    aliases: ['Two Arm Bent Over Dumbbell Row', 'Bent-Over Dumbbell Row', 'ダンベルベントオーバーロー'],
    cues: ['Hold a dumbbell in each hand and hinge at your hips with both feet planted', 'Keep your torso steady while drawing both elbows back together', 'Lower both dumbbells smoothly rather than lifting the chest to swing the weights'],
    muscles: {primary: ['lats', 'rhomboids', 'midTraps'], secondary: ['biceps', 'rearDelts', 'spinalErectors', 'forearmFlexors']}
  },
  {
    id: 'gym-floor-dumbbell-grip-hold', name: 'Dumbbell Grip Hold', group: 'Forearms', equipment: 'Dumbbells', machineType: 'dumbbells',
    aliases: ['Dumbbell Static Hold', 'Farmer Hold', 'ダンベルホールド'], tracking: 'time', difficulty: 'Beginner',
    cues: ['Stand upright holding one dumbbell at each side with a closed grip', 'Keep your wrists neutral, shoulders level, and arms still while you hold', 'Record the time held and set the dumbbells down under control; this entry is a stationary hold'],
    muscles: {primary: ['forearmFlexors'], secondary: ['upperTraps', 'deepCore']}
  },
  {
    id: 'gym-floor-suitcase-hold', name: 'Suitcase Hold', group: 'Obliques', equipment: 'Dumbbells', machineType: 'dumbbells',
    aliases: ['Single-Arm Dumbbell Hold', 'Suitcase Static Hold', 'スーツケースホールド'], tracking: 'time', difficulty: 'Beginner',
    cues: ['Stand upright holding one dumbbell at one side', 'Keep your ribs and pelvis level without leaning toward or away from the weight', 'Hold still and record the time for each side; this entry does not require walking'],
    muscles: {primary: ['obliques', 'forearmFlexors'], secondary: ['deepCore', 'spinalErectors', 'hipAbductors', 'upperTraps']}
  },
  {
    id: 'gym-floor-treadmill-walk', name: 'Treadmill Walk', group: 'Cardio', equipment: 'Treadmill', machineType: 'treadmill',
    aliases: ['Treadmill Walking', 'トレッドミルウォーキング'], difficulty: 'Beginner', tracking: 'time', supportsWeight: false, supportsDistance: true,
    cues: ['Start the belt at a walking pace you can control', 'Walk with a natural stride and use the treadmill controls to adjust your pace', 'Record your actual walking time and any distance shown by the treadmill'],
    muscles: {primary: ['quads', 'glutes'], secondary: ['hamstrings', 'gastrocnemius', 'soleus']}
  },
  {
    id: 'gym-floor-treadmill-run', name: 'Treadmill Run', group: 'Cardio', equipment: 'Treadmill', machineType: 'treadmill',
    aliases: ['Treadmill Running', 'トレッドミルランニング'], tracking: 'time', supportsWeight: false, supportsDistance: true,
    cues: ['Build to a running pace that lets you maintain a controlled stride', 'Look forward and keep your position centered on the belt', 'Record the time and distance for the running activity and slow the belt before stepping off'],
    muscles: {primary: ['quads', 'glutes'], secondary: ['hamstrings', 'gastrocnemius', 'soleus', 'hipFlexors']}
  },
  {
    id: 'gym-floor-dumbbell-russian-twist', name: 'Dumbbell Russian Twist', group: 'Obliques', equipment: 'Dumbbells', machineType: 'dumbbells',
    aliases: ['Dumbbell Russian Twists', 'ダンベルロシアンツイスト'],
    cues: ['Sit with knees bent and heels on the floor, holding one dumbbell close to your chest with both hands', 'Turn your ribs and shoulders together from side to side while keeping your hips steady', 'Keep the dumbbell controlled rather than swinging it with your arms; count one left-and-right pair as one rep'],
    muscles: {primary: ['obliques', 'abs'], secondary: ['deepCore', 'hipFlexors', 'frontDelts', 'forearmFlexors']}
  }
];

function buildExercise({muscles, ...spec}) {
  const image = 'assets/gym-floor/' + spec.id + '.svg';
  const visual = {image, style: 'Equipment setup reference'};
  return {
    ...spec, difficulty: spec.difficulty || 'Intermediate', tracking: spec.tracking || 'reps',
    supportsWeight: spec.supportsWeight ?? true, supportsDistance: spec.supportsDistance ?? false,
    expansion: true, gymFloorSupplement: true, equipmentReference: true,
    image, style: visual.style, variants: {male: {...visual}, female: {...visual}}
  };
}

function applyToRoot(stage = root) {
  const file = path.join(stage, 'dist/exercises.json');
  const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ids = new Set(specs.map(s => s.id));
  const originals = catalog.filter(e => !ids.has(e.id));
  if (originals.length !== 435) throw Error('Expected the 435-entry baseline; review before adding supplement');
  const muscleFile = path.join(stage, 'dist/exercise-muscles.js'), window = {};
  vm.runInNewContext(fs.readFileSync(muscleFile, 'utf8'), {window});
  const baselineFile = path.join(stage, 'scripts/gym-floor-baseline.json');
  if (!fs.existsSync(baselineFile)) {
    const baseline = {catalogCount: originals.length, metadataFieldsAllowedToChange: ['equipment', 'aliases', 'machineType'],
      originalEntries: originals.map(exercise => ({id: exercise.id, name: exercise.name, metadataSha256: digest(preservedMetadata(exercise))})),
      originalMuscles: Object.fromEntries(Object.entries(window.GymMuscleData.exercises).filter(([id])=>!ids.has(id)).map(([id, profile])=>[id,digest(profile)]))};
    fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 2) + '\n');
  }
  for (const spec of specs) {
    const existing = catalog.findIndex(e => e.id === spec.id);
    if (existing < 0) {
      if (catalog.some(e => e.name.toLowerCase() === spec.name.toLowerCase())) throw Error('Existing movement needs review: ' + spec.name);
      catalog.push(buildExercise(spec));
    } else catalog[existing] = buildExercise(spec);
    window.GymMuscleData.exercises[spec.id] = {name: spec.name, ...spec.muscles, kind: spec.group === 'Cardio' ? 'cardio' : 'strength'};
  }
  fs.writeFileSync(file, JSON.stringify(catalog, null, 2) + '\n');
  fs.writeFileSync(muscleFile, '/* Explicit muscle roles; movement-family review sources are listed below. */\nwindow.GymMuscleData = ' + JSON.stringify(window.GymMuscleData, null, 2) + ';\n');
  return {catalogCount: catalog.length, added: specs.length, ids: specs.map(s => s.id)};
}
if (require.main === module) console.log(JSON.stringify(applyToRoot(), null, 2));
module.exports = {specs, buildExercise, applyToRoot, preservedMetadata, digest};
