/* Verify station boundaries, Japanese labels and the live equipment filter. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'dist/exercises.json'), 'utf8'));
const data = require(path.join(root, 'dist/machine-data.js'));
const labels = require(path.join(root, 'dist/machine-label.js'));
const byId = new Map(catalog.map(exercise => [exercise.id, exercise]));

assert.equal(new Set(data.categories.map(category => category.id)).size, data.categories.length);
for (const category of data.categories) {
  assert.equal(new Set(category.exerciseIds).size, category.exerciseIds.length, category.id + ': duplicate exercise');
  for (const id of category.exerciseIds) assert(byId.has(id), category.id + ': missing ' + id);
}
const expected = {
  'pendulum-squat': 'gym-floor-pendulum-squat',
  'v-squat': 'gym-floor-v-squat',
  'standing-hip-thrust': 'gym-floor-standing-hip-thrust',
  'standing-hip-abduction': 'gym-floor-standing-machine-hip-abduction',
  'stationary-bike': 'gym-floor-stationary-cycling',
  'decline-chest-press': 'gym-floor-decline-machine-chest-press',
  'standing-chest-press': 'gym-floor-standing-machine-chest-press',
  'incline-machine-fly': 'gym-floor-incline-machine-chest-fly'
};
for (const [machine, id] of Object.entries(expected)) {
  assert.deepEqual(data.get(machine).exerciseIds, [id]);
  assert(data.matches(byId.get(id), machine));
  assert(!data.matches(byId.get('exp-standing-cable-chest-press'), machine));
}
assert(!data.matches(byId.get('prenatal-cycle'), 'stationary-bike'), 'general cycling excludes prenatal guide');
assert(!data.matches(byId.get('g0-21_Hip_Abduction_Machine'), 'standing-hip-abduction'), 'standing excludes seated guide');
assert(!data.matches(byId.get('exp-decline-dumbbell-bench-press'), 'decline-chest-press'), 'machine excludes free-weight guide');
assert(!data.matches(byId.get('exp-incline-dumbbell-chest-fly'), 'incline-machine-fly'));
assert.deepEqual(data.labelMatches('片足エクステンション').map(item => item.id), ['single-leg-leg-extension']);
assert.deepEqual(data.get('single-leg-leg-extension').exerciseIds, ['exp-single-leg-leg-extension']);
assert(data.matches(byId.get('exp-single-leg-leg-extension'), 'single-leg-leg-extension'));
assert(!data.matches(byId.get('guide-leg-extension'), 'single-leg-leg-extension'), 'single-leg label excludes bilateral guide');
assert.deepEqual(data.get('leg-extension').exerciseIds, ['guide-leg-extension', 'exp-single-leg-leg-extension'], 'general leg extension retains existing modes');

const smith = data.get('smith-machine');
for (const id of [
  'gym-floor-smith-machine-bench-press', 'gym-floor-incline-smith-machine-bench-press',
  'gym-floor-smith-machine-shoulder-press', 'gym-floor-smith-machine-row',
  'gym-floor-close-grip-smith-machine-bench-press',
  'g1-20_Overhand_Inverted_Row', 'g3-25_Underhand_Inverted_Row'
]) assert(smith.exerciseIds.includes(id), 'Smith missing ' + id);
assert(!data.matches(byId.get('exp-barbell-bench-press'), 'smith-machine'));
assert(data.matches(byId.get('gym-floor-rack-pull'), 'power-rack'));
assert(data.matches(byId.get('gym-floor-underhand-barbell-row'), 'power-rack'));
assert(data.matches(byId.get('gym-floor-dumbbell-russian-twist'), 'dumbbells'));

for (const id of [
  'dual-smith', 'high-incline', 'viking-machine', 'super-hand-pulldown', 'multi-pulldown',
  'ab-bench', 'french-press-machine', 'dip-machine', 't-bar-row-machine',
  'glute-kickback-machine', 'back-extension-unconfirmed', 'rear-raise-unconfirmed',
  'chin-up-machine', 'arm-leg-cardio'
]) {
  assert.equal(data.get(id).referenceOnly, true, id);
  assert.equal(data.get(id).exerciseIds.length, 0, id);
  assert(!data.matches(catalog[0], id), id + ': reference category must show no unrelated exercises');
  assert(!data.candidates().some(candidate => candidate.id === id), id + ': unconfirmed station must not be image classifier candidate');
}

const mapLabels = [
  '両手足', 'バックエクステンション', 'トレッドミル', 'ベルトスクワット', 'ペンデュラムスクワット',
  'スミス', 'プローンレッグカール', 'グルートキックバック', 'Vスクワット', 'レッグプレス',
  'スタンディングレッグカール', '片足エクステンション', '（シーテッド）カーフレイズ', 'エクステンション',
  'カーフレイズ', '階段', '自転車', 'スタンディングヒップスラスト', 'ヒップスラスト', 'ハックスクワット',
  'インナーサイ／アウターサイ', 'スタンディングアウターサイ', 'パワーラック', 'ダンベル', 'ベンチ',
  'EZバー', 'プリチャーカール台', 'インクラインベンチ', 'ワイドプルダウン', 'デュアルスミス',
  'プリチャーカールマシン', 'ラットプルダウン', 'プーリーロー', 'リアレイズ', 'インクラインフライ',
  'チェストプレス', 'ペックフライ', 'ラテラルレイズ', 'アシストチンニング', '腹筋台', 'マルチプルダウン',
  'プルオーバー', 'デクラインチェストプレス', 'インクラインチェストプレス', 'ローイングマシン',
  'スーパーハンドラッドプルダウン', 'ショルダープレス', 'ハイインクライン', 'スタンディングチェストプレス',
  'Tバーロー', 'バイキングマシン', 'チンニングマシン', 'フレンチプレスマシン', 'ディップスマシン', 'おもり'
];
assert.equal(mapLabels.length, 55);
for (const text of mapLabels) {
  const matches = data.labelMatches(text);
  assert(matches.length > 0, 'Japanese lookup missing ' + text);
  assert.deepEqual(labels.parse(text).machineIds, matches.map(item => item.id), text);
}
for (const [text, id] of [
  ['Decline Chest Press', 'decline-chest-press'],
  ['Standing Chest Press', 'standing-chest-press'],
  ['Incline Machine Chest Fly', 'incline-machine-fly'],
  ['Dual Smith Machine', 'dual-smith'],
  ['High Incline Chest Press', 'high-incline'],
  ['High Incline Machine Chest Press', 'high-incline'],
  ['Super Hand Lat Pulldown', 'super-hand-pulldown'],
  ['French Press Machine', 'french-press-machine']
]) assert.deepEqual(labels.parse(text).machineIds, [id], text + ': must not fall back to unrelated guide');
assert.deepEqual(labels.parse('レッグプレス / ハックスクワット').machineIds, ['leg-press', 'hack-squat']);
assert.equal(labels.parse('unrelated furniture').kind, 'unknown');
assert.equal(labels.parse('Standing Cable Chest Press').kind, 'unknown', 'cable exercise must not identify a press machine');
assert.deepEqual(labels.parse('Decline Dumbbell Chest Press').machineIds, ['dumbbells'], 'dumbbell exercise must not identify a press machine');

// Execute the real library filter with a minimal DOM, then select actual options.
const nodes = new Map();
const node = id => {
  if (!nodes.has(id)) nodes.set(id, { value: '', hidden: false, scrollTop: 0, replaceChildren(...children) { this.children = children; } });
  return nodes.get(id);
};
const context = {
  window: {}, exercises: catalog, filter: 'All moves', query: '', renderExercises() {},
  document: { getElementById: node, createElement: () => ({}) }
};
vm.runInNewContext(fs.readFileSync(path.join(root, 'dist/expanded-library.js'), 'utf8'), context);
node('equipment-filter').onchange({ target: { value: 'EZ bar' } });
for (const id of ['g3-10_EZ_Bar_Curl', 'g3-11_Preacher_EZ_Bar_Curl', 'exp-ez-bar-lying-triceps-extension']) {
  assert(context.window.GymLibrary.matches(byId.get(id), 'All moves'), 'EZ filter missing ' + id);
}
assert(!context.window.GymLibrary.matches(byId.get('exp-barbell-bench-press'), 'All moves'));
node('equipment-filter').onchange({ target: { value: 'Cardio machine' } });
assert(context.window.GymLibrary.matches(byId.get('gym-floor-stationary-cycling'), 'All moves'));
console.log('PASS: station boundaries, 55 Japanese labels, specialty isolation, Smith mappings and exact equipment filters.');
