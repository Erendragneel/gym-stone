/* Browse the expanded library without changing calendar records or special sections. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  let equipment = 'All equipment', level = 'All levels', populated = '';
  const existingEquipment = {
    'Goblet Squat':'Dumbbells', 'Reverse Lunge':'Dumbbells', 'Bulgarian Split Squat':'Dumbbells',
    'Conventional Deadlift':'Barbell', 'Romanian Deadlift':'Barbell', 'Pendlay Row':'Barbell',
    'T Bar Row':'Landmine', '45 Degree Back Extension':'Back extension bench',
    'Arnold Press':'Dumbbells', 'Leaning Lateral Raise':'Dumbbells', 'Plate Front Raise':'Weight plate',
    'Bent Over Rear Delt Fly':'Dumbbells', 'Chest Supported Rear Delt Fly':'Dumbbells',
    'Wide Grip Upright Row':'Barbell', 'Cuban Rotation to Press':'Dumbbells', 'Incline Bench Y Raise':'Dumbbells',
    'Hammer Curl':'Dumbbells', 'Cross Body Hammer Curl':'Dumbbells', 'Concentration Curl':'Dumbbells',
    'Spider Curl':'Dumbbells', 'Drag Curl':'Barbell', 'Zottman Curl':'Dumbbells', 'Seated Hammer Curl':'Dumbbells',
    'Side Lying Clamshell':'Resistance band', 'Weighted Russian Twist':'Medicine ball', 'Suitcase Carry':'Dumbbells',
    'Overhand Inverted Row':'Fixed bar', 'Underhand Inverted Row':'Fixed bar',
    'Pallof Press':'Cable', 'Copenhagen Plank':'Bench', 'Seated Wrist Curl':'Dumbbells', 'Seated Reverse Wrist Curl':'Dumbbells'
  };
  function equipmentOf(exercise) {
    if (exercise.equipment) return exercise.equipment;
    if (existingEquipment[exercise.name]) return existingEquipment[exercise.name];
    const name = exercise.name.toLowerCase();
    if (/dumbbell/.test(name)) return 'Dumbbells';
    if (/barbell|ez bar/.test(name)) return 'Barbell';
    if (/kettlebell/.test(name)) return 'Kettlebell';
    if (/cable|rope face pull|pulldown/.test(name)) return 'Cable';
    if (/landmine/.test(name)) return 'Landmine';
    if (/band|monster walk/.test(name)) return 'Resistance band';
    if (/machine|leg extension|leg curl|pec deck/.test(name)) return 'Machine';
    if (/pull up|pull-up|chin up|hanging/.test(name)) return 'Pull-up bar';
    if (/bench|preacher|chest supported/.test(name)) return 'Bench';
    if (/medicine ball/.test(name)) return 'Medicine ball';
    if (/step up/.test(name)) return 'Step or box';
    return 'Bodyweight';
  }
  function categoryOf(value) {
    const name = value.toLowerCase();
    if (/dumbbell/.test(name)) return 'Dumbbells';
    if (/barbell|ez bar/.test(name)) return 'Barbell';
    if (/cable/.test(name)) return 'Cable';
    if (/resistance band|finger resistance/.test(name)) return 'Resistance band';
    if (/slider/.test(name)) return 'Sliders';
    if (/medicine ball|slam ball/.test(name)) return 'Medicine ball';
    if (/sled/.test(name)) return 'Sled';
    if (/weight plates?/.test(name)) return 'Weight plate';
    if (/treadmill|elliptical|fan bike|ergometer|stair-climbing/.test(name)) return 'Cardio machine';
    return value;
  }
  function matches(exercise, group) {
    if (['Pregnancy', 'Warm-up', 'Cooldown'].includes(group)) return true;
    return (equipment === 'All equipment' || categoryOf(equipmentOf(exercise)) === equipment) &&
      (level === 'All levels' || exercise.difficulty === level);
  }
  function render(group) {
    byId('library-tools').hidden = ['Pregnancy', 'Warm-up', 'Cooldown'].includes(group);
    const signature = exercises.length + ':' + exercises.filter(e=>e.equipment).length;
    if (signature === populated) return;
    populated = signature;
    const values = Array.from(new Set(exercises.map(e=>categoryOf(equipmentOf(e))))).sort();
    const select = byId('equipment-filter');
    select.replaceChildren(...['All equipment', ...values].map(value => {
      const option = document.createElement('option'); option.value = value; option.textContent = value === 'All equipment' ? 'All' : value; return option;
    }));
    select.value = equipment;
  }
  function details(exercise) {
    if (!exercise.expansion) return false;
    const help = byId('preview-instructions'); help.replaceChildren();
    const metadata = document.createElement('strong'); metadata.className = 'exercise-metadata';
    metadata.textContent = exercise.equipment + ' · ' + exercise.difficulty + ' · ' + (exercise.tracking === 'time' ? 'Track minutes' : 'Track sets & reps');
    const cues = document.createElement('span');
    cues.textContent = exercise.cues.map(cue=>cue.trim().replace(/[.!?]+$/, '')).join('. ') + '.';
    help.append(metadata, cues);
    if (exercise.sides === 'both') { const sides = document.createElement('span'); sides.className='exercise-side-note'; sides.textContent='Repeat on the other side.'; help.append(sides); }
    if (exercise.guidanceUrl?.startsWith('https://')) {
      const source=document.createElement('a'); source.href=exercise.guidanceUrl; source.target='_blank'; source.rel='noopener'; source.className='exercise-source'; source.textContent='Exercise form guidance ↗'; help.append(source);
    }
    return true;
  }
  byId('equipment-filter').onchange=event=>{equipment=event.target.value;byId('exercise-grid').scrollTop=0;renderExercises();};
  byId('difficulty-filter').onchange=event=>{level=event.target.value;byId('exercise-grid').scrollTop=0;renderExercises();};
  byId('reset-library-filters').onclick=()=>{equipment='All equipment';level='All levels';byId('equipment-filter').value=equipment;byId('difficulty-filter').value=level;byId('search').value='';query='';byId('exercise-grid').scrollTop=0;renderExercises();};
  window.GymLibrary={matches,render,details};
  render(filter);
})();
