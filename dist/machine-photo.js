/* Machine photos stay in this tab. Only recognition model files are downloaded. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const lookup = document.createElement('section');
  lookup.id = 'machine-lookup';
  lookup.className = 'machine-lookup';
  lookup.setAttribute('aria-labelledby', 'machine-title');
  lookup.innerHTML = `<div class="machine-heading"><div><h3 id="machine-title">Find exercises from a machine photo</h3><p>Photograph one machine, with its seat, handles and moving parts in view.</p></div><div class="machine-actions"><button type="button" class="primary" id="machine-take">Take photo</button><button type="button" class="secondary" id="machine-upload">Upload photo</button><button type="button" class="secondary" id="machine-close" aria-label="Close machine search and clear its filter">Close</button></div></div>
    <input id="machine-photo" type="file" accept="image/*" hidden aria-label="Upload machine photo">
    <div class="machine-live-camera" id="machine-live-camera" hidden><video id="machine-video" autoplay muted playsinline hidden aria-label="Live camera preview"></video><div class="machine-actions"><button type="button" class="primary" id="machine-capture" disabled>Capture and scan</button><button type="button" class="secondary" id="machine-stop-camera">Cancel camera</button></div></div>
    <div class="machine-feedback"><img id="machine-photo-preview" alt="Your machine photo" hidden><div class="machine-response"><p id="machine-status" role="status" aria-live="polite"></p><div id="machine-suggestions" role="group" aria-label="Suggested machine matches"></div><button type="button" class="secondary" id="machine-cancel" hidden>Cancel recognition</button></div></div>
    <details id="machine-manual"><summary>Choose or correct the machine</summary><label for="machine-choice">Machine type</label><select id="machine-choice"><option value="">Choose a machine…</option></select></details>
    <div id="machine-filter" hidden><strong id="machine-filter-label"></strong><p id="machine-note"></p><button type="button" class="secondary" id="machine-clear">Show all exercises</button></div>
    <p class="machine-help">Photo matching is experimental and can confuse similar machines. Photos stay on your device. First use downloads about 155 MB plus the runtime. Confirm or correct the machine before choosing exercises.</p>`;
  document.querySelector('.library-heading').after(lookup);
  lookup.hidden = true;
  const search = document.querySelector('.library-heading .search');
  const library = lookup.closest('.library');
  const cameraPanel = $('machine-live-camera');
  const video = $('machine-video');
  const capture = $('machine-capture');
  const searchTools = document.createElement('div');
  searchTools.className = 'library-search-tools';
  const scan = document.createElement('button');
  scan.type = 'button'; scan.id = 'machine-scan'; scan.className = 'secondary machine-scan';
  scan.setAttribute('aria-label', 'Scan a machine');
  scan.setAttribute('aria-controls', 'machine-lookup');
  scan.setAttribute('aria-expanded', 'false');
  scan.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="4"/></svg><span>Scan</span>';
  search.before(searchTools); searchTools.append(search, scan);
  function showLookup() {
    lookup.hidden = false; scan.setAttribute('aria-expanded', 'true');
    const heading = document.querySelector('.library-heading').getBoundingClientRect();
    lookup.style.scrollMarginTop = Math.ceil(heading.height + 16) + 'px';
    const top = lookup.getBoundingClientRect().top;
    if (top < heading.bottom + 6 || top > window.innerHeight - 160) lookup.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  const categories = GymMachineData.categories;
  for (const category of [...categories].sort((a, b) => a.name.localeCompare(b.name))) {
    const option = document.createElement('option');
    option.value = category.id; option.textContent = category.name;
    $('machine-choice').append(option);
  }
  let machine = '', worker = null, generation = 0, busy = false;
  let cameraRequest = 0;
  function status(message) { $('machine-status').textContent = message; }
  function stopCamera() {
    cameraRequest++;
    video.srcObject?.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    video.hidden = true;
    capture.disabled = true;
    cameraPanel.hidden = true;
  }
  function cameraUnavailable(message) {
    stopCamera();
    status(message);
    $('machine-manual').open = true;
  }
  async function openCamera() {
    showLookup();
    if (!cameraPanel.hidden) return;
    if (busy) cancel();
    resetPhoto();
    renderExercises();
    const request = ++cameraRequest;
    cameraPanel.hidden = false;
    status('Opening camera… Allow camera access if prompted.');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        cameraUnavailable('Camera preview is unavailable here. Upload a photo or choose the machine below.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: 'environment' } }
      });
      if (request !== cameraRequest) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      for (const track of stream.getVideoTracks()) {
        track.addEventListener('ended', () => {
          if (request === cameraRequest) cameraUnavailable('The camera stopped. Try again or upload a photo.');
        });
      }
      video.hidden = false;
      video.srcObject = stream;
      await video.play();
    } catch (error) {
      if (request !== cameraRequest) return;
      cameraUnavailable(error.name === 'NotAllowedError'
        ? 'Camera access was blocked. Allow camera access in your browser, or upload a photo.'
        : 'The camera could not start. Try again or upload a photo.');
    }
  }
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
  function resetPhoto() {
    machine = ''; $('machine-suggestions').replaceChildren();
    $('machine-photo-preview').removeAttribute('src'); $('machine-photo-preview').hidden = true;
    refresh();
  }
  function clear(resetFilters = false) {
    stopCamera(); cancel(); resetPhoto();
    $('machine-photo').value = ''; status('');
    if (resetFilters) {
      Array.from($('filters').children).find(button => button.textContent === 'All moves')?.click();
      $('reset-library-filters').click();
    }
    renderExercises();
  }
  function choose(id) {
    if (!cameraPanel.hidden) stopCamera();
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
    showLookup();
    if (busy) cancel();
    const current = ++generation;
    resetPhoto(); renderExercises();
    if (file && (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024)) {
      status('Choose a photo smaller than 20 MB. JPEG, PNG and WebP work best.'); return;
    }
    busy = true; lookup.setAttribute('aria-busy', 'true'); $('machine-cancel').hidden = false;
    status('Preparing your photo…');
    try {
      const bitmap = file ? await createImageBitmap(file, { imageOrientation: 'from-image' }) : null;
      if (current !== generation) { bitmap?.close(); return; }
      const sourceWidth = bitmap?.width ?? video.videoWidth;
      const sourceHeight = bitmap?.height ?? video.videoHeight;
      const side = Math.min(768, Math.max(sourceWidth, sourceHeight));
      const scale = side / Math.max(sourceWidth, sourceHeight);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = Math.max(1, side);
      const width = Math.max(1, Math.round(sourceWidth * scale)), height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext('2d');
      // Keep long frames and tall cable towers inside the model's square crop.
      // Fill transparency before JPEG encoding so black equipment stays visible.
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, side, side);
      try {
        context.drawImage(bitmap ?? video, (side - width) / 2, (side - height) / 2, width, height);
      } finally {
        bitmap?.close();
        if (!file) stopCamera();
      }
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
      cancel();
      if (!file) cameraUnavailable('The camera photo could not be scanned. Try again or upload a photo.');
      else { status('This photo could not be opened. Try saving it as JPEG or PNG, or choose the machine below.'); $('machine-manual').open = true; }
    }
  }
  video.onplaying = () => {
    if (!video.srcObject) return;
    capture.disabled = false;
    status('Fit the whole machine in the frame, then tap Capture and scan.');
  };
  capture.onclick = () => {
    if (video.srcObject && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) recognize();
  };
  scan.onclick = openCamera;
  $('machine-take').onclick = openCamera;
  $('machine-stop-camera').onclick = () => {
    stopCamera(); status('Camera closed. Take another photo or upload one.'); $('machine-take').focus();
  };
  $('machine-upload').onclick = () => {
    if (!cameraPanel.hidden) { stopCamera(); status('Choose a photo to scan.'); }
    $('machine-photo').click();
  };
  $('machine-close').onclick = () => {
    clear(); lookup.hidden = true; scan.setAttribute('aria-expanded', 'false'); scan.focus({ preventScroll: true });
  };
  $('machine-photo').onchange = event => {
    const file = event.target.files[0]; event.target.value = '';
    if (file) { stopCamera(); recognize(file); }
  };
  $('machine-choice').onchange = event => choose(event.target.value);
  $('machine-cancel').onclick = () => { cancel(); status('Recognition cancelled. Choose a machine below, or try another photo.'); };
  $('machine-clear').onclick = () => clear(true);
  $('reset-library-filters').addEventListener('click', () => {
    if (machine) status('Machine filter cleared. Choose a photo match or machine type to narrow the library again.');
    machine = ''; refresh(); renderExercises();
  });
  window.addEventListener('gym-account-changed', () => { clear(); lookup.hidden = true; scan.setAttribute('aria-expanded', 'false'); });
  function stopCameraOnLeave() {
    if (!cameraPanel.hidden) { stopCamera(); status('Camera closed. Take another photo or upload one.'); }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCameraOnLeave(); });
  window.addEventListener('pagehide', stopCameraOnLeave);
  new MutationObserver(() => { if (library.hidden) stopCameraOnLeave(); })
    .observe(library, { attributes: true, attributeFilter: ['hidden'] });
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
