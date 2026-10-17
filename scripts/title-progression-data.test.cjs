'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const titles = require('../dist/title-progression-data.js');
const {TITLE_LIST, TITLE_COUNT, build} = titles;

assert.equal(TITLE_COUNT, 40);
assert.equal(TITLE_LIST.length, TITLE_COUNT);
assert.equal(TITLE_LIST[0].name, 'Rookie');
assert.equal(TITLE_LIST[0].xp, 0);
assert.equal(TITLE_LIST.at(-1).name, 'Gym Stone Legend');
assert.ok(TITLE_LIST.at(-1).xp >= 150000 && TITLE_LIST.at(-1).xp <= 250000);
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
}

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
assert.ok(TITLE_LIST.every(Object.isFrozen));
assert.ok(Object.isFrozen(frozenResult));
assert.ok(Object.isFrozen(frozenResult.earned));
assert.throws(() => { TITLE_LIST.push({}); }, TypeError);
assert.throws(() => { TITLE_LIST[0].xp = 999; }, TypeError);
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
assert.equal(JSON.stringify(browser.build(175)), JSON.stringify(build(175)));
assert.equal(browser.build(Infinity).xp, 0);
assert.ok(Object.isFrozen(browser));
assert.ok(Object.isFrozen(browser.build(175).earned));
console.log('PASS: 40 unique immutable titles, strictly increasing XP gaps, every boundary, Daily Trio progress, numeric normalization, final rank, deterministic results and browser/CommonJS exports.');
