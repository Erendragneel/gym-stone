/* Discover preparation and recovery movements through the same exercise picker. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const source = 'https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20047931';
  const guidance = {
    'Warm-up': 'Before your workout: start with 5–10 minutes of easy walking, then move gently through these warm-up movements.',
    'Cooldown': 'After your workout: ease down first, then hold each stretch for 30 seconds per side. Breathe normally; don’t bounce or stretch into pain.'
  };
  let pregnancyCategory = 'All';
  function matches(exercise, group) {
    return group !== 'Pregnancy' || pregnancyCategory === 'All' || exercise.pregnancyCategory === pregnancyCategory;
  }
  function duration(exercise) {
    if (!exercise?.phase || exercise.prenatal) return '';
    const total = Math.max(0, Number(exercise.defaultMinutes) || 1);
    const seconds = Number(exercise.suggestedSeconds) || 30;
    return exercise.phase === 'cooldown' ? seconds + ' sec per side · ' + total + ' min total' : (exercise.sides === 'both' ? seconds + ' sec per side · ' : '') + total + ' min of gentle movement';
  }
  function render(group) {
    for (const button of byId('stretch-tabs').querySelectorAll('button')) {
      const active = button.dataset.group === group || (button.dataset.group === 'All moves' && !guidance[group] && group !== 'Pregnancy');
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    const help = byId('stretch-guidance');
    help.hidden = !guidance[group];
    byId('stretch-guidance-text').textContent = guidance[group] || '';
    byId('pregnancy-guidance').hidden = group !== 'Pregnancy';
    document.querySelector('.library').classList.toggle('is-pregnancy', group === 'Pregnancy');
  }
  function cueText(cues) {
    return Array.isArray(cues) ? cues.map(cue => cue.trim().replace(/[.!?]+$/, '')).join('. ') + '.' : (cues || 'Move comfortably and breathe normally.');
  }
  function preview(exercise) {
    const help = byId('preview-instructions');
    help.replaceChildren();
    if (exercise.prenatal) {
      const cues = document.createElement('span'); cues.textContent = cueText(exercise.cues); help.append(cues);
      const adjustment = exercise.adjustment || exercise.adjustments;
      if (adjustment) {
        const note = document.createElement('span'); note.className = 'pregnancy-adjustment';
        note.textContent = 'Adjust for comfort: ' + (Array.isArray(adjustment) ? adjustment.join(' ') : adjustment); help.append(note);
      }
      const reminder = document.createElement('span'); reminder.className = 'pregnancy-preview-note';
      reminder.textContent = 'Use your clinician-approved plan and stop if you feel uncomfortable or unwell.'; help.append(reminder);
      if (exercise.guidanceUrl?.startsWith('https://')) {
        const link = document.createElement('a'); link.href = exercise.guidanceUrl; link.target = '_blank'; link.rel = 'noopener';
        link.textContent = 'Read pregnancy exercise guidance ↗'; link.className = 'pregnancy-preview-source'; help.append(link);
      }
      return;
    }
    if (!exercise.phase) {
      help.textContent = 'Watch the movement, then add it to your selected day.';
      return;
    }
    const timing = document.createElement('strong');
    timing.className = 'stretch-timing'; timing.textContent = duration(exercise);
    const cues = document.createElement('span');
    cues.textContent = cueText(exercise.cues);
    help.append(timing, cues);
  }
  byId('stretch-guidance-source').href = source;
  byId('pregnancy-category').onchange = event => {
    pregnancyCategory = event.target.value;
    byId('exercise-grid').scrollTop = 0; renderExercises();
  };
  const category = byId('muscle-filter');
  if (category) category.parentElement.firstChild.textContent = 'Category ';
  byId('stretch-tabs').addEventListener('click', event => {
    const button = event.target.closest('button[data-group]');
    if (!button) return;
    // Use the original filter action, so the dropdown and picker keep their state.
    const target = Array.from(byId('filters').children).find(option => option.textContent === button.dataset.group);
    if (!target) return;
    byId('search').value = ''; query = ''; target.click();
    const select = byId('muscle-filter'); if (select) select.value = filter;
  });
  window.GymStretches = { render, preview, duration, matches };
  render(filter);
})();
