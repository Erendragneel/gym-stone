'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const {specs, buildExercise, preservedMetadata, digest} = require('./add-gym-floor-catalog.cjs');
const machines = require('../dist/machine-data.js');
const baseline = require('./gym-floor-baseline.json');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'dist/exercises.json'), 'utf8'));
const byId = new Map(catalog.map(e => [e.id, e]));
const added = catalog.filter(e => e.gymFloorSupplement), window = {};
for (const file of ['exercise-muscles.js', 'workout-tracking.js']) vm.runInNewContext(fs.readFileSync(path.join(root, 'dist', file), 'utf8'), {window});
assert.equal(catalog.length, 457);
assert.equal(byId.size, catalog.length, 'Exercise IDs must stay unique');
assert.equal(specs.length, 22);
assert.equal(added.length, specs.length);
assert.deepEqual(catalog.slice(0, baseline.catalogCount).map(e => e.id), baseline.originalEntries.map(e => e.id), 'Original saved-workout IDs/order changed');
for (const original of baseline.originalEntries) {
  const exercise = byId.get(original.id);
  assert(exercise, 'Original exercise removed: ' + original.id);
  assert.equal(digest(preservedMetadata(exercise)), original.metadataSha256, 'Original movement metadata changed: ' + original.id);
}
for (const [id, fingerprint] of Object.entries(baseline.originalMuscles)) assert.equal(digest(window.GymMuscleData.exercises[id]), fingerprint, 'Original muscle roles changed: ' + id);
for (const spec of specs) {
  const exercise = byId.get(spec.id);
  assert.deepEqual(exercise, buildExercise(spec), 'Supplement metadata differs: ' + spec.id);
  const machine = machines.get(spec.machineType);
  assert(machine, 'Missing exact machine category for supplement: ' + spec.id);
  assert(machine.exerciseIds.includes(spec.id), 'Supplement missing from its exact machine category: ' + spec.id);
  assert(machines.matches(exercise, spec.machineType), 'Machine lookup does not match supplement: ' + spec.id);
  assert(!exercise.prenatal && !exercise.postpartum && !exercise.animation && !exercise.illustratedGuide);
  assert.equal(window.GymTracking.mode({}, exercise), spec.tracking || 'reps');
  assert.equal(window.GymTracking.supportsWeight({}, exercise), spec.supportsWeight ?? true);
  assert.equal(window.GymTracking.supportsDistance({}, exercise), spec.supportsDistance ?? false);
  assert(['sets', 'reps', 'weight', 'minutes', 'defaultSets', 'defaultReps', 'defaultMinutes'].every(key => exercise[key] == null));
  const profile = window.GymMuscleData.exercises[spec.id];
  assert(profile.primary.length && profile.secondary.length);
  assert([...profile.primary, ...profile.secondary].every(key => window.GymMuscleData.definitions[key]), 'Unknown muscle key: ' + spec.id);
  assert(!profile.primary.some(key => profile.secondary.includes(key)), 'Primary/secondary muscle role overlap: ' + spec.id);
  assert.equal(profile.kind, spec.group === 'Cardio' ? 'cardio' : 'strength');
  for (const variant of Object.values(exercise.variants)) assert.deepEqual(variant, {image: exercise.image, style: 'Equipment setup reference'});
  if (!process.argv.includes('--metadata-only')) assert(fs.existsSync(path.join(root, 'dist', exercise.image)), 'Missing equipment reference asset: ' + spec.id);
}
const cycling = byId.get('gym-floor-stationary-cycling');
assert(!cycling.prenatal && cycling.id !== 'prenatal-cycle');
assert.equal(byId.get('prenatal-cycle').prenatal, true, 'Existing guided cycling must remain isolated');
for (const id of ['gym-floor-dumbbell-grip-hold', 'gym-floor-suitcase-hold']) {
  const exercise = byId.get(id);
  assert.equal(window.GymTracking.mode({}, exercise), 'time');
  assert.equal(window.GymTracking.supportsWeight({}, exercise), true);
  assert.equal(window.GymTracking.supportsDistance({}, exercise), false);
}
const {normalizeAnimationCatalog} = require('./verify-motion-package.cjs');
const normalized = fs.existsSync(path.join(__dirname, 'pinned-motion-delivery.cjs')) ? require('./pinned-motion-delivery.cjs').normalizeCatalogAtlases(catalog) : catalog;
assert.equal(normalizeAnimationCatalog(normalized).length, 425, 'Original immutable animation proof changed');
assert.throws(() => normalizeAnimationCatalog(normalized.filter(e => e.id !== specs[0].id)), /Incomplete gym floor/);
const invalid = structuredClone(normalized); invalid.find(e => e.id === specs[0].id).variants.male.animation = {};
assert.throws(() => normalizeAnimationCatalog(invalid), /Motion metadata in static guide/);
const spoof = structuredClone(normalized); spoof.find(e => e.id === 'g0-24_Kettlebell_Swing').equipmentReference = true;
assert.equal(normalizeAnimationCatalog(spoof).length, 425, 'Arbitrary equipment-reference flags must not bypass the original proof');
console.log('PASS: 435 original records preserved; 22 exact variants, general cycling, timed holds, static reference boundaries, muscles and original animation proof.');
