'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const data = require('../dist/daily-quest-data.js');
const appSource = fs.readFileSync(path.join(__dirname, '../dist/app.js'), 'utf8');
const questSource = fs.readFileSync(path.join(__dirname, '../dist/daily-quests.js'), 'utf8');

// Execute the shipped functions with narrow dependencies, without booting the UI.
function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Missing actual function: ' + name);
  let depth = 0, quote = null, escaped = false;
  for (let index = source.indexOf('{', start); index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
    } else if (['"', "'", '`'].includes(character)) quote = character;
    else if (character === '{') depth++;
    else if (character === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error('Unterminated actual function: ' + name);
}
const dateKeySource = appSource.match(/dateKey=d=>[^;]+/);
assert(dateKeySource, 'Missing actual dateKey helper');

function calendarHarness(start, screen = 'today', selection = null) {
  const NativeDate = Date, offset = 9 * 60 * 60 * 1000;
  let now = NativeDate.parse(start), serial = 0, renders = 0;
  const timers = new Map(), cleared = [];
  // A real timestamp with fixed UTC+09 local methods makes the tests independent
  // of the machine's timezone. The functions under test still use local Dates.
  class LocalDate extends NativeDate {
    constructor(...args) {
      super(args.length === 0 ? now : args.length === 1 ? args[0] : NativeDate.UTC(args[0], args[1], args[2] ?? 1, args[3] ?? 0, args[4] ?? 0, args[5] ?? 0, args[6] ?? 0) - offset);
    }
    static now() { return now; }
    getFullYear() { return new NativeDate(this.getTime() + offset).getUTCFullYear(); }
    getMonth() { return new NativeDate(this.getTime() + offset).getUTCMonth(); }
    getDate() { return new NativeDate(this.getTime() + offset).getUTCDate(); }
    setHours(hours, minutes, seconds, milliseconds) {
      const local = new NativeDate(this.getTime() + offset);
      return this.setTime(NativeDate.UTC(this.getFullYear(), this.getMonth(), this.getDate(), hours, minutes ?? local.getUTCMinutes(), seconds ?? local.getUTCSeconds(), milliseconds ?? local.getUTCMilliseconds()) - offset);
    }
  }
  const context = vm.createContext({
    Date: LocalDate,
    document: {body:{dataset:{screen}}},
    render: () => renders++,
    setTimeout: (callback, delay) => { const id = ++serial; timers.set(id, {callback, delay}); return id; },
    clearTimeout: id => { cleared.push(id); timers.delete(id); }
  });
  vm.runInContext(`const ${dateKeySource[0]}; var today=dateKey(new Date()), selected=today, view=new Date(new Date().getFullYear(),new Date().getMonth(),1);\n${extractFunction(appSource,'refreshCurrentDay')}\n${extractFunction(appSource,'scheduleDailyRollover')}`, context);
  if (selection) context.selected = selection;
  return {
    context, timers, cleared,
    setNow: timestamp => { now = NativeDate.parse(timestamp); },
    renders: () => renders,
    fire: () => {
      assert.equal(timers.size, 1, 'Exactly one rollover timer should be active');
      const [id, timer] = [...timers][0];
      timers.delete(id); now += timer.delay; timer.callback();
    }
  };
}

{
  const h = calendarHarness('2026-10-17T23:59:59.900+09:00');
  assert.equal(h.context.refreshCurrentDay(), false);
  h.setNow('2026-10-18T00:00:00.250+09:00');
  assert.equal(h.context.refreshCurrentDay(), true);
  assert.equal(h.context.today, '2026-10-18', 'The local day changes while the UTC date is still October 17');
  assert.equal(h.context.selected, '2026-10-18');
  assert.equal(h.context.refreshCurrentDay(), false, 'Repeated render calls should not report a second rollover');
}
for (const [screen, selection] of [['calendar', null], ['today', '2026-10-15']]) {
  const h = calendarHarness('2026-10-17T23:59:59.900+09:00', screen, selection);
  const selected = h.context.selected, view = h.context.view;
  h.setNow('2026-10-18T00:00:00.250+09:00');
  assert.equal(h.context.refreshCurrentDay(), true);
  assert.equal(h.context.today, '2026-10-18');
  assert.equal(h.context.selected, selected, 'Calendar browsing and past-day selection must stay in place');
  assert.equal(h.context.view, view, 'Browsing must not jump to a new calendar month');
}
{
  const h = calendarHarness('2026-10-31T23:59:59.900+09:00');
  h.context.scheduleDailyRollover();
  assert.equal([...h.timers.values()][0].delay, 350, 'Rollover runs 250ms after the next local midnight');
  const firstId = h.context.scheduleDailyRollover.timer;
  h.context.scheduleDailyRollover();
  assert.equal(h.timers.size, 1, 'Rescheduling must replace the old timer');
  assert(h.cleared.includes(firstId));
  h.fire();
  assert.equal(h.context.today, '2026-11-01');
  assert.equal(h.context.selected, '2026-11-01');
  assert.equal(h.context.view.getFullYear(), 2026);
  assert.equal(h.context.view.getMonth(), 10);
  assert.equal(h.context.view.getDate(), 1);
  assert.equal(h.renders(), 1);
  assert.equal([...h.timers.values()][0].delay, 86400000, 'The callback schedules the following local midnight');
  h.fire();
  assert.equal(h.context.today, '2026-11-02');
  assert.equal(h.renders(), 2);
}
{
  const h = calendarHarness('2026-10-17T14:30:00.000+09:00');
  h.context.scheduleDailyRollover();
  assert.equal([...h.timers.values()][0].delay, 34200250, 'The timer delay uses upcoming local midnight, not UTC midnight');
}
{
  const h = calendarHarness('2026-10-31T23:59:59.900+09:00', 'calendar');
  const view = h.context.view;
  h.context.scheduleDailyRollover(); h.fire();
  assert.equal(h.context.today, '2026-11-01');
  assert.equal(h.context.selected, '2026-10-31');
  assert.equal(h.context.view, view);
  assert.equal(h.renders(), 1, 'Calendar still rerenders its current-day marker');
}

const day = '2026-10-17';
const catalog = ['Squat','Push Up','Row','Plank'].map((name, index) => ({id:String(index), name}));
function snapshot(completed, planned = 0) {
  const records = {[day]:catalog.slice(0, completed + planned).map((exercise, index) => ({id:exercise.id, done:index < completed}))};
  return data.build(records, record => catalog.find(exercise => exercise.id === record.id), {through:day});
}
const two = snapshot(2), three = snapshot(3), four = snapshot(4), planned = snapshot(0, 3);
function announcementHarness() {
  const messages = [], callbacks = [];
  const context = vm.createContext({
    window: {GymCloud:{user:{id:'alice'}}, setTimeout:(callback, delay) => { assert.equal(delay,0); callbacks.push(callback); }},
    announced: new Set(), accountGeneration:1, questSnapshot:three,
    notify: message => messages.push(message)
  });
  vm.runInContext(extractFunction(questSource,'announce'), context);
  return {context, messages, callbacks, flush:() => { while (callbacks.length) callbacks.shift()(); }};
}
{
  const h = announcementHarness();
  h.context.announce(two, three, day, three);
  assert.equal(h.callbacks.length, 1);
  assert.equal(h.messages.length, 0, 'Celebration waits for the deferred notification callback');
  h.flush();
  assert.deepEqual(h.messages, ['Daily Trio complete! +100 bonus XP · Badge earned']);
  h.context.announce(two, three, day, three);
  h.context.announce(three, four, day, four);
  h.context.questSnapshot = two;
  h.context.announce(three, two, day, two);
  h.context.questSnapshot = three;
  h.context.announce(two, three, day, three);
  h.flush();
  assert.equal(h.messages.length, 1, 'A fourth exercise and undo/redo cannot repeat an announced reward');
  assert.equal(three.bonusXP, 100, 'Announcing must not add a second balance');
  assert.equal(h.context.announced.size, 1);
}
{
  const h = announcementHarness();
  h.context.questSnapshot = two;
  h.context.announce(two, three, day, two);
  assert.equal(h.callbacks.length, 0, 'Undo before a save resolves must suppress that stale milestone');
  h.context.questSnapshot = three;
  h.context.announce(two, three, day, three);
  h.context.questSnapshot = two;
  h.flush();
  assert.equal(h.messages.length, 0, 'Undo before the deferred announcement flushes must suppress celebration');
  assert.equal(h.context.announced.size, 0, 'A canceled celebration should not consume the announcement');
  h.context.questSnapshot = three;
  h.context.announce(two, three, day, three); h.flush();
  assert.equal(h.messages.length, 1, 'The next valid completion can still be announced once');
}
for (const change of ['owner', 'generation']) {
  const h = announcementHarness();
  h.context.announce(two, three, day, three);
  if (change === 'owner') h.context.window.GymCloud.user.id = 'bob';
  else h.context.accountGeneration++;
  h.flush();
  assert.equal(h.messages.length, 0, 'An account change before flush must suppress the prior account celebration: ' + change);
  assert.equal(h.context.announced.size, 0);
  h.context.announce(two, three, day, three); h.flush();
  assert.equal(h.messages.length, 1, 'The active account can receive its own valid reward');
}
{
  const h = announcementHarness();
  h.context.questSnapshot = planned;
  h.context.announce(snapshot(0), planned, day, planned);
  h.context.announce(two, three, day, planned);
  h.context.announce(three, three, day, three);
  h.context.announce(two, three, '2026-10-16', three);
  h.flush();
  assert.equal(h.messages.length, 0, 'Plans, absent current completion, existing rewards and another saved day cannot announce a new milestone');
  assert.equal(h.context.announced.size, 0);
}
console.log('PASS: actual local-midnight rollover and timers, month boundaries, preserved browsing, deferred reward once, undo/save races, account guards, and planned/incomplete milestone suppression.');
