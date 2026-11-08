/* Machine photos stay in this tab. Only recognition model files are downloaded. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const lookup = document.createElement('section');
  lookup.id = 'machine-lookup';
  lookup.className = 'machine-lookup';
  lookup.setAttribute('aria-labelledby', 'machine-title');
  lookup.innerHTML = `<div class="machine-heading"><div><h3 id="machine-title">Find a machine or exercise</h3><p>Photograph the whole machine or get a close-up of its name and model number.</p></div><div class="machine-actions"><button type="button" class="primary" id="machine-take">Take photo</button><button type="button" class="secondary" id="machine-upload">Upload photo</button><button type="button" class="secondary" id="machine-close" aria-label="Close machine search and clear its filter">Close</button></div></div>
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
      <div class="machine-actions"><button type="button" class="primary" id="machine-run-scan">Scan photo</button><button type="button" class="secondary" id="machine-run-label" aria-describedby="machine-label-hint">Read label</button></div>
      <p id="machine-label-hint">Use Read label for a close-up of the machine’s nameplate. You can lasso the label first.</p>
    </section>
    <div class="machine-feedback"><img id="machine-photo-preview" alt="Photo area used for recognition" hidden><div class="machine-response"><p id="machine-status" role="status" aria-live="polite"></p><div id="machine-suggestions" role="group" aria-label="Suggested machine matches"></div><div class="machine-actions"><button type="button" class="secondary" id="machine-edit-photo" hidden>Edit photo</button><button type="button" class="secondary" id="machine-cancel" hidden>Cancel recognition</button></div></div></div>
    <details id="machine-manual" open><summary>Choose or correct the machine</summary><label for="machine-search">Search machine names or model numbers</label><input type="search" id="machine-search" placeholder="e.g. FWHM-012 or hack squat" maxlength="120" autocomplete="off" aria-controls="machine-choice"><label for="machine-choice">Machine type</label><select id="machine-choice"></select><div class="machine-actions" id="machine-saved-actions" hidden><button type="button" class="secondary" id="machine-forget">Clear remembered machines</button></div></details>
    <div id="machine-filter" hidden><strong id="machine-filter-label"></strong><p id="machine-note"></p><div id="machine-cable-setup" class="machine-cable-setup" hidden><label>Attachment <select id="machine-attachment"></select></label><label>Pulley height <select id="machine-pulley"></select></label></div><div class="machine-actions"><button type="button" class="secondary" id="machine-remember" hidden>Remember this machine</button><button type="button" class="secondary" id="machine-clear">Show all exercises</button></div></div>
    <p class="machine-help">Photos and saved matches stay on this device. First use of photo matching downloads about 155 MB plus the runtime. Confirm the equipment before choosing an exercise.</p>`;
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
  let machine = '', worker = null, generation = 0, busy = false;
  let labelTask = null, lastEmbedding = null, remembered = false;
  let cameraRequest = 0;
  let photoRequest = 0, mode = '', outline = null, stroke = null, blurPattern = null, hasBlur = false;
  const machineSearch = $('machine-search');
  const machineChoice = $('machine-choice');
  const attachmentChoice = $('machine-attachment');
  const pulleyChoice = $('machine-pulley');
  const scope = () => window.GymCloud?.user?.id || 'guest';
  function status(message) { $('machine-status').textContent = message; }
  function fillChoices() {
    const choices = GymMachineData.search(machineSearch.value);
    machineChoice.replaceChildren(new Option(choices.length ? 'Choose a machine…' : 'No matching machine', ''),
      ...choices.map(category => new Option(category.name, category.id)));
    machineChoice.value = machine;
    if (machineChoice.selectedIndex < 0) machineChoice.selectedIndex = 0;
    return choices;
  }
  function resetCableSetup() {
    attachmentChoice.value = '';
    pulleyChoice.value = '';
  }
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
    generation++; worker?.terminate(); worker = null;
    labelTask?.abort(); labelTask = null;
    finishScan();
  }
  function finishScan() {
    busy = false;
    $('machine-cancel').hidden = true;
    lookup.removeAttribute('aria-busy');
  }
  function refresh() {
    const category = GymMachineData.get(machine);
    machineChoice.value = category?.id || '';
    if (machineChoice.selectedIndex < 0) machineChoice.selectedIndex = 0;
    $('machine-filter').hidden = !category;
    $('machine-filter-label').textContent = category?.exerciseIds.length ? 'Exercises for ' + category.name : category?.name || '';
    $('machine-note').textContent = category?.note || '';
    $('machine-cable-setup').hidden = machine !== 'cable-station';
    $('machine-remember').hidden = !category || !lastEmbedding || remembered;
    $('machine-saved-actions').hidden = !GymMachineReferences.count(scope());
    for (const button of $('machine-suggestions').children) button.setAttribute('aria-pressed', String(button.dataset.machine === machine));
  }
  function resetResults() {
    machine = ''; lastEmbedding = null; remembered = false;
    resetCableSetup();
    $('machine-suggestions').replaceChildren();
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
    machineSearch.value = ''; fillChoices();
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
      machine = ''; remembered = false; resetCableSetup(); refresh();
      if (wasBusy) status('Recognition cancelled. Choose a machine type, or try another photo.');
      renderExercises(); return;
    }
    // Use the existing exercise cards and selected-day planning/logging flow.
    // Clear unrelated library filters so they cannot hide the matching moves.
    machine = '';
    Array.from($('filters').children).find(button => button.textContent === 'All moves')?.click();
    $('reset-library-filters').click();
    machine = category.id;
    remembered = false; resetCableSetup();
    if (machineSearch.value) { machineSearch.value = ''; fillChoices(); }
    status(category.exerciseIds.length ? 'Machine selected. Preview its exercises below.'
      : 'Machine identified. A dedicated exercise guide isn’t available for this machine yet.');
    refresh(); renderExercises();
  }
  function renderSuggestions(ids, message, highlighted = '') {
    status(message);
    const suggestions = $('machine-suggestions');
    suggestions.replaceChildren();
    $('machine-manual').open = true;
    for (const id of [...new Set(ids)].slice(0, 4)) {
      const category = GymMachineData.get(id);
      if (!category) continue;
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'secondary'; button.dataset.machine = id;
      if (id === highlighted) button.classList.add('machine-suggestion-highlight');
      const name = document.createElement('strong'); name.textContent = category.name;
      const cue = document.createElement('small'); cue.textContent = category.description;
      button.append(name, cue);
      button.setAttribute('aria-pressed', 'false');
      button.onclick = () => choose(id);
      suggestions.append(button);
    }
  }
  function showSuggestions(results = [], embedding) {
    lastEmbedding = Array.isArray(embedding) && embedding.length === 512 && embedding.every(Number.isFinite) ? embedding : null;
    const saved = lastEmbedding && GymMachineReferences.match(scope(), lastEmbedding);
    const top = results[0];
    const equipment = results.filter(item => GymMachineData.get(item.id));
    const candidates = equipment.map(item => item.id);
    if (saved && GymMachineData.get(saved.id)) {
      renderSuggestions([saved.id, ...candidates], 'This looks like a machine you remembered. Confirm it below.', saved.id);
    } else if (top && GymMachineData.get(top.id)) {
      renderSuggestions(candidates, top.score < 0.18
        ? 'The machine is unclear. Compare these suggestions or search by name or model below.'
        : 'Possible matches. Compare the equipment details before choosing.', '');
    } else if (top?.id === 'multiple-machines' && equipment[0]?.score >= 0.12 && top.score - equipment[0].score <= 0.045) {
      renderSuggestions(candidates, 'The photo may include several machines. Confirm a match or use Lasso to isolate one.');
    } else {
      renderSuggestions([], 'No clear machine match. Search below, read the label, or try a closer photo.');
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
  function scanCanvas(limit, square) {
    const { left, top, width, height } = outline || { left: 0, top: 0, width: photo.width, height: photo.height };
    const longSide = Math.max(width, height);
    const side = Math.min(limit, longSide);
    const scale = side / longSide;
    const canvas = document.createElement('canvas');
    canvas.width = square ? side : Math.max(1, Math.round(width * scale));
    canvas.height = square ? side : Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    // Letterbox the crop and replace pixels outside the outline with white.
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate((canvas.width - width * scale) / 2, (canvas.height - height * scale) / 2);
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
    return canvas;
  }
  function startScan(image, message) {
    const current = ++generation;
    resetResults(); renderExercises();
    review.hidden = true;
    busy = true; lookup.setAttribute('aria-busy', 'true'); $('machine-cancel').hidden = false;
    status(message);
    $('machine-photo-preview').src = image; $('machine-photo-preview').hidden = false;
    $('machine-edit-photo').hidden = false;
    $('machine-edit-photo').focus({ preventScroll: true });
    return current;
  }
  function scanFailed(message) {
    finishScan();
    status(message);
    $('machine-manual').open = true;
  }
  function recognize() {
    if (review.hidden || stroke || busy) return;
    try {
      const image = scanCanvas(768, true).toDataURL('image/jpeg', 0.9);
      const current = startScan(image, 'Preparing your scan…');
      worker ||= new Worker('machine-worker.js?v=2', { type: 'module' });
      worker.onmessage = ({ data }) => {
        if (current !== generation || data.requestId !== current || !busy) return;
        if (data.type === 'progress') status(data.message);
        if (data.type === 'result') { finishScan(); showSuggestions(data.results, data.embedding); }
        if (data.type === 'error') scanFailed(data.message);
      };
      worker.onerror = () => {
        if (current !== generation || !busy) return;
        cancel(); status('Photo recognition could not start. Try again with internet, or choose the machine below.'); $('machine-manual').open = true;
      };
      worker.postMessage({ image, candidates: GymMachineData.candidates(), requestId: current });
    } catch {
      cancel();
      scanFailed('This photo could not be scanned. Try again or choose the machine below.');
    }
  }
  async function readLabel() {
    if (review.hidden || stroke || busy) return;
    let current = generation;
    try {
      const canvas = scanCanvas(1600, false);
      current = startScan(canvas.toDataURL('image/jpeg', 0.9), 'Preparing to read the label on your device…');
      labelTask = new AbortController();
      const result = await GymMachineLabel.recognize(canvas, {
        signal: labelTask.signal,
        onProgress: progress => {
          if (current !== generation || !busy || progress.status !== 'recognizing text') return;
          if (Number.isFinite(progress.progress)) status(`Reading the label… ${Math.round(progress.progress * 100)}%`);
        }
      });
      if (current !== generation || !busy) return;
      labelTask = null; finishScan();
      const ids = result.machineIds.filter(id => GymMachineData.get(id));
      if (ids.length === 1) {
        renderSuggestions(ids, `Read ${result.label} on the label. Confirm the machine below.`, result.kind === 'exact' ? ids[0] : '');
      } else if (ids.length) {
        renderSuggestions(ids, 'The label matches more than one setup. Compare the options below.');
      } else {
        renderSuggestions([], 'No supported name or model was found on the label. Try a closer photo or search below.');
      }
    } catch {
      if (current !== generation) return;
      labelTask = null;
      scanFailed('The label could not be read. Try a clear close-up or search below.');
    }
  }
  video.onplaying = () => {
    if (!video.srcObject) return;
    capture.disabled = false;
    status('Frame the whole machine or its nameplate, then tap Capture photo.');
  };
  capture.onclick = () => {
    if (video.srcObject && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) preparePhoto();
  };
  $('machine-tool-lasso').onclick = () => selectTool('lasso');
  $('machine-tool-blur').onclick = () => selectTool('blur');
  $('machine-clear-edits').onclick = clearEdits;
  runScan.onclick = recognize;
  $('machine-run-label').onclick = readLabel;
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
  fillChoices();
  attachmentChoice.replaceChildren(new Option('Any attachment', ''), ...GymMachineData.cableOptions.attachments.map(option => new Option(option.name, option.id)));
  pulleyChoice.replaceChildren(new Option('Any pulley height', ''), ...GymMachineData.cableOptions.heights.map(option => new Option(option.name, option.id)));
  attachmentChoice.onchange = pulleyChoice.onchange = () => renderExercises();
  machineSearch.oninput = fillChoices;
  machineSearch.onkeydown = event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const choices = GymMachineData.search(machineSearch.value);
    if (choices.length === 1) choose(choices[0].id);
    else machineChoice.focus();
  };
  machineChoice.onchange = event => choose(event.target.value);
  $('machine-remember').onclick = () => {
    if (!machine || !lastEmbedding) return;
    remembered = GymMachineReferences.remember(scope(), machine, lastEmbedding);
    status(remembered ? 'Machine remembered on this device.' : 'This device couldn’t save the match.');
    refresh();
  };
  $('machine-forget').onclick = () => {
    if (GymMachineReferences.clear(scope())) {
      remembered = false;
      status('Remembered machines cleared from this device.');
      refresh();
    } else status('Remembered machines couldn’t be cleared.');
  };
  $('machine-cancel').onclick = () => { cancel(); status('Recognition cancelled. Choose a machine below, or try another photo.'); };
  $('machine-clear').onclick = () => clear(true);
  $('reset-library-filters').addEventListener('click', () => {
    if (machine) status('Machine filter cleared. Choose a photo match or machine type to narrow the library again.');
    machine = ''; remembered = false; resetCableSetup(); refresh(); renderExercises();
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
    matches: exercise => !GymMachineData.get(machine)?.exerciseIds.length || GymMachineData.matches(exercise, machine, {
      attachment: attachmentChoice.value, height: pulleyChoice.value
    }),
    render: group => {
      if (machine && ['Warm-up', 'Cooldown', 'Pregnancy', 'Postpartum'].includes(group)) {
        machine = ''; refresh(); status('Machine filter cleared for this exercise section.');
      }
    }
  };
})();
