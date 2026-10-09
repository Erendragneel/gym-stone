(() => {
  'use strict';
  const timed = /\b(run(?:ning)?|jog(?:ging)?|walk(?:ing)?|hiking|treadmill|cycling|bike|swimming|rowing|elliptical|cardio|yoga|plank|carry|jumping jack|mountain climber)\b/i;
  function mode(record, exercise) {
    if (record.tracking === 'reps' || record.tracking === 'time') return record.tracking;
    // Keep the meaning of previously entered durations, including imported workouts.
    if (Number(record.minutes) > 0 || record.source) return 'time';
    return exercise?.tracking || (timed.test(exercise?.name || record.name || '') ? 'time' : 'reps');
  }
  function count(value) {
    if (value === '' || value == null) return null;
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 1000 ? number : null;
  }
  function weight(value) {
    if (value === '' || value == null) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 10000 ? number : null;
  }
  function weightUnit(record) {
    return record.weightUnit === 'lb' ? 'lb' : 'kg';
  }
  function weightText(record) {
    const amount = weight(record.weight);
    if (amount === null) return '';
    return amount + ' ' + weightUnit(record) + (record.weightKind === 'assistance' ? ' assistance' : '');
  }
  // New logs use row batches. Older logs remain a single batch; never add both.
  function entries(record) {
    if (!Array.isArray(record.setEntries)) return [record];
    return record.setEntries.length ? record.setEntries.map(entry => entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {}) : [{}];
  }
  function totals(record) {
    return entries(record).reduce((total, entry) => {
      const sets = count(entry.sets), reps = count(entry.reps);
      if (sets !== null && reps !== null) { total.sets += sets; total.reps += sets * reps; total.validEntries++; }
      return total;
    }, {sets:0, reps:0, validEntries:0});
  }
  function syncFirst(record) {
    if (!Array.isArray(record.setEntries)) return;
    const first = entries(record)[0];
    for (const key of ['sets','reps','weight']) record[key] = first[key] ?? null;
    record.weightUnit = weightUnit(first);
  }
  function writeEntry(record, index, key, value) {
    if (!Array.isArray(record.setEntries)) { if (index === 0) record[key] = value; return; }
    if (!record.setEntries.length) record.setEntries.push({});
    if (!record.setEntries[index] || typeof record.setEntries[index] !== 'object' || Array.isArray(record.setEntries[index])) record.setEntries[index] = {};
    record.setEntries[index][key] = value; syncFirst(record);
  }
  function addEntry(record, unit = 'kg') {
    record.setEntries = entries(record).map(entry => ({sets:entry.sets ?? null,reps:entry.reps ?? null,weight:entry.weight ?? null,weightUnit:weightUnit({weightUnit:entry.weightUnit || (weight(entry.weight) !== null ? 'kg' : unit)})}));
    record.setEntries.push({sets:null,reps:null,weight:null,weightUnit:weightUnit({weightUnit:unit})});syncFirst(record);
  }
  function removeEntry(record, index) {
    if (!Array.isArray(record.setEntries) || record.setEntries.length < 2) return;
    record.setEntries.splice(index,1);syncFirst(record);
  }
  function assistance(record, exercise = {}) {
    return record.weightKind === 'assistance' || (/assisted/i.test(exercise.name || record.name || '') && /machine/i.test(exercise.equipment || ''));
  }
  function measuredLoad(record, exercise = {}) {
    const multiple = mode(record,exercise) === 'reps' && Array.isArray(record.setEntries), candidates = multiple ? entries(record) : [record];
    let best = null;
    for (const entry of candidates) {
      const load = weight(entry.weight);
      if (load === null || (multiple && (count(entry.sets) === null || count(entry.reps) === null))) continue;
      const unit = weightUnit(entry), kg = load * (unit === 'lb' ? 0.45359237 : 1);
      if (!best || (assistance(record,exercise) ? kg < best.kg : kg > best.kg)) best = {kg,weight:load,weightUnit:unit,sets:count(entry.sets),reps:count(entry.reps)};
    }
    return best;
  }
  function repText(record) {
    return entries(record).map(entry => {
      const sets=count(entry.sets),reps=count(entry.reps),load=weightText({...entry,weightKind:record.weightKind});
      return [sets !== null && reps !== null ? sets+' sets × '+reps+' reps' : '',load].filter(Boolean).join(' · ');
    }).filter(Boolean).join('; ');
  }
  function supportsDistance(record, exercise = {}) {
    if(window.GymProgressData?.distanceKm(record.distance)!==null && record.distance)return true;
    if(exercise.phase || exercise.group==='Mobility' || exercise.pregnancyCategory==='Mobility')return false;
    const name=exercise.name||record.name||'';
    if(/\b(yoga|plank|hold|stretch|meditation)\b/i.test(name))return false;
    return /\b(run(?:ning)?|jog(?:ging)?|walk(?:ing)?|hiking|treadmill|cycl(?:ing|e)|bike|swim(?:ming)?|rowing|elliptical|stair|carry|sled)\b/i.test(name) || exercise.group==='Cardio' || (mode(record,exercise)==='time'&&['Activity','Cardio & activity'].includes(exercise.group||record.group));
  }
  function distanceText(record) {
    return window.GymProgressData?.distanceKm(record.distance)!=null?record.distance.value+' '+record.distance.unit:'';
  }
  function supportsWeight(record, exercise = {}) {
    // Keep recorded loads editable even if catalog metadata changes later.
    if (entries(record).some(entry => weight(entry.weight) !== null)) return true;
    if (typeof exercise.supportsWeight === 'boolean') return exercise.supportsWeight;
    if (exercise.phase || record.phase || exercise.group === 'Mobility' || exercise.group === 'Warm-up' || exercise.group === 'Cooldown') return false;
    if ((exercise.prenatal || record.prenatal) && exercise.pregnancyCategory !== 'Strength' && record.pregnancyCategory !== 'Strength') return false;
    const description = (exercise.name || record.name || '') + ' ' + (exercise.equipment || '');
    const loaded = /\b(barbell|dumbbells?|kettlebells?|weighted|weight plates?|ez bar|trap bar|landmine|medicine ball|slam ball|sandbag|sled|prowler|wrist roller)\b/i.test(description);
    if (loaded) return true;
    if (/\bband(?:ed|s)?\b/i.test(description)) return false;
    if (exercise.group === 'Cardio' || exercise.pregnancyCategory === 'Cardio') return false;
    // Older catalog entries have no equipment metadata. Bodyweight strength
    // exercises and timed holds/carries also support optional added weight.
    const strengthGroups = new Set(['Glutes & hips', 'Back', 'Shoulders', 'Biceps', 'Obliques', 'Chest', 'Triceps', 'Quads', 'Hamstrings', 'Calves', 'Abs', 'Forearms', 'Full body', 'Strength']);
    return strengthGroups.has(exercise.group || record.group) || exercise.pregnancyCategory === 'Strength' || mode(record, exercise) === 'reps' || /\b(carry|plank|wall sit|dead hang|hollow body hold)\b/i.test(description);
  }
  function strength(records, exerciseOf) {
    return records.reduce((total, record) => {
      if (record.done && mode(record, exerciseOf(record)) === 'reps') {
        const result = totals(record); total.sets += result.sets; total.reps += result.reps;
      }
      return total;
    }, { sets: 0, reps: 0 });
  }
  window.GymTracking = { mode, count, strength, weight, weightUnit, weightText, supportsWeight, supportsDistance, distanceText, entries, totals, writeEntry, addEntry, removeEntry, assistance, measuredLoad, repText };
})();
