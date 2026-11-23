/* Bilingual floor-plan reference; photographs are examples, not model identification. */
(() => {
  'use strict';
  const grid = document.getElementById('machine-guide-grid');
  const count = document.getElementById('guide-count');
  const search = document.getElementById('guide-search');
  const floor = document.getElementById('guide-floor');
  const status = document.getElementById('guide-status');
  let stations = [], references = [];
  const key = value => String(value || '').normalize('NFKC').toLowerCase();
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function safeLink(url) { try { return new URL(url).protocol === 'https:'; } catch { return false; } }
  function render() {
    const query = key(search.value.trim());
    const found = stations.filter(station => {
      const ready = station.machineIds.some(id => GymMachineData.get(id)?.exerciseIds.length);
      return (!query || key(station.english + ' ' + station.japanese + ' ' + (station.aliases || []).join(' ')).includes(query)) &&
        (floor.value === 'all' || station.images.includes(floor.value)) &&
        (status.value === 'all' || (status.value === 'ready' ? ready && !station.needsConfirmation : station.needsConfirmation));
    });
    count.textContent = found.length + ' equipment labels · ' + references.length + ' picture references';
    grid.replaceChildren();
    if (!found.length) { grid.append(element('p', 'empty-reference', 'No equipment matches. Try another English or Japanese name.')); return; }
    for (const station of found) {
      const reference = references.find(item => item.id === station.referenceId);
      const extraReferences = (station.additionalReferenceIds || []).map(id => references.find(item => item.id === id)).filter(Boolean);
      const card = element('article', 'machine-reference-card');
      const picture = element('figure', 'machine-reference-picture');
      if (reference?.localPath || reference?.imageUrl) {
        if (extraReferences.length) picture.classList.add('reference-pair');
        for (const photo of [reference, ...extraReferences]) {
          const img = element('img');
          img.src = photo.localPath || photo.imageUrl;
          img.alt = photo.title + ' — manufacturer example';
          img.loading = 'lazy'; img.decoding = 'async';
          img.addEventListener('error', () => {
            img.remove(); picture.prepend(element('p', 'picture-unavailable', 'Open the manufacturer reference to see this machine.'));
          }, { once: true });
          picture.append(img);
        }
        picture.append(element('figcaption', '', station.needsConfirmation ? 'Possible type · confirm your model' : 'Example model'));
      } else {
        picture.append(element('p', 'picture-unavailable', 'The floor-plan label does not identify a machine model.'));
      }
      const body = element('div', 'reference-body');
      body.append(element('p', 'japanese-label', station.japanese), element('h2', '', station.english));
      const usable = station.machineIds.map(id => GymMachineData.get(id)).filter(item => item?.exerciseIds.length);
      body.append(element('span', 'reference-state' + (station.needsConfirmation ? ' confirm' : ''), station.needsConfirmation ? 'Confirm the actual station' : 'Exercises available'));
      if (station.note) body.append(element('p', 'reference-description', station.note));
      for (const photo of [reference, ...extraReferences].filter(Boolean)) {
        const credit = element('p', 'reference-credit', 'Photo: ' + photo.manufacturer + '. ');
        if (safeLink(photo.sourceUrl)) {
          const link = element('a', '', extraReferences.length ? photo.title : 'Manufacturer reference'); link.href = photo.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; credit.append(link);
        }
        body.append(credit);
      }
      const actions = element('div', 'reference-actions');
      // An unresolved name never links to an assumed exercise or model.
      if (!station.needsConfirmation) for (const machine of usable) {
        const link = element('a', '', usable.length > 1 ? machine.name : 'View matching exercises');
        link.href = 'index.html?machine=' + encodeURIComponent(machine.id) + '#exercises'; actions.append(link);
      }
      if (reference && safeLink(reference.sourceUrl) && !actions.children.length) {
        const link = element('a', 'secondary', 'See equipment example'); link.href = reference.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; actions.append(link);
      }
      body.append(actions); card.append(picture, body); grid.append(card);
    }
  }
  document.querySelector('.guide-controls').addEventListener('submit', event => event.preventDefault());
  search.addEventListener('input', render); floor.addEventListener('change', render); status.addEventListener('change', render);
  Promise.all([fetch('gym-floor-stations.json').then(r => { if (!r.ok) throw Error('Station reference unavailable'); return r.json(); }), fetch('machine-photo-references.json').then(r => { if (!r.ok) throw Error('Photo reference unavailable'); return r.json(); })]).then(([stationData, photoData]) => {
    stations = stationData.stations || stationData; references = photoData.references || photoData;
    if (!Array.isArray(stations) || !Array.isArray(references)) throw Error('Invalid machine references');
    render();
  }).catch(() => { count.textContent = 'Machine pictures could not load.'; grid.append(element('p', 'empty-reference', 'Reload this page to try again.')); });
})();
