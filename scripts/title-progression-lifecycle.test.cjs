'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const titles = require('../dist/title-progression-data.js');
const source = fs.readFileSync(path.join(__dirname, '../dist/app.js'), 'utf8');

// Execute the application functions themselves; leave unrelated page setup out
// of this VM. The next named declaration works with one-line and multiline code.
function extract(name, nextName) {
  const start = new RegExp(`^(?:async )?function ${name}\\(`, 'm').exec(source);
  const next = new RegExp(`^(?:async )?function ${nextName}\\(`, 'm').exec(source);
  assert.ok(start && next && next.index > start.index, `Find app function ${name}`);
  return source.slice(start.index, next.index).trim();
}
const appFunctions = extract('renderStats', 'exerciseAnimation') + '\n' + extract('save', 'recordExercise');
const day = '2026-10-17';
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
function rows(completed, planned = 0) {
  return Array.from({length:completed + planned}, (_, index) => ({id:`move-${index}`, done:index < completed}));
}
function setup() {
  const nodes = new Map(), renders = [], announcements = [], writes = [], events = [], messages = [];
  const gate = deferred();
  function element(id) {
    if (!nodes.has(id)) nodes.set(id, {innerHTML:'', textContent:'', style:{}});
    return nodes.get(id);
  }
  const context = {
    records:{}, progressSnapshot:null, questSnapshot:null, titleSnapshot:null,
    accountGeneration:0, selected:day, today:day, view:new Date(day + 'T12:00:00'), storageOK:true,
    structuredClone, Date, GymTitleProgressionData:titles,
    $:element,
    dateKey:date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    document:{querySelector:element},
    localStorage:{setItem(key, value) { events.push('cache'); writes.push({key, value:JSON.parse(value)}); }},
    workoutCacheKey:() => `gym-stone-v1:player-${context.accountGeneration}`,
    notify:message => messages.push(message),
    GymCalendar:{kick:() => events.push('sync'), status:() => 'Saved'},
    GymScreenshotStore:{async putRecords(records) {
      events.push('persist-start');
      writes.push({records});
      await gate.promise;
      events.push('persist-success');
    }},
    GymTitles:{
      render(snapshot, level) { renders.push({snapshot, level}); },
      announce(previous, next, current) { events.push('announce'); announcements.push({previous, next, current}); }
    }
  };
  context.window = context;
  context.render = () => context.renderStats();
  vm.createContext(context);
  vm.runInContext(appFunctions, context, {filename:'app-title-lifecycle.js'});
  function set(completed, prBonus = 0, questBonus = 0, planned = 0) {
    context.records = {[day]:rows(completed, planned)};
    context.progressSnapshot = prBonus === null ? null : {bonusXP:prBonus};
    context.questSnapshot = questBonus === null ? null : {bonusXP:questBonus};
  }
  return {context, gate, set, renders, announcements, writes, events, messages, nodes};
}

function verifyStats() {
  const harness = setup(), {context, set, renders, nodes} = harness;
  for (const sample of [
    {completed:0, pr:null, quest:null, planned:4, xp:0},
    {completed:3, pr:50, quest:100, planned:2, xp:225},
    {completed:8, pr:100, quest:200, planned:1, xp:500},
    {completed:0, pr:250, quest:100, planned:0, xp:350}
  ]) {
    set(sample.completed, sample.pr, sample.quest, sample.planned);
    // A completed move in another month still contributes to lifetime XP.
    context.records['2026-09-01'] = [{id:'earlier', done:true}];
    const expectedXP = sample.xp + 25;
    context.renderStats();
    assert.deepEqual(context.titleSnapshot, titles.build(expectedXP));
    assert.equal(renders.at(-1).snapshot, context.titleSnapshot);
    assert.equal(renders.at(-1).level, Math.floor(expectedXP / 200) + 1);
    assert.equal(nodes.get('month-workouts').innerHTML, `${sample.completed} <small>moves completed</small>`);
  }
  set(3, 0, 100);
  context.renderStats();
  assert.equal(context.titleSnapshot.xp, 175, 'Daily Trio includes the three completed moves and quest bonus');
  assert.equal(context.titleSnapshot.current.name, 'First Rep');
  assert.equal(renders.at(-1).level, 1, 'Titles do not change the existing 200 XP numeric level cadence');
  delete context.GymTitles;
  assert.doesNotThrow(() => context.renderStats(), 'An optional title UI does not prevent stats calculation');
  assert.equal(context.titleSnapshot.xp, 175);
}

async function verifySavedPromotion() {
  const {context, gate, set, announcements, writes, events, nodes} = setup();
  set(2);
  context.renderStats();
  const previous = context.titleSnapshot;
  set(3, 0, 100);
  const saving = context.save();
  assert.equal(context.titleSnapshot.xp, 175);
  assert.equal(announcements.length, 0, 'No title announcement before durable persistence succeeds');
  assert.deepEqual(events, ['persist-start']);
  assert.equal(nodes.get('.save-label').textContent, '○ Saving…');
  const pendingSnapshot = writes[0].records;
  assert.notEqual(pendingSnapshot, context.records);
  assert.equal(pendingSnapshot[day].length, 3);
  gate.resolve();
  assert.equal(await saving, true);
  assert.equal(announcements.length, 1);
  const announcement = announcements[0];
  assert.equal(announcement.previous, previous);
  assert.equal(announcement.previous.current.name, 'Rookie');
  assert.equal(announcement.next.current.name, 'First Rep');
  assert.equal(announcement.current, context.titleSnapshot);
  assert.ok(events.indexOf('persist-success') < events.indexOf('announce'));
  assert.ok(events.indexOf('cache') < events.indexOf('announce'));
  assert.equal(writes[1].key, 'gym-stone-v1:player-0');
  assert.equal(nodes.get('.save-label').textContent, 'Saved');
}

async function verifyFailedSave() {
  const {context, gate, set, announcements, events, messages, nodes} = setup();
  set(2);
  context.renderStats();
  set(3, 0, 100);
  const saving = context.save();
  gate.reject(new Error('Storage unavailable'));
  assert.equal(await saving, false);
  assert.equal(announcements.length, 0);
  assert.equal(context.storageOK, false);
  assert.equal(events.includes('cache'), false);
  assert.equal(events.includes('sync'), false);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /could not be saved/);
  assert.equal(nodes.get('.save-label').textContent, '○ Unsaved changes');
}

async function verifyAccountSwitch() {
  const {context, gate, set, announcements, events, writes} = setup();
  set(2);
  context.renderStats();
  set(3, 0, 100);
  const saving = context.save();
  context.accountGeneration++;
  set(0);
  context.renderStats();
  const switchedPlayer = context.titleSnapshot;
  gate.resolve();
  assert.equal(await saving, true);
  assert.equal(announcements.length, 0, 'The old account cannot announce a title in the new account');
  assert.equal(events.includes('sync'), false);
  assert.equal(context.titleSnapshot, switchedPlayer);
  assert.equal(switchedPlayer.xp, 0);
  assert.equal(writes[1].key, 'gym-stone-v1:player-0', 'The completed write retains its original account cache key');
}

async function verifyUndoWhileSaving() {
  const {context, gate, set, announcements, writes} = setup();
  set(2);
  context.renderStats();
  const previous = context.titleSnapshot;
  set(3, 0, 100);
  const saving = context.save();
  const promoted = context.titleSnapshot;
  set(2);
  context.renderStats();
  const reverted = context.titleSnapshot;
  assert.equal(reverted.current.name, 'Rookie');
  gate.resolve();
  assert.equal(await saving, true);
  assert.equal(announcements.length, 1);
  assert.equal(announcements[0].previous, previous);
  assert.equal(announcements[0].next, promoted);
  assert.equal(announcements[0].current, reverted, 'The UI receives the latest lower snapshot to suppress a stale promotion');
  assert.ok(announcements[0].current.current.rank < announcements[0].next.current.rank);
  assert.equal(writes[0].records[day].length, 3, 'The pending persistence snapshot is isolated from subsequent edits');
  assert.equal(context.records[day].length, 2);
}

const uiSource = fs.readFileSync(path.join(__dirname, '../dist/title-progression.js'), 'utf8');
function extractUI(name, nextName) {
  const start = uiSource.indexOf(`  function ${name}(`);
  const end = uiSource.indexOf(nextName, start + 1);
  assert.ok(start >= 0 && end > start, `Find title UI function ${name}`);
  return uiSource.slice(start, end);
}
function setupNotices() {
  const timers = new Map(), delays = [], messages = [];
  let timerID = 0, closed = 0;
  const context = {
    data:titles, latest:null, pending:null, epoch:0, returnFocus:null, announced:new Set(),
    titleSnapshot:titles.build(0), ownerID:'player-a', generationValue:0,
    owner:() => context.ownerID, generation:() => context.generationValue,
    liveSnapshot:() => context.titleSnapshot,
    setup:() => false, close:() => closed++, notify:message => messages.push(message),
    setTimeout(callback, delay) { delays.push(delay); timers.set(++timerID, callback); return timerID; },
    clearTimeout(id) { timers.delete(id); }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext([
    extractUI('cancelPending', '  function progress('),
    extractUI('render', '  function announce('),
    extractUI('announce', '  function reset('),
    extractUI('reset', '  window.GymTitles =')
  ].join('\n'), context, {filename:'title-notification-lifecycle.js'});
  function flush() {
    for (const [id, callback] of [...timers]) {
      timers.delete(id);
      callback();
    }
  }
  return {context, timers, delays, messages, flush, closed:() => closed};
}

function verifyNoticeLifecycle() {
  const rookie = titles.build(0), promoted = titles.build(175);
  {
    const {context, timers, delays, messages, flush} = setupNotices();
    context.titleSnapshot = promoted;
    assert.equal(context.announce(rookie, promoted, promoted), true);
    assert.equal(context.announce(rookie, promoted, promoted), false);
    assert.deepEqual(delays, [300]);
    assert.equal(timers.size, 1);
    assert.equal(messages.length, 0);
    flush();
    assert.equal(messages.length, 1);
    assert.match(messages[0], /Title earned: First Rep.*Trail Starter/);
    assert.equal(context.pending, null);
    assert.equal(context.announce(rookie, promoted, promoted), false, 'A delivered title is announced once per owner');
  }
  {
    const {context, messages, flush} = setupNotices();
    const finalXP = titles.TITLE_LIST.at(-1).xp;
    context.titleSnapshot = titles.build(finalXP);
    assert.equal(context.announce(titles.build(finalXP - 1), context.titleSnapshot), true);
    flush();
    assert.equal(messages.length, 1);
    assert.match(messages[0], /Gym Stone Legend.*All 40 titles earned/);
  }
  {
    const {context, timers, messages, flush} = setupNotices();
    for (const [previous, next, current] of [
      [promoted, promoted, promoted],
      [promoted, rookie, rookie],
      [rookie, promoted, rookie],
      [rookie, titles.build(250), promoted],
      [null, promoted, promoted],
      [rookie, null, promoted],
      [rookie, promoted, null]
    ]) assert.equal(context.announce(previous, next, current), false);
    assert.equal(timers.size, 0);
    flush();
    assert.equal(messages.length, 0);
  }
  // Real render() cancels pending promotions as soon as an undo lowers either
  // the title or the XP within that title, releasing its dedupe reservation.
  for (const [next, reverted] of [[promoted, titles.build(50)], [titles.build(250), promoted]]) {
    const {context, timers, messages, flush} = setupNotices();
    context.titleSnapshot = next;
    assert.equal(context.announce(rookie, next), true);
    context.titleSnapshot = reverted;
    context.render(reverted, 1);
    assert.equal(timers.size, 0);
    assert.equal(context.pending, null);
    assert.equal(context.announced.size, 0);
    flush();
    assert.equal(messages.length, 0);
    context.titleSnapshot = next;
    assert.equal(context.announce(rookie, next), true, 'An undone, undelivered promotion can be earned again');
    flush();
    assert.equal(messages.length, 1);
  }
  // Guard again when the timer fires, even if no render has run in between.
  for (const change of ['owner', 'generation', 'epoch', 'title', 'xp']) {
    const {context, messages, flush} = setupNotices();
    const next = titles.build(250);
    context.titleSnapshot = next;
    assert.equal(context.announce(rookie, next), true);
    if (change === 'owner') context.ownerID = 'player-b';
    if (change === 'generation') context.generationValue++;
    if (change === 'epoch') context.epoch++;
    if (change === 'title') context.titleSnapshot = rookie;
    if (change === 'xp') context.titleSnapshot = promoted;
    flush();
    assert.equal(messages.length, 0, `${change} change suppresses the queued title message`);
    assert.equal(context.pending, null);
    assert.equal(context.announced.size, 0, `${change} cancellation releases deduplication`);
    context.ownerID = 'player-a';
    context.titleSnapshot = next;
    assert.equal(context.announce(rookie, next), true);
    flush();
    assert.equal(messages.length, 1);
  }
  {
    const {context, timers, messages, flush, closed} = setupNotices();
    context.latest = promoted;
    context.returnFocus = {};
    context.titleSnapshot = promoted;
    assert.equal(context.announce(rookie, promoted), true);
    context.reset();
    assert.equal(context.epoch, 1);
    assert.equal(context.pending, null);
    assert.equal(context.latest, null);
    assert.equal(context.returnFocus, null);
    assert.equal(context.announced.size, 0);
    assert.equal(timers.size, 0);
    assert.equal(closed(), 1);
    flush();
    assert.equal(messages.length, 0);
    assert.equal(context.announce(rookie, promoted), true, 'Reset permits titles to announce for a fresh account lifecycle');
    flush();
    assert.equal(messages.length, 1);
  }
}

(async () => {
  verifyStats();
  await verifySavedPromotion();
  await verifyFailedSave();
  await verifyAccountSwitch();
  await verifyUndoWhileSaving();
  verifyNoticeLifecycle();
  console.log('PASS: actual app XP/title rendering and legacy levels; persistence-gated promotions, save/account/undo races; actual UI timers, deduplication, final title, stale/undo/account/generation/epoch guards and reset cancellation.');
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
