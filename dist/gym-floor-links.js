/* A picture reference can open its verified station in the existing picker. */
(() => {
  'use strict';
  const id = new URLSearchParams(location.search).get('machine');
  function selectStation() {
    if (!id || !window.GymMachineData?.get(id)?.exerciseIds.length) return;
    window.GymMachinePhoto?.select(id);
  }
  window.addEventListener('gym-catalog-loaded', selectStation, { once: true });
  if (typeof exercises !== 'undefined' && exercises.length) selectStation();
})();
