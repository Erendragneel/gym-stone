'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const quest = require('../dist/daily-quest-data.js');
const catalog = {
  squat: {id:'squat', name:'Bodyweight Squat', group:'Quads'},
  push: {id:'push', name:'Push Up', group:'Chest'},
  row: {id:'row', name:'Dumbbell Row', group:'Back'},
  plank: {id:'plank', name:'Plank', group:'Core'},
  rest: {id:'rest', name:'Rest Day', group:'Recovery', recovery:true}
};
const resolve = record => catalog[record.id] || (record.name ? {id:record.id, name:record.name, group:record.group || 'Activity'} : null);
const through = '2026-10-17';
const done = (id, extra = {}) => ({id, done:true, ...extra});
const build = records => quest.build(records, resolve, {through});
const day = entries => build({[through]:entries}).byDay[through];
const trio = () => ['squat', 'push', 'row'].map(id => done(id));

for (const count of [0, 2, 3, 4]) {
  const result = day(['squat', 'push', 'row', 'plank'].slice(0, count).map(id => done(id)));
  assert.equal(result.completed, count);
  assert.equal(result.target, 3);
  assert.equal(result.earned, count >= 3);
  assert.equal(result.bonusXP, count >= 3 ? 100 : 0);
  assert.equal(result.badge, count >= 3 ? 'Daily Trio' : null);
}
assert.equal(build({}).bonusXP, 0);
assert.equal(day([done('squat'), done('squat'), done('squat')]).completed, 1);
assert.equal(day([done('squat', {setEntries:[{sets:3,reps:10}, {sets:3,reps:10}, {sets:3,reps:10}]})]).completed, 1);
assert.equal(day([done('a',{name:' Brisk-Walk '}), done('b',{name:'BRISK_walk'}), done('c',{name:'Ｂｒｉｓｋ　ｗａｌｋ'})]).completed, 1);
assert.equal(day([done('squat'), done('manual-squat', {name:'  BODYWEIGHT   SQUAT  '}), done('push')]).completed, 2);
assert.equal(day([done('unresolved-id'), done('blank',{name:'   '}), null]).completed, 0);
assert.equal(day([done('a',{name:'Walking'}), done('b',{name:'Swimming'}), done('c',{name:'Cycling'})]).earned, true);
assert.equal(day([done('squat'), done('push',{done:false}), done('row',{done:false})]).completed, 1);
assert.equal(day([done('squat'), done('push',{done:'true'}), done('row',{done:1})]).completed, 1);
assert.equal(day([done('squat'), done('recovery',{name:'Recovery',recovery:true}), done('rest')]).completed, 1);

const separate = build({'2026-10-17':trio(), '2026-10-15':trio(), '2026-10-16':[done('squat'),done('push')]});
assert.deepEqual(separate.earnedDays.map(result => result.day), ['2026-10-15','2026-10-17']);
assert.equal(separate.bonusXP, 200);
assert.equal(separate.byDay['2026-10-16'].earned, false);
const invalid = build({'2026-10-18':trio(), '2026-02-30':trio(), '2026-13-01':trio(), '2026-1-01':trio(), nonsense:trio(), '2026-10-01':{id:'squat',done:true}});
assert.deepEqual(Object.keys(invalid.byDay), ['2026-10-01']);
assert.equal(invalid.bonusXP, 0);
assert.equal(quest.validDay('2024-02-29'), true);
assert.equal(quest.validDay('2026-02-29'), false);

const editable = {[through]:trio()};
assert.equal(build(editable).bonusXP, 100);
editable[through][2].done = false;
assert.equal(build(editable).bonusXP, 0);
editable[through][2].done = true;
assert.equal(build(editable).bonusXP, 100);
editable[through].pop();
assert.equal(build(editable).bonusXP, 0);
assert.equal(build({[through]:trio()}).bonusXP, 100);
assert.equal(build({[through]:[done('squat')]}).bonusXP, 0);
assert.equal(build({}).bonusXP, 0);

const frozen = {[through]:[...trio(), done('squat',{setEntries:[{sets:3,reps:10}]})]};
const before = structuredClone(frozen);
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
freeze(frozen); freeze(catalog);
assert.equal(build(frozen).bonusXP, 100);
assert.deepEqual(frozen, before);
assert.deepEqual(build(frozen), build(frozen));
const scope = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/daily-quest-data.js'),'utf8'), scope);
assert.equal(scope.window.GymDailyQuestData.BONUS_XP, 100);
assert.equal(scope.window.GymDailyQuestData.build(frozen, resolve, {through}).bonusXP, 100);
console.log('PASS: daily thresholds, distinct identities, custom normalization, completed-only counting, recovery exclusions, valid dates, one reward per day, undo/delete, owner isolation, immutable inputs and browser export.');
