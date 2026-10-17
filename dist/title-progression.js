/* Title progress is derived from the app's XP; this view owns no saved balance. */
(() => {
  'use strict';
  const data = window.GymTitleProgressionData;
  if (!data) return;
  const get = id => document.getElementById(id);
  const number = value => value.toLocaleString();
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const owner = () => window.GymCloud?.user?.id || 'guest';
  const generation = () => typeof accountGeneration === 'number' ? accountGeneration : 0;
  const liveSnapshot = () => typeof titleSnapshot !== 'undefined' ? titleSnapshot : latest;
  let latest = null, dialog = null, browse = null, lifetime = null, pending = null, epoch = 0, returnFocus = null;
  const announced = new Set(), titleRows = [];

  function cancelPending() {
    if (!pending) return;
    clearTimeout(pending.timer);
    announced.delete(pending.key);
    pending = null;
  }

  function progress(node, snapshot) {
    node.setAttribute('role', 'progressbar');
    node.setAttribute('aria-label', snapshot.next ? 'Progress toward ' + snapshot.next.name : 'Title progression');
    node.setAttribute('aria-valuemin', '0');
    node.setAttribute('aria-valuemax', '100');
    node.setAttribute('aria-valuenow', String(Math.round(snapshot.progress * 100) / 100));
    node.setAttribute('aria-valuetext', snapshot.next
      ? number(snapshot.remaining) + ' XP remaining to ' + snapshot.next.name + '; ' + number(snapshot.xp) + ' lifetime XP'
      : 'All ' + data.TITLE_COUNT + ' titles earned; ' + number(snapshot.xp) + ' lifetime XP');
  }

  function close() {
    if (dialog?.open) dialog.close();
  }

  function setup() {
    if (dialog) return true;
    const cardBody = document.querySelector('.level-card > div');
    if (!cardBody || !get('level') || !get('xp-text') || !get('xp-bar')) return false;
    cardBody.classList.add('title-card-body');
    const eyebrow = cardBody.querySelector('.eyebrow');
    if (eyebrow) eyebrow.textContent = 'YOUR TITLE';
    const footer = make('div', null, 'title-card-footer');
    lifetime = make('span', '0 lifetime XP', 'title-lifetime');
    lifetime.id = 'title-lifetime';
    browse = make('button', 'Titles · 1 / ' + data.TITLE_COUNT, 'title-browse');
    browse.id = 'browse-titles';
    browse.type = 'button';
    browse.setAttribute('aria-haspopup', 'dialog');
    browse.setAttribute('aria-controls', 'title-dialog');
    footer.append(lifetime, browse);
    cardBody.append(footer);

    dialog = make('dialog', null, 'title-dialog');
    dialog.id = 'title-dialog';
    dialog.setAttribute('aria-labelledby', 'title-browser-title');
    dialog.setAttribute('aria-describedby', 'title-browser-note');
    const header = make('div', null, 'title-dialog-header');
    const heading = make('div');
    heading.append(make('span', 'EARN YOUR NEXT TITLE', 'eyebrow'));
    const h2 = make('h2', 'Your title journey');
    h2.id = 'title-browser-title';
    heading.append(h2);
    const closeButton = make('button', 'Close', 'secondary title-dialog-close');
    closeButton.id = 'close-titles';
    closeButton.type = 'button';
    closeButton.autofocus = true;
    closeButton.setAttribute('aria-label', 'Close title journey');
    closeButton.onclick = close;
    header.append(heading, closeButton);

    const body = make('div', null, 'title-dialog-body');
    const summary = make('section', null, 'title-journey-summary');
    summary.setAttribute('aria-label', 'Your title progress');
    summary.append(make('span', 'CURRENT TITLE', 'eyebrow'));
    const current = make('strong');
    current.id = 'title-summary-current';
    const total = make('p');
    total.id = 'title-summary-total';
    const track = make('div', null, 'title-summary-track');
    track.id = 'title-summary-progress';
    const bar = make('i');
    bar.setAttribute('aria-hidden', 'true');
    track.append(bar);
    const next = make('p');
    next.id = 'title-summary-next';
    summary.append(current, total, track, next);
    const note = make('p', 'Each new title takes a larger XP step. Titles unlock automatically from your saved workout XP.', 'title-browser-note');
    note.id = 'title-browser-note';
    const list = make('ol', null, 'title-list');
    list.id = 'title-list';
    list.setAttribute('aria-label', 'All ' + data.TITLE_COUNT + ' titles and XP requirements');
    for (const title of data.TITLE_LIST) {
      const row = make('li', null, 'title-list-item');
      row.dataset.title = title.id;
      const rank = make('span', String(title.rank).padStart(2, '0'), 'title-rank');
      rank.setAttribute('aria-hidden', 'true');
      const copy = make('div', null, 'title-list-copy');
      copy.append(make('strong', title.name), make('small', number(title.xp) + ' XP total'));
      const state = make('span', 'Locked', 'title-state');
      row.append(rank, copy, state);
      titleRows.push({title, row, state});
      list.append(row);
    }
    const earning = make('div', null, 'title-xp-rules');
    earning.append(make('h3', 'Every workout moves you forward'));
    const rules = make('ul');
    for (const text of ['Complete a move: +25 XP', 'Beat a personal best: +50 bonus XP', 'Complete Daily Trio: +100 bonus XP']) rules.append(make('li', text));
    earning.append(rules);
    body.append(summary, note, list, earning);
    dialog.append(header, body);
    document.body.append(dialog);
    browse.onclick = () => {
      if (!latest || dialog.open) return;
      updateDialog(latest);
      returnFocus = document.activeElement;
      body.scrollTop = 0;
      dialog.showModal();
    };
    dialog.addEventListener('close', () => {
      const target = returnFocus;
      returnFocus = null;
      if (target?.isConnected && target.getClientRects().length) target.focus({preventScroll: true});
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    });
    return true;
  }

  function updateDialog(snapshot) {
    get('title-summary-current').textContent = snapshot.current.name;
    get('title-summary-total').textContent = number(snapshot.xp) + ' lifetime XP · ' + snapshot.current.rank + ' of ' + data.TITLE_COUNT + ' titles earned';
    get('title-summary-next').textContent = snapshot.next
      ? 'Next: ' + snapshot.next.name + ' · ' + number(snapshot.remaining) + ' XP to go · unlocks at ' + number(snapshot.next.xp) + ' XP total'
      : 'Every title earned! Your numeric level keeps growing with your XP.';
    const track = get('title-summary-progress');
    progress(track, snapshot);
    track.firstElementChild.style.width = snapshot.progress + '%';
    for (const {title, row, state} of titleRows) {
      const status = title.id === snapshot.current.id ? 'Current' : title.rank < snapshot.current.rank ? 'Earned' : title.id === snapshot.next?.id ? 'Next' : 'Locked';
      row.className = 'title-list-item ' + status.toLowerCase();
      row.dataset.state = status.toLowerCase();
      if (status === 'Current') row.setAttribute('aria-current', 'step');
      else row.removeAttribute('aria-current');
      state.textContent = status;
    }
  }

  function render(snapshot, level) {
    if (!snapshot?.current) return;
    latest = snapshot;
    if (pending && (snapshot.current.id !== pending.id || snapshot.xp < pending.xp)) cancelPending();
    if (!setup()) return;
    const numeric = make('small', 'Level ' + String(level).padStart(2, '0'), 'title-numeric-level');
    get('level').replaceChildren(document.createTextNode(snapshot.current.name), numeric);
    get('xp-text').textContent = snapshot.next
      ? number(snapshot.remaining) + ' XP to ' + snapshot.next.name
      : 'All ' + data.TITLE_COUNT + ' titles earned · Keep building your level';
    const bar = get('xp-bar');
    bar.style.width = snapshot.progress + '%';
    bar.setAttribute('aria-hidden', 'true');
    progress(bar.parentElement, snapshot);
    lifetime.textContent = number(snapshot.xp) + ' lifetime XP';
    browse.textContent = 'Titles · ' + snapshot.current.rank + ' / ' + data.TITLE_COUNT;
    browse.setAttribute('aria-label', 'Browse titles: ' + snapshot.current.rank + ' of ' + data.TITLE_COUNT + ' earned. Current title: ' + snapshot.current.name);
    if (dialog.open) updateDialog(snapshot);
  }

  function announce(previous, next, current = next) {
    if (!previous?.current || !next?.current || !current?.current || next.current.rank <= previous.current.rank || current.current.id !== next.current.id || current.xp < next.xp) return false;
    const savedOwner = owner(), savedGeneration = generation(), savedEpoch = epoch, key = savedOwner + '|' + next.current.id;
    if (announced.has(key)) return false;
    cancelPending();
    announced.add(key);
    const notice = {id: next.current.id, xp: next.xp, key, timer: null};
    notice.timer = window.setTimeout(() => {
      if (pending !== notice) return;
      const snapshot = liveSnapshot();
      if (epoch !== savedEpoch || owner() !== savedOwner || generation() !== savedGeneration || !snapshot?.current || snapshot.current.id !== notice.id || snapshot.xp < notice.xp) {
        cancelPending();
        return;
      }
      pending = null;
      const message = 'Title earned: ' + snapshot.current.name + (snapshot.next ? ' · Keep going toward ' + snapshot.next.name : ' · All ' + data.TITLE_COUNT + ' titles earned!');
      if (typeof notify === 'function') notify(message);
    }, 300);
    pending = notice;
    return true;
  }

  function reset() {
    epoch++;
    cancelPending();
    announced.clear();
    latest = null;
    returnFocus = null;
    close();
  }

  window.GymTitles = {render, announce, reset};
  setup();
  const initial = liveSnapshot();
  if (initial?.current) render(initial, Math.floor(initial.xp / 200) + 1);
})();
