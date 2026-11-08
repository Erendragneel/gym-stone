/* Machine photos stay in this tab. Only recognition model files are downloaded. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const lookup = document.createElement('section');
  lookup.id = 'machine-lookup';
  lookup.className = 'machine-lookup';
  lookup.setAttribute('aria-labelledby', 'machine-title');
  lookup.innerHTML = `<div class="machine-heading"><div><h3 id="machine-title">Find exercises from a machine photo</h3><p>Keep the machine’s seat, handles and moving parts in view.</p></div><div class="machine-actions"><button type="button" class="primary" id="machine-take">Take photo</button><button type="button" class="secondary" id="machine-upload">Upload photo</button><button type="button" class="secondary" id="machine-close" aria-label="Close machine search and clear its filter">Close</button></div></div>
    <input id="machine-photo" type="file" accept="image/*" hidden aria-label="Upload machine photo">
    <div class="machine-live-camera" id="machine-live-camera" hidden><video id="machine-video" autoplay muted playsinline hidden aria-label="Live camera preview"></video><div class="machine-actions"><button type="button" class="primary" id="machine-capture" disabled>Capture photo</button><button type="button" class="secondary" id="machine-stop-camera">Cancel camera</button></div></div>
    <section class="machine-photo-review" id="machine-photo-review" aria-labelledby="machine-review-title" hidden>
      <h4 id="machine-review-title" tabindex="-1">Choose what to scan</h4>
      <div class="machine-actions" role="group" aria-label="Photo editing tools">
        <button type="button" class="secondary" id="machine-tool-lasso" aria-pressed="false">Lasso</button>
        <button type="button" class="secondary" id="machine-tool-blur" aria-pressed="false">Blur brush</button>
        <button type="button" class="secondary" id="machine-clear-edits" disabled>Clear edits</button>
      </div>
      <p id="machine-edit-status" role="status"></p>
      <div id="machine-photo-editor" class="machine-photo-editor">
        <canvas id="machine-photo-source" role="img" aria-label="Photo to edit and scan"></canvas>
        <canvas id="machine-blur-layer" aria-hidden="true"></canvas>
        <svg id="machine-lasso-overlay" aria-hidden="true"><path id="machine-lasso-shade" fill-rule="evenodd"/><path id="machine-lasso-line" vector-effect="non-scaling-stroke"/></svg>
      </div>
      <div class="machine-actions"><button type="button" class="primary" id="machine-run-scan">Scan photo</button></div>
    </section>
    <div class="machine-feedback"><img id="machine-photo-preview" alt="Photo area used for recognition" hidden><div class="machine-response"><p id="machine-status" role="status" aria-live="polite"></p><div id="machine-suggestions" role="group" aria-label="Suggested machine matches"></div><div class="machine-actions"><button type="button" class="secondary" id="machine-edit-photo" hidden>Edit photo</button><button type="button" class="secondary" id="machine-cancel" hidden>Cancel recognition</button></div></div></div>
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
  const review = $('machine-photo-review');
  const editor = $('machine-photo-editor');
  const photo = $('machine-photo-source');
  const blur = $('machine-blur-layer');
  const blurContext = blur.getContext('2d');
  const runScan = $('machine-run-scan');
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
    const offset = Math.ceil(heading.height + 16) + 'px';
    lookup.style.scrollMarginTop = offset;
    review.style.scrollMarginTop = offset;
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
  let photoRequest = 0, mode = '', outline = null, stroke = null, blurPattern = null, hasBlur = false;
  function status(message) { $('machine-status').textContent = message; }
  function updateEditor(message) {
    $('machine-tool-lasso').setAttribute('aria-pressed', String(mode === 'lasso'));
    $('machine-tool-blur').setAttribute('aria-pressed', String(mode === 'blur'));
    editor.dataset.tool = mode;
    $('machine-clear-edits').disabled = !outline && !hasBlur;
    runScan.textContent = outline ? 'Scan selection' : 'Scan photo';
    $('machine-edit-status').textContent = message || (mode === 'lasso' ? 'Draw one loop around the machine.'
      : mode === 'blur' ? 'Paint over background machines and distractions.'
      : 'Circle one machine with Lasso, paint distractions with Blur brush, or scan the full photo.');
  }
  function drawOutline(points, closed) {
    const path = points?.length ? 'M' + points.map(point => point.join(',')).join('L') : '';
    $('machine-lasso-line').setAttribute('d', path && (closed ? path + 'Z' : path));
    $('machine-lasso-shade').setAttribute('d', closed && path
      ? `M0,0H${photo.width}V${photo.height}H0Z${path}Z` : '');
  }
  function stopStroke() {
    if (!stroke) return;
    const { id } = stroke;
    stroke = null;
    if (editor.hasPointerCapture(id)) editor.releasePointerCapture(id);
    drawOutline(outline?.points, true);
  }
  function clearEdits() {
    stopStroke();
    outline = null;
    hasBlur = false;
    blurContext.clearRect(0, 0, blur.width, blur.height);
    drawOutline();
    updateEditor();
  }
  function selectTool(tool) {
    stopStroke();
    mode = mode === tool ? '' : tool;
    updateEditor();
  }
  function pointAt(event, rect) {
    return [
      Math.round(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * photo.width),
      Math.round(Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) * photo.height)
    ];
  }
  function makeBlurPattern() {
    const softened = document.createElement('canvas');
    softened.width = photo.width;
    softened.height = photo.height;
    const context = softened.getContext('2d', { alpha: false });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, softened.width, softened.height);
    const longSide = Math.max(photo.width, photo.height);
    if ('filter' in context) {
      context.filter = `blur(${Math.max(3, longSide / 34)}px)`;
      context.drawImage(photo, 0, 0);
    } else {
      // Downsample and smooth the result on browsers without canvas filters.
      const small = document.createElement('canvas');
      small.width = Math.max(1, Math.round(28 * photo.width / longSide));
      small.height = Math.max(1, Math.round(28 * photo.height / longSide));
      small.getContext('2d').drawImage(photo, 0, 0, small.width, small.height);
      context.drawImage(small, 0, 0, softened.width, softened.height);
    }
    return blurContext.createPattern(softened, 'no-repeat');
  }
  function paintBlur(point, width, previous) {
    blurPattern ??= makeBlurPattern();
    blurContext.beginPath();
    if (previous) {
      blurContext.moveTo(...previous);
      blurContext.lineTo(...point);
      blurContext.strokeStyle = blurPattern;
      blurContext.lineWidth = width;
      blurContext.lineCap = 'round';
      blurContext.stroke();
    } else {
      blurContext.arc(...point, width / 2, 0, Math.PI * 2);
      blurContext.fillStyle = blurPattern;
      blurContext.fill();
    }
    hasBlur = true;
  }
  function finishOutline(points, rect) {
    let left = photo.width, top = photo.height, right = 0, bottom = 0, area = 0;
    for (let index = 0; index < points.length; index++) {
      const [x, y] = points[index];
      const [nextX, nextY] = points[(index + 1) % points.length];
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      area += x * nextY - nextX * y;
    }
    const width = right - left, height = bottom - top;
    const usable = points.length >= 3 && width * rect.width / photo.width >= 14
      && height * rect.height / photo.height >= 14
      && Math.abs(area) / 2 * rect.width * rect.height / (photo.width * photo.height) >= 120;
    if (usable) outline = { points, left, top, width, height };
    updateEditor(usable ? 'Area selected. Scan it or use Blur brush to remove distractions inside it.'
      : 'Draw a larger loop around the whole machine.');
  }
  editor.onpointerdown = event => {
    if (!mode || stroke || event.button !== 0 || !event.isPrimary) return;
    const rect = editor.getBoundingClientRect();
    const point = pointAt(event, rect);
    const width = Math.min(42, rect.width / 4) * photo.width / rect.width;
    editor.setPointerCapture(event.pointerId);
    stroke = { id: event.pointerId, rect, points: [point], width };
    if (mode === 'lasso') drawOutline(stroke.points, false);
    else { paintBlur(point, width); updateEditor(); }
  };
  function moveStroke(event) {
    const point = pointAt(event, stroke.rect);
    const previous = stroke.points.at(-1);
    if (point[0] === previous[0] && point[1] === previous[1]) return;
    if (mode === 'blur') {
      paintBlur(point, stroke.width, previous);
      stroke.points[0] = point;
    } else if (stroke.points.length < 2048) {
      stroke.points.push(point);
      drawOutline(stroke.points, false);
    }
  }
  editor.onpointermove = event => { if (stroke?.id === event.pointerId) moveStroke(event); };
  editor.onpointerup = event => {
    if (stroke?.id !== event.pointerId) return;
    moveStroke(event);
    if (mode === 'lasso') finishOutline(stroke.points, stroke.rect);
    stopStroke();
  };
  editor.onpointercancel = editor.onlostpointercapture = event => {
    if (stroke?.id === event.pointerId) stopStroke();
  };
  editor.oncontextmenu = event => { if (mode) event.preventDefault(); };
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
  function resetResults() {
    machine = ''; $('machine-suggestions').replaceChildren();
    $('machine-photo-preview').removeAttribute('src'); $('machine-photo-preview').hidden = true;
    $('machine-edit-photo').hidden = true;
    refresh();
  }
  function resetPhoto() {
    photoRequest++;
    review.hidden = true;
    mode = '';
    clearEdits();
    blurPattern = null;
    photo.width = blur.width = photo.height = blur.height = 1;
    resetResults();
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
  function showReview() {
    review.hidden = false;
    status('');
    updateEditor();
    if (!library.hidden) {
      review.scrollIntoView({ block: 'nearest' });
      $('machine-review-title').focus({ preventScroll: true });
    }
  }
  async function preparePhoto(file) {
    showLookup();
    if (busy) cancel();
    resetPhoto(); renderExercises();
    const current = photoRequest;
    if (file && (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024)) {
      status('Choose a photo smaller than 20 MB. JPEG, PNG and WebP work best.'); return;
    }
    status('Preparing your photo…');
    try {
      const bitmap = file ? await createImageBitmap(file, { imageOrientation: 'from-image' }) : null;
      try {
        if (current !== photoRequest) return;
        const width = bitmap?.width ?? video.videoWidth;
        const height = bitmap?.height ?? video.videoHeight;
        const scale = Math.min(1, 1600 / Math.max(width, height));
        photo.width = blur.width = Math.max(1, Math.round(width * scale));
        photo.height = blur.height = Math.max(1, Math.round(height * scale));
        const context = photo.getContext('2d', { alpha: false });
        context.fillStyle = '#fff'; context.fillRect(0, 0, photo.width, photo.height);
        context.drawImage(bitmap ?? video, 0, 0, photo.width, photo.height);
      } finally {
        bitmap?.close();
        if (!file) stopCamera();
      }
      editor.style.setProperty('--machine-photo-ratio', photo.width / photo.height);
      $('machine-lasso-overlay').setAttribute('viewBox', `0 0 ${photo.width} ${photo.height}`);
      showReview();
    } catch {
      if (current !== photoRequest) return;
      if (!file) cameraUnavailable('The camera photo could not be opened. Try again or upload a photo.');
      else { status('This photo could not be opened. Try saving it as JPEG or PNG, or choose the machine below.'); $('machine-manual').open = true; }
    }
  }
  function scanImage() {
    const { left, top, width, height } = outline || { left: 0, top: 0, width: photo.width, height: photo.height };
    const longSide = Math.max(width, height);
    const side = Math.min(768, longSide);
    const scale = side / longSide;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = side;
    const context = canvas.getContext('2d', { alpha: false });
    // Letterbox the crop and replace pixels outside the outline with white.
    context.fillStyle = '#fff'; context.fillRect(0, 0, side, side);
    context.translate((side - width * scale) / 2, (side - height * scale) / 2);
    context.scale(scale, scale);
    context.translate(-left, -top);
    context.beginPath();
    if (outline) {
      context.moveTo(...outline.points[0]);
      for (const point of outline.points.slice(1)) context.lineTo(...point);
      context.closePath();
    } else context.rect(0, 0, width, height);
    context.clip('evenodd');
    context.drawImage(photo, 0, 0);
    if (hasBlur) context.drawImage(blur, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
  }
  function recognize() {
    if (review.hidden || stroke || busy) return;
    const current = ++generation;
    resetResults(); renderExercises();
    try {
      const image = scanImage();
      review.hidden = true;
      busy = true; lookup.setAttribute('aria-busy', 'true'); $('machine-cancel').hidden = false;
      status('Preparing your scan…');
      $('machine-photo-preview').src = image; $('machine-photo-preview').hidden = false;
      $('machine-edit-photo').hidden = false;
      $('machine-edit-photo').focus({ preventScroll: true });
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
      cancel();
      status('This photo could not be scanned. Try again or choose the machine below.');
      $('machine-manual').open = true;
    }
  }
  video.onplaying = () => {
    if (!video.srcObject) return;
    capture.disabled = false;
    status('Fit the whole machine in the frame, then tap Capture photo.');
  };
  capture.onclick = () => {
    if (video.srcObject && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) preparePhoto();
  };
  $('machine-tool-lasso').onclick = () => selectTool('lasso');
  $('machine-tool-blur').onclick = () => selectTool('blur');
  $('machine-clear-edits').onclick = clearEdits;
  runScan.onclick = recognize;
  $('machine-edit-photo').onclick = () => {
    if (busy) cancel();
    resetResults(); renderExercises(); showReview();
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
    if (file) { stopCamera(); preparePhoto(file); }
  };
  $('machine-choice').onchange = event => choose(event.target.value);
  $('machine-cancel').onclick = () => { cancel(); status('Recognition cancelled. Choose a machine below, or try another photo.'); };
  $('machine-clear').onclick = () => clear(true);
  $('reset-library-filters').addEventListener('click', () => {
    if (machine) status('Machine filter cleared. Choose a photo match or machine type to narrow the library again.');
    machine = ''; refresh(); renderExercises();
  });
  window.addEventListener('gym-account-changed', () => { clear(); lookup.hidden = true; scan.setAttribute('aria-expanded', 'false'); });
  function stopPhotoInteraction() {
    stopStroke();
    if (!cameraPanel.hidden) { stopCamera(); status('Camera closed. Take another photo or upload one.'); }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPhotoInteraction(); });
  new MutationObserver(() => { if (library.hidden) stopPhotoInteraction(); })
    .observe(library, { attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('pagehide', () => { stopCamera(); cancel(); resetPhoto(); });
  window.GymMachinePhoto = {
    matches: exercise => !machine || GymMachineData.matches(exercise, machine),
    render: group => {
      if (machine && ['Warm-up', 'Cooldown', 'Pregnancy', 'Postpartum'].includes(group)) {
        machine = ''; refresh(); status('Machine filter cleared for this exercise section.');
      }
    }
  };
})();
