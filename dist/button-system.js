/* Keep supporting tools within reach while the exercise library leads the page. */
(() => {
  'use strict';
  function disclosure(nodes, label, className) {
    if (!nodes.length) return;
    const details = document.createElement('details');
    details.className = 'library-disclosure ' + className;
    const summary = document.createElement('summary');
    summary.textContent = label;
    nodes[0].before(details);
    details.append(summary, ...nodes);
    return details;
  }
  const library = document.querySelector('.library');
  const history = library.querySelector('.exercise-history');
  const shortcuts = disclosure([history].filter(Boolean), 'Recent exercises', 'shortcuts-disclosure');
  if (shortcuts) (document.getElementById('machine-lookup') || library.querySelector('.library-heading')).after(shortcuts);
  const muscle = library.querySelector('.muscle-select');
  const filters = document.getElementById('library-tools');
  if (muscle && filters) disclosure([muscle, filters], 'Filter exercises', 'filter-disclosure');
  const jump = document.getElementById('today');
  jump.classList.replace('primary', 'secondary');
  jump.textContent = 'Today';
  jump.setAttribute('aria-label', 'Return to today’s date');
  document.getElementById('view-workout').classList.replace('primary', 'secondary');
  document.getElementById('machine-take')?.classList.replace('primary', 'secondary');
})();
