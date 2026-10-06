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
  function strength(records, exerciseOf) {
    return records.reduce((total, record) => {
      if (record.done && mode(record, exerciseOf(record)) === 'reps') {
        const sets = count(record.sets), reps = count(record.reps);
        if (sets !== null && reps !== null) { total.sets += sets; total.reps += sets * reps; }
      }
      return total;
    }, { sets: 0, reps: 0 });
  }
  window.GymTracking = { mode, count, strength };
})();
