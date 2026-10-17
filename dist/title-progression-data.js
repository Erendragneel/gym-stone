/* Titles use earned lifetime XP. Each new title requires a larger XP step.
   Numeric levels are handled separately by the app. Nothing is saved here. */
(() => {
  'use strict';
  const names = [
    "Rookie",
    "First Rep",
    "Trail Starter",
    "Foundation Builder",
    "Habit Starter",
    "Routine Keeper",
    "Session Scout",
    "Momentum Maker",
    "Daily Pathfinder",
    "Stone Seeker",
    "Trail Walker",
    "Rep Tracker",
    "Rhythm Keeper",
    "Challenge Chaser",
    "Rep Ranger",
    "Routine Builder",
    "Iron Explorer",
    "Trail Navigator",
    "Stone Pathfinder",
    "Training Adept",
    "Quest Scout",
    "Endurance Scout",
    "Progress Keeper",
    "Iron Trailblazer",
    "Stone Climber",
    "Habit Navigator",
    "Quest Keeper",
    "Routine Ranger",
    "Training Vanguard",
    "Summit Seeker",
    "Iron Sentinel",
    "Stone Sentinel",
    "Milestone Maker",
    "Trail Steward",
    "Routine Champion",
    "Summit Scout",
    "Trail Champion",
    "Summit Strider",
    "Iron Guardian",
    "Stone Guardian",
    "Quest Champion",
    "Peak Pathfinder",
    "Iron Captain",
    "Stone Captain",
    "Training Marshal",
    "Summit Guardian",
    "Iron Warden",
    "Stone Warden",
    "Expedition Leader",
    "Routine Architect",
    "Trail Architect",
    "Quest Strategist",
    "Stone Strategist",
    "Summit Navigator",
    "Iron Wayfinder",
    "Stone Wayfinder",
    "Quest Vanguard",
    "Peak Vanguard",
    "Iron Steward",
    "Stone Steward",
    "Training Sage",
    "Routine Sage",
    "Trail Sage",
    "Quest Sage",
    "Summit Sage",
    "Iron Scholar",
    "Stone Scholar",
    "Path Archivist",
    "Quest Archivist",
    "Summit Archivist",
    "Iron Artisan",
    "Stone Artisan",
    "Routine Artisan",
    "Training Architect",
    "Peak Architect",
    "Quest Marshal",
    "Summit Marshal",
    "Stone Marshal",
    "Quest Master",
    "Summit Master",
    "Iron Master",
    "Stone Master",
    "Trail Master",
    "Routine Master",
    "Iron Luminary",
    "Stone Luminary",
    "Quest Luminary",
    "Summit Luminary",
    "Iron Beacon",
    "Stone Beacon",
    "Trail Beacon",
    "Summit Beacon",
    "Quest Legend",
    "Trail Legend",
    "Iron Legend",
    "Stone Legend",
    "Peak Legend",
    "Summit Legend",
    "Eternal Pathfinder",
    "Gym Stone Legend"
  ];
  // Each promotion costs more XP. The first three keep the original milestones.
  const TITLE_LIST = Object.freeze(names.reduce((list, name, index) => {
    const gap = index === 0 ? 0 : index <= 3 ? index * 100 : 25 * (index + 9 + Math.floor((index - 3) / 2));
    const xp = (index ? list[index - 1].xp : 0) + gap;
    list.push(Object.freeze({
      id: name.toLowerCase().replace(/\s+/g, '-'), rank: index + 1, name, xp
    }));
    return list;
  }, []));
  const TITLE_COUNT = TITLE_LIST.length;
  // A reference pace for an approximately three-year journey, not an XP limit.
  const pace = {
    targetYears: 3, targetWeeks: 156,
    sessionsPerWeek: 5, movesPerSession: 6, personalBestsPerWeek: 1,
    moveXP: 25, dailyTrioXP: 100, personalBestXP: 50
  };
  const PACING = Object.freeze({
    ...pace,
    weeklyXP: pace.sessionsPerWeek * (pace.movesPerSession * pace.moveXP + pace.dailyTrioXP) + pace.personalBestsPerWeek * pace.personalBestXP,
    finalXP: TITLE_LIST[TITLE_COUNT - 1].xp
  });

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
  const api = Object.freeze({build, TITLE_LIST, TITLE_COUNT, PACING});
  if (typeof window !== 'undefined') window.GymTitleProgressionData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
