/* Titles use earned lifetime XP. Each new title requires a larger XP step.
   Numeric levels are handled separately by the app. Nothing is saved here. */
(() => {
  'use strict';
  const titles = [
    ['Rookie', 0],
    ['First Rep', 100],
    ['Trail Starter', 300],
    ['Foundation Builder', 600],
    ['Routine Keeper', 1025],
    ['Momentum Maker', 1600],
    ['Stone Seeker', 2325],
    ['Trail Walker', 3200],
    ['Challenge Chaser', 4225],
    ['Rep Ranger', 5425],
    ['Iron Explorer', 6825],
    ['Stone Pathfinder', 8425],
    ['Training Adept', 10225],
    ['Endurance Scout', 12225],
    ['Iron Trailblazer', 14450],
    ['Stone Climber', 16925],
    ['Quest Keeper', 19650],
    ['Training Vanguard', 22625],
    ['Summit Seeker', 25850],
    ['Iron Sentinel', 29350],
    ['Stone Sentinel', 33150],
    ['Routine Champion', 37250],
    ['Trail Champion', 41650],
    ['Summit Strider', 46350],
    ['Iron Guardian', 51375],
    ['Stone Guardian', 56750],
    ['Quest Champion', 62475],
    ['Peak Pathfinder', 68550],
    ['Iron Captain', 74975],
    ['Stone Captain', 81775],
    ['Training Marshal', 88975],
    ['Summit Guardian', 96575],
    ['Iron Warden', 104575],
    ['Stone Warden', 112975],
    ['Quest Master', 121800],
    ['Summit Master', 131075],
    ['Iron Luminary', 140800],
    ['Stone Luminary', 150975],
    ['Peak Legend', 161600],
    ['Gym Stone Legend', 172700]
  ];
  const TITLE_LIST = Object.freeze(titles.map(([name, xp], index) => Object.freeze({
    id: name.toLowerCase().replace(/\s+/g, '-'), rank: index + 1, name, xp
  })));
  const TITLE_COUNT = TITLE_LIST.length;

  /* build(xp): xp must be a finite number; invalid and negative values become 0.
     current/next are entries from TITLE_LIST; earned includes the current title.
     progress is the percentage between current and next, not overall XP.
     At the last title, next is null, progress is 100 and span/remaining are 0.
     All returned objects and arrays are immutable. */
  function build(value) {
    const xp = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    let index = 0;
    while (index + 1 < TITLE_COUNT && xp >= TITLE_LIST[index + 1].xp) index++;
    const current = TITLE_LIST[index], next = TITLE_LIST[index + 1] || null;
    const intoTitle = xp - current.xp;
    const span = next ? next.xp - current.xp : 0;
    return Object.freeze({
      xp, current, next,
      remaining: next ? next.xp - xp : 0,
      earned: Object.freeze(TITLE_LIST.slice(0, index + 1)),
      progress: next ? Math.min(100, Math.max(0, intoTitle / span * 100)) : 100,
      intoTitle, span
    });
  }
  const api = Object.freeze({build, TITLE_LIST, TITLE_COUNT});
  if (typeof window !== 'undefined') window.GymTitleProgressionData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
