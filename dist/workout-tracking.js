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
  function supportsWeight(record, exercise = {}) {
    // Keep recorded loads editable even if catalog metadata changes later.
    if (weight(record.weight) !== null) return true;
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
        const sets = count(record.sets), reps = count(record.reps);
        if (sets !== null && reps !== null) { total.sets += sets; total.reps += sets * reps; }
      }
      return total;
    }, { sets: 0, reps: 0 });
  }
  window.GymTracking = { mode, count, strength, weight, weightUnit, weightText, supportsWeight };
})();
