/* Daily rewards follow the saved calendar; there is no separate claim balance. */
(() => {
  'use strict';
  const data = window.GymDailyQuestData;
  const star = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"></path></svg>';
  const card = document.createElement('section');
  card.className = 'daily-quest';
  card.id = 'daily-quest';
  card.setAttribute('aria-labelledby', 'daily-quest-title');
  card.innerHTML = `<div class="daily-quest-heading"><span class="daily-quest-icon">${star}</span><div class="daily-quest-copy"><h3 id="daily-quest-title">Daily Trio <span id="daily-quest-count">0 / 3</span></h3><p id="daily-quest-message" role="status" aria-live="polite" aria-atomic="true">Complete 3 different exercises</p></div><span id="daily-quest-reward" class="daily-quest-reward">+100 XP</span></div><div id="daily-quest-progress" class="daily-quest-progress" role="progressbar" aria-label="Daily Trio quest" aria-valuemin="0" aria-valuemax="3" aria-valuenow="0"><i></i><i></i><i></i></div>`;
  document.querySelector('.daily-actions').after(card);
  const history = document.createElement('section');
  history.className = 'quest-rewards';
  history.setAttribute('aria-labelledby', 'quest-rewards-title');
  history.innerHTML = '<div class="quest-rewards-heading"><div><span class="eyebrow">YOUR DAILY REWARDS</span><h2 id="quest-rewards-title">Daily Trio badges</h2></div><span id="quest-rewards-total"></span></div><p id="quest-rewards-rule"></p><div id="quest-rewards-list" class="quest-rewards-list"></div>';
  document.querySelector('.activity').append(history);
  const get = id => document.getElementById(id);
  const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const date = day => new Date(day + 'T12:00:00').toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'});
  const announced = new Set();
  function render(snapshot, selected, today) {
    const quest = snapshot.byDay[selected];
    const completed = Math.min(data.TARGET, quest?.completed || 0), earned = !!quest?.earned;
    card.classList.toggle('earned', earned);
    text(get('daily-quest-count'), completed + ' / ' + data.TARGET);
    text(get('daily-quest-message'), earned ? 'Badge earned · Bonus included in your XP' : selected > today ? 'Opens on this day · Plan your 3 exercises' : 'Complete 3 different exercises');
    text(get('daily-quest-reward'), earned ? '✓ +100 XP' : '+100 XP');
    const progress = get('daily-quest-progress');
    progress.setAttribute('aria-valuenow', String(completed));
    progress.setAttribute('aria-valuetext', completed + ' of ' + data.TARGET + ' different exercises completed' + (earned ? '; Daily Trio badge and 100 bonus XP earned' : ''));
    [...progress.children].forEach((segment, index) => segment.classList.toggle('complete', index < completed));
    const through = selected < today ? selected : today;
    const rewards = snapshot.earnedDays.filter(reward => reward.day <= through);
    text(get('quest-rewards-total'), rewards.length + (rewards.length === 1 ? ' badge' : ' badges') + ' · +' + rewards.length * data.BONUS_XP + ' XP');
    text(get('quest-rewards-rule'), 'Complete 3 different exercises in one day for +100 bonus XP and a badge. One reward per day, through ' + date(through) + '.');
    const list = get('quest-rewards-list');
    list.replaceChildren();
    if (!rewards.length) {
      const empty = document.createElement('p');
      empty.className = 'quest-rewards-empty';
      empty.textContent = 'Your first Daily Trio badge will appear here.';
      list.append(empty);
    }
    for (const reward of rewards.slice(-5).reverse()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quest-badge';
      button.setAttribute('aria-label', 'View Daily Trio reward for ' + date(reward.day));
      button.innerHTML = '<span class="quest-badge-icon">' + star + '</span><span><strong>Daily Trio</strong><small></small></span><b>+100 XP</b>';
      button.querySelector('small').textContent = date(reward.day);
      button.onclick = () => { selectDay(reward.day); window.GymNavigation.show('calendar'); };
      list.append(button);
    }
  }
  function announce(previous, next, day = null, current = next) {
    const owner = window.GymCloud?.user?.id || 'guest', generation = accountGeneration;
    const reward = next?.earnedDays.find(item => (!day || item.day === day) && !previous?.byDay[item.day]?.earned && current?.byDay[item.day]?.earned && !announced.has(owner + '|' + item.day));
    if (!reward) return;
    const key = owner + '|' + reward.day;
    announced.add(key);
    window.setTimeout(() => {
      if (generation !== accountGeneration || owner !== (window.GymCloud?.user?.id || 'guest') || !questSnapshot?.byDay[reward.day]?.earned) { announced.delete(key); return; }
      notify('Daily Trio complete! +100 bonus XP · Badge earned');
    }, 0);
  }
  window.addEventListener('gym-account-changed', () => announced.clear());
  window.GymDailyQuests = {render, announce};
  window.render();
})();
