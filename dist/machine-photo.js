/* Machine photos stay in this tab. Only recognition model files are downloaded. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const lookup = document.createElement('section');
  lookup.id = 'machine-lookup';
  lookup.className = 'machine-lookup';
  lookup.setAttribute('aria-labelledby', 'machine-title');
  lookup.innerHTML = `<div class="machine-heading"><div><h3 id="machine-title">Find exercises from a machine photo</h3><p>Photograph one machine, with its seat, handles and moving parts in view.</p></div><div class="machine-actions"><button type="button" class="primary" id="machine-take">Take photo</button><button type="button" class="secondary" id="machine-upload">Upload photo</button></div></div>
    <input id="machine-photo" type="file" accept="image/*" hidden aria-label="Upload machine photo">
    <input id="machine-camera" type="file" accept="image/*" capture="environment" hidden aria-label="Take machine photo">
    <div class="machine-feedback"><img id="machine-photo-preview" alt="Your machine photo" hidden><div class="machine-response"><p id="machine-status" role="status" aria-live="polite"></p><div id="machine-suggestions" role="group" aria-label="Suggested machine matches"></div><button type="button" class="secondary" id="machine-cancel" hidden>Cancel recognition</button></div></div>
    <details id="machine-manual"><summary>Choose or correct the machine</summary><label for="machine-choice">Machine type</label><select id="machine-choice"><option value="">Choose a machine…</option></select></details>
    <div id="machine-filter" hidden><strong id="machine-filter-label"></strong><p id="machine-note"></p><button type="button" class="secondary" id="machine-clear">Show all exercises</button></div>
    <p class="machine-help">Photo matching is experimental and can confuse similar machines. Photos stay on your device. First use downloads about 155 MB plus the runtime. Confirm or correct the machine before choosing exercises.</p>`;
  document.querySelector('.library-heading').after(lookup);
  const categories = GymMachineData.categories;
  for (const category of [...categories].sort((a, b) => a.name.localeCompare(b.name))) {
    const option = document.createElement('option');
    option.value = category.id; option.textContent = category.name;
    $('machine-choice').append(option);
  }
  let machine = '', worker = null, generation = 0, busy = false;
  function status(message) { $('machine-status').textContent = message; }
  function cancel() {
    generation++; busy = false; worker?.terminate(); worker = null;
    $('machine-cancel').hidden = true;
    lookup.removeAttribute('aria-busy');
  }
  function refresh() {
    const category = GymMachineData.get(machine);
    $('machine-choice').value = category?.id || '';
    $('machine-filter').hidden = !category;
    $('machine-filter-label').textContent = category ? 'Exercises for ' + category.name : '';
    $('machine-note').textContent = category?.note || '';
    for (const button of $('machine-suggestions').children) button.setAttribute('aria-pressed', String(button.dataset.machine === machine));
  }
  function clear(resetFilters = false) {
    cancel(); machine = ''; $('machine-suggestions').replaceChildren();
    $('machine-photo-preview').removeAttribute('src'); $('machine-photo-preview').hidden = true;
    $('machine-photo').value = ''; $('machine-camera').value = '';
    status(''); refresh();
    if (resetFilters) {
      Array.from($('filters').children).find(button => button.textContent === 'All moves')?.click();
      $('reset-library-filters').click();
    }
    renderExercises();
  }
  function choose(id) {
    const category = GymMachineData.get(id);
    const wasBusy = busy;
    if (busy) cancel();
    if (!category) {
      machine = ''; refresh();
      if (wasBusy) status('Recognition cancelled. Choose a machine type, or try another photo.');
      renderExercises(); return;
    }
    // Use the existing exercise cards and selected-day planning/logging flow.
    // Clear unrelated library filters so they cannot hide the matching moves.
    machine = '';
    Array.from($('filters').children).find(button => button.textContent === 'All moves')?.click();
    $('reset-library-filters').click();
    machine = category.id;
    status('Machine selected. Preview the matching exercises below, or add them to your workout.');
    refresh(); renderExercises();
  }
  function showSuggestions(results) {
    $('machine-suggestions').replaceChildren();
    const top = results?.[0];
    if (!top || !GymMachineData.get(top.id)) {
      status('No clear machine match. Try a closer photo of one machine, or choose its type below.');
      $('machine-manual').open = true;
      return;
    }
    status(top.score < 0.18 ? 'The machine is unclear. Choose a match only if it fits your photo, or select its type below.' : 'Possible matches. Choose the machine that matches your photo to see its exercises.');
    for (const result of results.filter(item => GymMachineData.get(item.id)).slice(0, 4)) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'secondary'; button.dataset.machine = result.id;
      button.textContent = GymMachineData.get(result.id).name;
      button.setAttribute('aria-pressed', 'false');
      button.onclick = () => choose(result.id);
      $('machine-suggestions').append(button);
    }
  }
  async function recognize(file) {
    if (!file) return;
    if (busy) cancel();
    const current = ++generation;
    machine = ''; refresh(); renderExercises();
    $('machine-suggestions').replaceChildren();
    $('machine-photo-preview').removeAttribute('src'); $('machine-photo-preview').hidden = true;
    if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) {
      status('Choose a photo smaller than 20 MB. JPEG, PNG and WebP work best.'); return;
    }
    busy = true; lookup.setAttribute('aria-busy', 'true'); $('machine-cancel').hidden = false;
    status('Preparing your photo…');
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      if (current !== generation) { bitmap.close(); return; }
      const side = Math.min(768, Math.max(bitmap.width, bitmap.height));
      const scale = side / Math.max(bitmap.width, bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = Math.max(1, side);
      const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      // Keep long frames and tall cable towers inside the model's square crop.
      // Fill transparency before JPEG encoding so black equipment stays visible.
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, side, side);
      context.drawImage(bitmap, (side - width) / 2, (side - height) / 2, width, height); bitmap.close();
      const image = canvas.toDataURL('image/jpeg', 0.9);
      $('machine-photo-preview').src = image; $('machine-photo-preview').hidden = false;
      worker ||= new Worker('machine-worker.js?v=1', { type: 'module' });
      worker.onmessage = ({ data }) => {
        if (current !== generation || data.requestId !== current || !busy) return;
        if (data.type === 'progress') status(data.message);
        if (data.type === 'result' || data.type === 'error') {
          busy = false; lookup.removeAttribute('aria-busy'); $('machine-cancel').hidden = true;
          if (data.type === 'result') showSuggestions(data.results);
          else { status(data.message); $('machine-manual').open = true; }
        }
      };
      worker.onerror = () => {
        if (current !== generation || !busy) return;
        cancel(); status('Photo recognition could not start. Try again with internet, or choose the machine below.'); $('machine-manual').open = true;
      };
      worker.postMessage({ image, candidates: GymMachineData.candidates(), requestId: current });
    } catch {
      if (current !== generation) return;
      cancel(); status('This photo could not be opened. Try saving it as JPEG or PNG, or choose the machine below.'); $('machine-manual').open = true;
    }
  }
  $('machine-take').onclick = () => $('machine-camera').click();
  $('machine-upload').onclick = () => $('machine-photo').click();
  for (const id of ['machine-photo', 'machine-camera']) $(id).onchange = event => {
    const file = event.target.files[0]; event.target.value = ''; recognize(file);
  };
  $('machine-choice').onchange = event => choose(event.target.value);
  $('machine-cancel').onclick = () => { cancel(); status('Recognition cancelled. Choose a machine below, or try another photo.'); };
  $('machine-clear').onclick = () => clear(true);
  $('reset-library-filters').addEventListener('click', () => {
    if (machine) status('Machine filter cleared. Choose a photo match or machine type to narrow the library again.');
    machine = ''; refresh(); renderExercises();
  });
  window.addEventListener('gym-account-changed', () => clear());
  window.addEventListener('pagehide', cancel);
  window.GymMachinePhoto = {
    matches: exercise => !machine || GymMachineData.matches(exercise, machine),
    render: group => {
      if (machine && ['Warm-up', 'Cooldown', 'Pregnancy', 'Postpartum'].includes(group)) {
        machine = ''; refresh(); status('Machine filter cleared for this exercise section.');
      }
    }
  };
})();
