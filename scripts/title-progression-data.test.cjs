'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const titles = require('../dist/title-progression-data.js');
const {TITLE_LIST, TITLE_COUNT, PACING, build} = titles;

assert.equal(TITLE_COUNT, 100);
assert.equal(TITLE_LIST.length, TITLE_COUNT);
assert.equal(TITLE_LIST[0].name, 'Rookie');
assert.equal(TITLE_LIST[0].xp, 0);
assert.equal(TITLE_LIST.at(-1).name, 'Gym Stone Legend');
assert.equal(TITLE_LIST.at(-1).xp, 203400);
assert.deepEqual(TITLE_LIST.slice(0, 4).map(title => title.xp), [0, 100, 300, 600]);
assert.equal(new Set(TITLE_LIST.map(title => title.id)).size, TITLE_COUNT);
assert.equal(new Set(TITLE_LIST.map(title => title.name.toLowerCase())).size, TITLE_COUNT);
let previousGap = 0;
for (let index = 0; index < TITLE_COUNT; index++) {
  const title = TITLE_LIST[index];
  assert.equal(title.rank, index + 1);
  assert.match(title.id, /^[a-z]+(?:-[a-z]+)*$/);
  assert.equal(title.xp % 25, 0);
  if (index) {
    const gap = title.xp - TITLE_LIST[index - 1].xp;
    assert.equal(gap % 25, 0);
    assert.ok(gap > previousGap, `Gap at ${title.name} must exceed the previous gap`);
    previousGap = gap;
    const below = build(title.xp - 1);
    assert.equal(below.current, TITLE_LIST[index - 1]);
    assert.equal(below.next, title);
    assert.equal(below.remaining, 1);
    assert.equal(below.earned.length, index);
    assert.ok(below.progress < 100 && below.progress >= 0);
  }
  const exact = build(title.xp);
  assert.equal(exact.xp, title.xp);
  assert.equal(exact.current, title);
  assert.equal(exact.next, TITLE_LIST[index + 1] || null);
  assert.deepEqual(exact.earned, TITLE_LIST.slice(0, index + 1));
  assert.equal(exact.intoTitle, 0);
  assert.equal(exact.progress, index === TITLE_COUNT - 1 ? 100 : 0);
  assert.equal(exact.remaining, exact.next ? exact.next.xp - title.xp : 0);
  assert.equal(exact.span, exact.remaining);
  const above = build(title.xp + 1);
  assert.equal(above.current, title);
  assert.equal(above.next, TITLE_LIST[index + 1] || null);
  assert.equal(above.intoTitle, 1);
  assert.equal(above.earned.length, index + 1);
  assert.equal(above.remaining, above.next ? above.next.xp - title.xp - 1 : 0);
  assert.equal(above.span, exact.span);
  assert.ok(Math.abs(above.progress - (above.next ? 100 / exact.span : 100)) < 1e-12);
}

assert.deepEqual(PACING, {
  targetYears: 3, targetWeeks: 156,
  sessionsPerWeek: 5, movesPerSession: 6, personalBestsPerWeek: 1,
  moveXP: 25, dailyTrioXP: 100, personalBestXP: 50,
  weeklyXP: 1300, finalXP: 203400
});
assert.equal(PACING.targetWeeks, PACING.targetYears * 52);
assert.equal(PACING.weeklyXP,
  PACING.sessionsPerWeek * (PACING.movesPerSession * PACING.moveXP + PACING.dailyTrioXP)
  + PACING.personalBestsPerWeek * PACING.personalBestXP);
assert.equal(PACING.finalXP, TITLE_LIST.at(-1).xp);
assert.ok(PACING.finalXP / PACING.weeklyXP > 156);
assert.ok(PACING.finalXP / PACING.weeklyXP < 157);
assert.equal(build(52 * PACING.weeklyXP).current.rank, 56);
assert.equal(build(104 * PACING.weeklyXP).current.rank, 80);
assert.equal(build(156 * PACING.weeklyXP).current.rank, 99);
assert.equal(build(157 * PACING.weeklyXP).current.rank, 100);
// Titles depend only on earned XP. Rest days and missing weeks cannot reset them.
const earnedBeforeRest = 52 * PACING.weeklyXP;
let retainedXP = earnedBeforeRest;
const restWeekProgress = [0, 0, PACING.weeklyXP].map(weekXP => build(retainedXP += weekXP));
assert.equal(restWeekProgress[0].xp, earnedBeforeRest);
assert.equal(restWeekProgress[0].current.rank, 56);
assert.deepEqual(restWeekProgress[1], restWeekProgress[0]);
assert.equal(restWeekProgress[2].xp, earnedBeforeRest + PACING.weeklyXP);
assert.ok(restWeekProgress[2].progress > restWeekProgress[1].progress);
const afterThreeYearsWithMissedWeek = (156 - 1) * PACING.weeklyXP;
assert.equal(build(afterThreeYearsWithMissedWeek).current.rank, 99);
assert.equal(build(afterThreeYearsWithMissedWeek).xp, afterThreeYearsWithMissedWeek);
assert.equal(build(afterThreeYearsWithMissedWeek + PACING.weeklyXP).xp,
  afterThreeYearsWithMissedWeek + PACING.weeklyXP);

const earlyReward = build(175);
assert.equal(earlyReward.current.name, 'First Rep');
assert.equal(earlyReward.next.name, 'Trail Starter');
assert.equal(earlyReward.remaining, 125);
assert.equal(earlyReward.intoTitle, 75);
assert.equal(earlyReward.span, 200);
assert.equal(earlyReward.progress, 37.5);
assert.equal(build(299.99).xp, 299);
assert.equal(build(300.99).current.name, 'Trail Starter');

const invalid = [undefined, null, '', '175', false, true, NaN, Infinity, -Infinity, -1, -0.1, {}, [], Symbol('xp'), 175n];
for (const value of invalid) {
  const result = build(value);
  assert.equal(result.xp, 0);
  assert.equal(result.current, TITLE_LIST[0]);
  assert.equal(result.remaining, TITLE_LIST[1].xp);
  assert.equal(result.progress, 0);
}
assert.equal(Object.is(build(-0).xp, -0), false);
for (const xp of [TITLE_LIST.at(-1).xp, TITLE_LIST.at(-1).xp + 1, Number.MAX_SAFE_INTEGER, Number.MAX_VALUE]) {
  const result = build(xp);
  assert.equal(result.current, TITLE_LIST.at(-1));
  assert.equal(result.next, null);
  assert.equal(result.remaining, 0);
  assert.equal(result.span, 0);
  assert.equal(result.progress, 100);
  assert.equal(result.earned.length, TITLE_COUNT);
  assert.equal(result.intoTitle, xp - TITLE_LIST.at(-1).xp);
}

const before = JSON.stringify(TITLE_LIST);
const frozenResult = build(175);
assert.ok(Object.isFrozen(titles));
assert.ok(Object.isFrozen(TITLE_LIST));
assert.ok(Object.isFrozen(PACING));
assert.ok(TITLE_LIST.every(Object.isFrozen));
assert.ok(Object.isFrozen(frozenResult));
assert.ok(Object.isFrozen(frozenResult.earned));
assert.throws(() => { TITLE_LIST.push({}); }, TypeError);
assert.throws(() => { TITLE_LIST[0].xp = 999; }, TypeError);
assert.throws(() => { PACING.weeklyXP = 999; }, TypeError);
assert.throws(() => { frozenResult.xp = 999; }, TypeError);
assert.throws(() => { frozenResult.earned.pop(); }, TypeError);
assert.equal(JSON.stringify(TITLE_LIST), before);
assert.deepEqual(build(175), build(175));
assert.notEqual(build(175), frozenResult);

const scope = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/title-progression-data.js'), 'utf8'), scope);
const browser = scope.window.GymTitleProgressionData;
assert.equal(browser.TITLE_COUNT, TITLE_COUNT);
assert.equal(JSON.stringify(browser.TITLE_LIST), before);
assert.equal(JSON.stringify(browser.PACING), JSON.stringify(PACING));
assert.equal(JSON.stringify(browser.build(175)), JSON.stringify(build(175)));
assert.equal(browser.build(Infinity).xp, 0);
assert.ok(Object.isFrozen(browser));
assert.ok(Object.isFrozen(browser.PACING));
assert.ok(Object.isFrozen(browser.build(175).earned));
console.log('PASS: 100 unique immutable titles, every boundary above/below, increasing 25-XP gaps, 203400-XP cap, three-year reference pace, year milestones, rest-day preservation, numeric normalization and browser/CommonJS exports.');
