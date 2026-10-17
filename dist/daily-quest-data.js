/* Daily Trio rewards are derived from the current owner's completed calendar.
   No claim state is saved: undoing, deleting or editing a log recalculates it. */
(() => {
  'use strict';
  const TARGET = 3, BONUS_XP = 100, BADGE_NAME = 'Daily Trio';
  const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  function validDay(day) {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const date = new Date(day + 'T00:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
  }
  function localToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  /* build(records, resolve, {through})
     records: { 'YYYY-MM-DD': [record, ...] } for one owner only.
     resolve(record): catalog exercise, or a custom {id, name, group}, or null.
     A record with its own nonempty name is a custom/imported activity; its
     generated record ID is not an exercise identity. Catalog rows use the
     resolved exercise ID. Exact normalized names join custom and catalog logs.
     through is the inclusive as-of calendar day (default: local today).
     byDay contains valid calendar keys from records through that day; completed
     is the number of distinct done exercises, not sets. earnedDays is sorted.
     badge is the earned badge name or null; name identifies the quest always.
     Inputs and resolved exercises are never changed. */
  function build(records, resolve, options = {}) {
    const through = validDay(options.through) ? options.through : localToday();
    const byDay = {}, earnedDays = [], days = [];
    const names = new Map();
    for (const day of Object.keys(records || {}).filter(day => validDay(day) && day <= through).sort()) {
      const entries = [];
      for (const record of Array.isArray(records[day]) ? records[day] : []) {
        if (!record || typeof record !== 'object' || record.done !== true || record.recovery) continue;
        const exercise = typeof resolve === 'function' ? resolve(record) : null;
        if (exercise?.recovery) continue;
        const customName = normalize(record.name);
        const name = customName || normalize(exercise?.name);
        if (!name) continue;
        const catalogId = !customName && exercise?.id != null && String(exercise.id).trim() ? String(exercise.id) : null;
        if (!customName && !catalogId) continue;
        entries.push({name, catalogId});
        if (catalogId) {
          if (!names.has(name)) names.set(name, catalogId);
          else if (names.get(name) !== catalogId) names.set(name, null);
        }
      }
      days.push({day, entries});
    }
    for (const {day, entries} of days) {
      const distinct = new Set(entries.map(({name, catalogId}) => {
        const id = catalogId || names.get(name);
        return id ? 'exercise:' + id : 'activity:' + name;
      }));
      const completed = distinct.size, earned = completed >= TARGET;
      const result = {day, name: BADGE_NAME, completed, target: TARGET, earned, bonusXP: earned ? BONUS_XP : 0, badge: earned ? BADGE_NAME : null};
      byDay[day] = result;
      if (earned) earnedDays.push(result);
    }
    return {byDay, earnedDays, bonusXP: earnedDays.length * BONUS_XP, through};
  }
  const api = {build, normalize, validDay, TARGET, BONUS_XP, BADGE_NAME};
  if (typeof window !== 'undefined') window.GymDailyQuestData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
