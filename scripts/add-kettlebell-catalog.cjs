/* Add the illustrated kettlebell supplement without changing saved exercise IDs. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const specs = [
  {
    id: 'kettlebell-russian-twist', name: 'Kettlebell Russian Twist', group: 'Obliques',
    aliases: ['Kettlebell Russian Twists'],
    guidanceUrl: 'https://www.acefitness.org/resources/everyone/exercise-library/47/seated-medicine-ball-trunk-rotations/',
    cues: [
      'Sit with knees bent and heels on the floor, lean back slightly, and hold the kettlebell close with both hands',
      'Turn your ribs and shoulders together from side to side while keeping your hips steady; avoid swinging the bell with just your arms',
      'Use a light bell and a comfortable range; count one left-and-right pair as one rep'
    ],
    muscles: {primary: ['obliques', 'abs'], secondary: ['deepCore', 'hipFlexors', 'frontDelts', 'forearmFlexors']}
  },
  {
    id: 'kettlebell-sit-up', name: 'Kettlebell Sit-Up', group: 'Abs',
    aliases: ['Kettlebell Sit Up', 'Kettlebell Situp'],
    guidanceUrl: 'https://www.motra.com/exercises/kettlebellSitUp',
    cues: [
      'Lie on your back with knees bent and feet flat, holding a light kettlebell securely at your chest with both hands',
      'Breathe out and lift your torso toward sitting, keeping the bell at your chest and your neck relaxed',
      'Lower with control without throwing the bell forward or pressing it overhead; use bodyweight first if you cannot control the movement'
    ],
    muscles: {primary: ['abs', 'hipFlexors'], secondary: ['deepCore', 'obliques', 'frontDelts', 'forearmFlexors']}
  },
  {
    id: 'kettlebell-halo', name: 'Kettlebell Halo', group: 'Shoulders',
    guidanceUrl: 'https://www.strongfirst.com/proper-swing-grip-kettlebell-halo/',
    cues: [
      'Stand tall with feet about hip-width apart and hold a light kettlebell by the horns in front of your chest',
      'Guide the bell beside one ear, behind your head, and around the other side, keeping it close and moving only within a comfortable shoulder range',
      'Keep your ribs down, head still, and torso steady without leaning back; reverse direction and count each full circle as one rep'
    ],
    muscles: {primary: ['frontDelts', 'sideDelts', 'rotatorCuff'], secondary: ['serratus', 'upperTraps', 'triceps', 'forearmFlexors', 'abs', 'deepCore', 'obliques']}
  }
];
const file = path.join(root, 'dist/exercises.json');
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const {muscles, ...spec} of specs) {
  const existing = catalog.find(e => e.id === spec.id);
  if (existing) { existing.guidanceUrl = spec.guidanceUrl; continue; }
  if (catalog.some(e => e.name.toLowerCase() === spec.name.toLowerCase())) throw Error('Existing exercise needs review: ' + spec.name);
  const variants = Object.fromEntries(['male', 'female'].map(gender => [gender, {
    image: 'assets/kettlebell/' + gender + '-' + spec.id + '.svg', style: 'Illustrated position guide'
  }]));
  catalog.push({...spec, equipment: 'Kettlebell', difficulty: 'Intermediate', tracking: 'reps',
    supportsWeight: true, supportsDistance: false, expansion: true, illustratedGuide: true,
    image: variants.male.image, style: 'Illustrated position guide', variants});
}
fs.writeFileSync(file, JSON.stringify(catalog, null, 2) + '\n');
const muscleFile = path.join(root, 'dist/exercise-muscles.js'), window = {};
vm.runInNewContext(fs.readFileSync(muscleFile, 'utf8'), {window});
for (const {id, name, muscles} of specs) window.GymMuscleData.exercises[id] = {name, ...muscles, kind: 'strength'};
fs.writeFileSync(muscleFile, '/* Explicit muscle roles; movement-family review sources are listed below. */\nwindow.GymMuscleData = ' + JSON.stringify(window.GymMuscleData, null, 2) + ';\n');
console.log('Kettlebell supplement ready: ' + catalog.length + ' catalog entries; existing swing retained.');
