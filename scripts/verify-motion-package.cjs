/* Portable, read-only animation gate for local checks and the Pages runner. */
const fs = require('fs'), path = require('path'), assert = require('assert'), crypto = require('crypto');
const MANIFEST_PATH = 'dist/motion-package-manifest.json';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const digest = value => sha256(Buffer.from(JSON.stringify(canonical(value))));
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const owned = value => Object.fromEntries(['image', 'poster', 'style', 'animation'].filter(key => value[key] !== undefined).map(key => [key, value[key]]));
// These static guides are separate from the immutable, 425-exercise motion proof.
const POSTPARTUM_IDS = new Set([
  'postpartum-comfortable-rib-breathing', 'postpartum-pelvic-floor-release',
  'postpartum-gentle-ankle-movement', 'postpartum-short-easy-walk',
  'postpartum-gentle-pelvic-floor-lift-release', 'postpartum-side-lying-core-connection'
]);
const KETTLEBELL_IDS = new Set(['kettlebell-russian-twist', 'kettlebell-sit-up', 'kettlebell-halo']);

function staticOnly(record) {
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert(!/^(?:animation|gif)$/i.test(key), 'Motion metadata in static guide: ' + record.id);
      visit(child);
    }
  };
  visit(record);
}

function animationCatalog(catalog) {
  assert(Array.isArray(catalog), 'Missing exercise catalog');
  const ids = new Set(), motion = [], guides = [], kettlebellGuides = [];
  for (const record of catalog) {
    assert(record && typeof record.id === 'string' && record.id.length && !ids.has(record.id), 'Missing or duplicate exercise ID');
    ids.add(record.id);
    if (KETTLEBELL_IDS.has(record.id)) {
      assert(record.illustratedGuide === true && record.equipment === 'Kettlebell' && record.tracking === 'reps' && record.expansion === true && record.supportsWeight === true, 'Invalid kettlebell guide metadata: ' + record.id);
      assert(record.variants && typeof record.variants === 'object' && !Array.isArray(record.variants) && Object.keys(record.variants).sort().join(',') === 'female,male', 'Kettlebell guide must have male and female image variants: ' + record.id);
      for (const gender of ['male', 'female']) assert(record.variants[gender]?.image === 'assets/kettlebell/' + gender + '-' + record.id + '.svg', 'Invalid kettlebell guide image: ' + record.id + ':' + gender);
      assert(record.image === record.variants.male.image, 'Kettlebell guide must use its male image by default: ' + record.id);
      staticOnly(record); kettlebellGuides.push(record); continue;
    }
    if (!POSTPARTUM_IDS.has(record.id)) { motion.push(record); continue; }
    assert(record.postpartum === true && record.group === 'Postpartum' && record.tracking === 'time' && record.supportsWeight === false && record.supportsDistance === false, 'Invalid postpartum guide metadata: ' + record.id);
    assert(['defaultMinutes', 'defaultSets', 'defaultReps', 'suggestedSeconds', 'sets', 'reps', 'minutes'].every(key => record[key] == null), 'Postpartum guide contains a default dose: ' + record.id);
    assert(typeof record.image === 'string' && /^assets\/postpartum\/postpartum-[a-z-]+\.svg$/.test(record.image), 'Invalid postpartum guide image: ' + record.id);
    assert(record.variants && typeof record.variants === 'object' && !Array.isArray(record.variants) && Object.keys(record.variants).length === 1 && record.variants.female?.image === record.image, 'Postpartum guide must have only its matching female image variant: ' + record.id);
    staticOnly(record); guides.push(record);
  }
  assert(motion.length === 425, 'Package requires all 425 reviewed animations');
  assert(guides.length === 0 || guides.length === POSTPARTUM_IDS.size, 'Incomplete postpartum guide supplement');
  assert(kettlebellGuides.length === 0 || kettlebellGuides.length === KETTLEBELL_IDS.size, 'Incomplete kettlebell guide supplement');
  return {motion, guides, kettlebellGuides};
}

function validateStaticGuides(stage, guides) {
  const safeTags = new Set(['svg', 'title', 'desc', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'marker', 'clippath', 'lineargradient', 'radialgradient', 'stop']);
  for (const record of guides) {
    const assets = new Set([record.image, ...Object.values(record.variants).map(variant => variant.image)]);
    for (const asset of assets) {
      const svg = fs.readFileSync(ordinaryFile(stage, 'dist/' + asset), 'utf8');
      assert(/<svg\b/i.test(svg) && /<\/svg\s*>\s*$/i.test(svg), 'Invalid static guide SVG: ' + record.id);
      assert(!/<!DOCTYPE|<!ENTITY|<\?(?!xml\s)|\bon[a-z]+\s*=|\b(?:href|src)\s*=|\bstyle\s*=|url\s*\(|javascript\s*:|data\s*:/i.test(svg), 'Active or external content in static guide SVG: ' + record.id);
      for (const match of svg.matchAll(/<\/?\s*([A-Za-z][\w:.-]*)\b/g)) assert(safeTags.has(match[1].toLowerCase()), 'Unsupported static guide SVG element: ' + match[1]);
    }
  }
}

function ordinaryFile(stage, relative) {
  assert(typeof relative === 'string' && relative.length && !relative.includes('\\') && !path.posix.isAbsolute(relative) && !relative.split('/').some(part => !part || part === '.' || part === '..'), 'Unsafe package path: ' + relative);
  const base = path.resolve(stage), file = path.resolve(base, ...relative.split('/'));
  assert(file.startsWith(base + path.sep), 'Package path escaped the checkout');
  let current = base;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    assert(!fs.lstatSync(current).isSymbolicLink(), 'Symlink in motion package: ' + relative);
  }
  assert(fs.lstatSync(file).isFile(), 'Motion package entry is not an ordinary file: ' + relative);
  return file;
}

function validateAnimation(animation, label) {
  assert(animation && animation.frameWidth === 600 && animation.frameHeight === 484, 'Invalid frame size: ' + label);
  assert(animation.atlasFrameWidth === 420 && animation.atlasFrameHeight === 420, 'Invalid packed frame size: ' + label);
  assert(animation.background === '#ffffff' && animation.crossfade === false, 'Unreviewed rendering mode: ' + label);
  for (const key of ['keyframes', 'storedPoses', 'columns', 'duration_ms']) assert(Number.isInteger(animation[key]) && animation[key] > 0, 'Invalid ' + key + ': ' + label);
  assert(Array.isArray(animation.delayMs) && animation.delayMs.length === animation.keyframes && animation.delayMs.every(delay => Number.isInteger(delay) && delay > 0), 'Invalid frame timing: ' + label);
  assert.strictEqual(animation.delayMs.reduce((sum, delay) => sum + delay, 0), animation.duration_ms, 'Incomplete cycle timing: ' + label);
  assert(Array.isArray(animation.poseSequence) && animation.poseSequence.length === animation.keyframes && animation.poseSequence.every(pose => Number.isInteger(pose) && pose >= 0 && pose < animation.storedPoses), 'Invalid pose sequence: ' + label);
  assert(animation.atlasOffsetX === 90 && animation.atlasOffsetY === 32, 'Unreviewed packed frame placement: ' + label);
}

function motionAsset(relative) {
  assert(typeof relative === 'string' && /^assets\/motion-v18\/[A-Za-z0-9_.\/-]+\.(?:png|webp)$/.test(relative) && !relative.split('/').includes('..'), 'Unreviewed motion asset path: ' + relative);
  return 'dist/' + relative;
}

function normalizeAnimationCatalog(catalog) {
  catalog = animationCatalog(catalog).motion;
  const ids = new Set();
  return catalog.map(record => {
    assert(typeof record.id === 'string' && record.id.length && !ids.has(record.id), 'Missing or duplicate exercise ID');
    ids.add(record.id);
    assert(record.variants && typeof record.variants === 'object' && !Array.isArray(record.variants) && Object.keys(record.variants).length, 'Missing animation variants: ' + record.id);
    validateAnimation(record.animation, record.id);
    motionAsset(record.image);
    assert(!record.gif, 'Legacy preferred GIF remains: ' + record.id);
    const variants = Object.fromEntries(Object.keys(record.variants).sort().map(gender => {
      const variant = record.variants[gender];
      assert(variant && !variant.gif, 'Invalid packaged variant: ' + record.id + ':' + gender);
      validateAnimation(variant.animation, record.id + ':' + gender);
      for (const asset of [variant.image, variant.poster, variant.animation.atlas]) motionAsset(asset);
      return [gender, owned(variant)];
    }));
    return {id: record.id, ...owned(record), variants};
  }).sort((a, b) => compare(a.id, b.id));
}

function normalizeBindings(bindings, catalog) {
  assert(Array.isArray(bindings) && bindings.length, 'Missing reviewed native source bindings');
  const ids = new Set(catalog.map(record => record.id)), covered = new Set(), seen = new Set();
  const normalized = bindings.map(binding => {
    assert(binding && ids.has(binding.exercise) && typeof binding.variant === 'string' && binding.variant.length && /^[a-f0-9]{64}$/.test(binding.sourceHash), 'Invalid reviewed native source binding');
    const key = JSON.stringify([binding.exercise, binding.variant]);
    assert(!seen.has(key), 'Duplicate native source binding');
    seen.add(key); covered.add(binding.exercise);
    return {exercise: binding.exercise, variant: binding.variant, sourceHash: binding.sourceHash};
  }).sort((a, b) => compare(a.exercise, b.exercise) || compare(a.variant, b.variant));
  assert.strictEqual(covered.size, 425, 'Native approval does not cover all 425 exercises');
  return normalized;
}

function packageFiles(stage, catalog) {
  const files = new Set(['dist/clean-animation.js', 'dist/clean-animation.css']);
  for (const record of catalog) {
    for (const value of [record, ...Object.values(record.variants)]) {
      for (const asset of [value.image, value.poster, value.animation.atlas].filter(Boolean)) files.add(motionAsset(asset));
    }
  }
  const inventory = (relative) => {
    for (const entry of fs.readdirSync(path.join(stage, relative), {withFileTypes: true})) {
      assert(!entry.isSymbolicLink(), 'Symlink in motion assets');
      const file = relative + '/' + entry.name;
      if (entry.isDirectory()) inventory(file);
      else {
        assert(entry.isFile() && /\.(?:png|webp|gif)$/.test(entry.name), 'Unexpected motion asset: ' + file);
        files.add(file);
      }
    }
  };
  inventory('dist/assets/motion-v18');
  return [...files].sort().map(relative => {
    let bytes = fs.readFileSync(ordinaryFile(stage, relative));
    // Git may check these two reviewed text files out with CRLF on Windows.
    // Their immutable manifest records LF; all other asset bytes stay exact.
    if (relative === 'dist/clean-animation.js' || relative === 'dist/clean-animation.css') bytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
    return {path: relative, sha256: sha256(bytes), bytes: bytes.length};
  });
}

function createManifest(stage, nativeSourceBindings) {
  const catalog = read(ordinaryFile(stage, 'dist/exercises.json'));
  const {motion, guides, kettlebellGuides} = animationCatalog(catalog);
  validateStaticGuides(stage, [...guides, ...kettlebellGuides]);
  const normalized = normalizeAnimationCatalog(catalog);
  return {schemaVersion: 1, reviewedExercises: 425, pendingExercises: 0,
    animationCatalogSha256: digest(normalized), nativeSourceBindings: normalizeBindings(nativeSourceBindings, motion), files: packageFiles(stage, motion)};
}

function verifyPackage(stage) {
  const manifest = read(ordinaryFile(stage, MANIFEST_PATH)), release = read(ordinaryFile(stage, 'dist/motion-release.json'));
  assert(manifest.schemaVersion === 1 && manifest.reviewedExercises === 425 && manifest.pendingExercises === 0, 'Incomplete motion package manifest');
  assert(release.reviewedExercises === 425 && release.pendingExercises === 0 && release.pixelIdentityVerifiedForEveryPackedKeyframe === true && release.lossless === true, 'Incomplete approved motion release');
  const actual = createManifest(stage, manifest.nativeSourceBindings);
  assert.deepStrictEqual(manifest, actual, 'Motion package no longer matches its reviewed manifest');
  const catalog = animationCatalog(read(ordinaryFile(stage, 'dist/exercises.json'))).motion;
  assert.deepStrictEqual(normalizeBindings(release.nativeSourceBindings, catalog), actual.nativeSourceBindings, 'Release/native approval binding differs from the manifest');
  const variants = catalog.reduce((sum, record) => sum + Object.keys(record.variants).length, 0);
  const keyframes = catalog.reduce((sum, record) => sum + Object.values(record.variants).reduce((count, variant) => count + variant.animation.keyframes, 0), 0);
  assert.strictEqual(release.variants, variants, 'Release variant count changed');
  assert.strictEqual(release.keyframes, keyframes, 'Release keyframe count changed');
  return {passed: true, reviewedExercises: 425, pendingExercises: 0, variants, keyframes, motionFiles: manifest.files.length,
    animationCatalogSha256: manifest.animationCatalogSha256, nativeSourceBindings: actual.nativeSourceBindings};
}

module.exports = {MANIFEST_PATH, normalizeAnimationCatalog, createManifest, verifyPackage};
if (require.main === module) {
  try {
    const result = verifyPackage(path.resolve(process.argv[2] || '.'));
    console.log(JSON.stringify({...result, nativeSourceBindings: undefined}, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
