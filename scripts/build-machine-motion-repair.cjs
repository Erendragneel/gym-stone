/* Pack explicitly reviewed machine poses into the existing exercise atlas format. */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createManifest, verifyPackage } = require('./verify-motion-package.cjs');

const sharp = require(require.resolve('sharp', {
  paths: [__dirname, path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')]
}));
const root = path.resolve(__dirname, '..');
const tile = 420;
const frameWidth = 600;
const frameHeight = 484;
const atlasOffsetX = 90;
const atlasOffsetY = 32;
const genders = ['male', 'female'];
const catalogPath = 'dist/exercises.json';
const releasePath = 'dist/motion-release.json';
const manifestPath = 'dist/motion-package-manifest.json';

const read = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const json = value => JSON.stringify(value, null, 2) + '\n';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const white = (width, height) => sharp({ create: { width, height, channels: 3, background: '#fff' } });
const raw = (width, height) => ({ width, height, channels: 3 });
const rgb = (image, options) => image.flatten({ background: '#fff' }).removeAlpha().raw().toBuffer(options);
const tileInput = (input, left, top) => ({ input, raw: raw(tile, tile), left, top });

function gitFile(commit, file) {
  return execFileSync('git', ['show', `${commit}:${file}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
}

function sourceFile(sourceRoot, file) {
  const source = fs.realpathSync(path.resolve(sourceRoot, file));
  assert(source.startsWith(sourceRoot + path.sep) && path.extname(source) === '.png', 'Use a PNG in the recipe directory');
  return fs.readFileSync(source);
}

function assetPath(file) {
  assert(/^assets\/motion-v18\/[\w.-]+\.webp$/.test(file), 'Expected a motion-v18 WebP path');
  return 'dist/' + file;
}

function blit(target, source, width, height, left, top) {
  const x0 = Math.max(0, -left), x1 = Math.min(width, tile - left);
  const y0 = Math.max(0, -top), y1 = Math.min(height, tile - top);
  assert(x0 < x1 && y0 < y1, 'Pose is outside the atlas tile');
  for (let y = y0; y < y1; y++) {
    source.copy(target, ((y + top) * tile + left + x0) * 3, (y * width + x0) * 3, (y * width + x1) * 3);
  }
}

function artworkBounds(bytes, size) {
  const bounds = { left: size, top: size, right: -1, bottom: -1 };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 3;
    if (Math.min(bytes[i], bytes[i + 1], bytes[i + 2]) >= 170) continue;
    bounds.left = Math.min(bounds.left, x);
    bounds.top = Math.min(bounds.top, y);
    bounds.right = Math.max(bounds.right, x);
    bounds.bottom = Math.max(bounds.bottom, y);
  }
  assert(bounds.right >= 0, 'Pose has no visible artwork');
  return bounds;
}

function checkMargin(bounds, margin, left = 0, top = 0) {
  assert(bounds.left + left >= margin && bounds.top + top >= margin &&
    bounds.right + left < tile - margin && bounds.bottom + top < tile - margin,
  'Pose artwork reaches outside its required border');
}

function atlasTile({ data, info }, left, top) {
  assert(info.channels === 3 && left + tile <= info.width && top + tile <= info.height, 'Invalid packed atlas bounds');
  const bytes = Buffer.allocUnsafe(tile * tile * 3);
  const rowWidth = tile * 3;
  for (let y = 0; y < tile; y++) {
    const start = ((y + top) * info.width + left) * 3;
    data.copy(bytes, y * rowWidth, start, start + rowWidth);
  }
  return bytes;
}

async function preparePose(pose, { sourceRoot, baseline, atlas, sources, margin }) {
  const [dx, dy] = pose.translate ?? [0, 0];
  assert(Number.isInteger(dx) && Number.isInteger(dy), 'Use integer pose translation');
  const fromSheet = typeof pose.sheet === 'string';
  assert(fromSheet !== Number.isInteger(pose.tile), 'Supply either a sheet cell or baseline atlas tile');
  const size = pose.size ?? (fromSheet ? 378 : tile);
  assert(Number.isInteger(size) && size > 0 && size <= tile, 'Invalid artwork size');
  let art;
  if (fromSheet) {
    const encoded = sourceFile(sourceRoot, pose.sheet);
    sources.set(pose.sheet, hash(encoded));
    const image = sharp(encoded);
    const { width, height } = await image.metadata();
    const cell = pose.cell, trim = pose.trim ?? 0;
    assert(width === height && width % 2 === 0 && Number.isInteger(cell) && cell >= 0 && cell < 4,
      'Expected a square 2×2 artwork sheet and valid cell index');
    const side = width / 2;
    assert(Number.isInteger(trim) && trim >= 0 && trim * 2 < side, 'Invalid source cell border trim');
    art = await rgb(image.extract({
      left: (cell % 2) * side + trim,
      top: Math.floor(cell / 2) * side + trim,
      width: side - 2 * trim,
      height: side - 2 * trim
    }).resize(size, size));
  } else {
    const source = baseline.animation;
    assert(source.atlasFrameWidth === tile && source.atlasFrameHeight === tile &&
      pose.tile >= 0 && pose.tile < source.storedPoses, 'Invalid baseline atlas tile');
    const { image, digest } = await atlas();
    sources.set(source.atlas, digest);
    art = atlasTile(image, (pose.tile % source.columns) * tile, Math.floor(pose.tile / source.columns) * tile);
    if (size !== tile) art = await rgb(sharp(art, { raw: raw(tile, tile) }).resize(size, size));
  }
  const left = Math.floor((tile - size) / 2) + dx, top = Math.floor((tile - size) / 2) + dy;
  const tapers = pose.tapers ?? (pose.taper ? [pose] : null);
  if (tapers) {
    assert(size === tile && Array.isArray(tapers) && tapers.length > 0 && tapers.length <= 2,
      'Align one or both sides of the original tile');
    for (const { translate, taper } of tapers) {
      const [full, zero] = taper;
      assert(translate.length === 2 && translate.every(Number.isInteger) &&
        taper.length === 2 && taper.every(x => Number.isInteger(x) && x >= 0 && x < tile) &&
        Math.abs(full - zero) > Math.abs(translate[0]), 'Use a wide transition between the tower and athlete');
    }
    if (tapers.length === 2) {
      const [[leftFull, leftZero], [rightFull, rightZero]] = tapers.map(alignment => alignment.taper);
      assert(leftFull < leftZero && leftZero <= rightZero && rightZero < rightFull, 'Keep tower transitions separated');
    }
    const { taperTop: top, taperBottom: bottom } = pose;
    if (top) {
      assert(top.length === 2 && top.every(y => Number.isInteger(y) && y >= 0 && y < tile) &&
        top[0] < top[1], 'Taper into the floor without moving the upper pose');
    }
    if (bottom) {
      assert(bottom.length === 2 && bottom.every(y => Number.isInteger(y) && y >= 0 && y < tile) &&
        bottom[0] < bottom[1], 'Taper above the athlete’s planted feet');
    }
    const result = Buffer.alloc(tile * tile * 3, 255);
    for (let x = 0; x < tile; x++) {
      let offsetX = 0, offsetY = 0;
      for (const { translate: [shiftX, shiftY], taper: [full, zero] } of tapers) {
        const weight = Math.max(0, Math.min(1, (x - zero) / (full - zero)));
        offsetX += shiftX * weight;
        offsetY += shiftY * weight;
      }
      for (let y = 0; y < tile; y++) {
        const topWeight = top ? Math.max(0, Math.min(1, (y - top[0]) / (top[1] - top[0]))) : 1;
        const bottomWeight = bottom ? Math.max(0, Math.min(1, (bottom[1] - y) / (bottom[1] - bottom[0]))) : 1;
        const weight = topWeight * bottomWeight;
        const sourceX = x - offsetX * weight;
        const sourceY = y - Math.round(offsetY * weight);
        if (sourceX < 0 || sourceX > tile - 1 || sourceY < 0 || sourceY >= tile) continue;
        const leftX = Math.floor(sourceX);
        const fraction = sourceX - leftX;
        const start = (sourceY * tile + leftX) * 3;
        const destination = (y * tile + x) * 3;
        if (fraction === 0) {
          art.copy(result, destination, start, start + 3);
        } else {
          for (let channel = 0; channel < 3; channel++) {
            const leftValue = art[start + channel];
            const rightValue = art[start + 3 + channel];
            result[destination + channel] = Math.round(leftValue + fraction * (rightValue - leftValue));
          }
        }
      }
    }
    checkMargin(artworkBounds(result, tile), margin);
    return result;
  }
  checkMargin(artworkBounds(art, size), margin, left, top);
  const result = Buffer.alloc(tile * tile * 3, 255);
  blit(result, art, size, size, left, top);
  return result;
}

function regionPixels(region) {
  if (region.rect) {
    const [x, y, width, height] = region.rect;
    assert(!region.polygon && region.rect.length === 4 && region.rect.every(Number.isInteger) &&
      x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= tile && y + height <= tile,
    'Invalid pose rectangle');
    return Array.from({ length: height }, (_, row) => {
      const start = ((y + row) * tile + x) * 3;
      return [start, start + width * 3];
    });
  }
  const points = region.polygon;
  assert(Array.isArray(points) && points.length >= 3 && points.every(point =>
    Array.isArray(point) && point.length === 2 && point.every(value => Number.isInteger(value) && value >= 0 && value <= tile)
  ), 'Invalid pose polygon');
  const runs = [];
  const yMin = Math.min(...points.map(point => point[1])), yMax = Math.max(...points.map(point => point[1]));
  for (let y = yMin; y < yMax; y++) {
    const intersections = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length], center = y + 0.5;
      if ((y1 > center) !== (y2 > center)) intersections.push(x1 + (center - y1) * (x2 - x1) / (y2 - y1));
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length; i += 2) {
      const x0 = Math.ceil(intersections[i] - 0.5), x1 = Math.ceil(intersections[i + 1] - 0.5);
      if (x1 > x0) runs.push([(y * tile + x0) * 3, (y * tile + x1) * 3]);
    }
  }
  assert(runs.length, 'Pose polygon covers no pixels');
  return runs;
}

function splitSceneRegions(base, regions) {
  assert(regions.length, 'A fixed scene needs moving regions');
  const moving = regions.flatMap(regionPixels).sort((a, b) => a[0] - b[0]);
  const fixed = [];
  let cursor = 0;
  for (const [start, end] of moving) {
    if (start > cursor) fixed.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < base.length) fixed.push([cursor, base.length]);
  assert(fixed.length, 'Keep part of the scene fixed');
  return { moving, fixed };
}

function fixedSceneRegions(poses, scene) {
  const source = scene.base ?? poses[scene.from];
  const { moving = [], movingByPose, basePatches = [] } = scene;
  assert((scene.base || Number.isInteger(scene.from)) && Buffer.isBuffer(source) && Array.isArray(moving),
    'A fixed scene needs a base image or pose');
  assert(!movingByPose || (Array.isArray(movingByPose) && movingByPose.length === poses.length &&
    movingByPose.every(Array.isArray)), 'Supply one moving-region list per pose');
  assert(Array.isArray(basePatches), 'Base patches must be a list');
  const base = basePatches.length ? Buffer.from(source) : source;
  for (const patch of basePatches) {
    const sample = poses[patch.from];
    assert(Number.isInteger(patch.from) && sample, 'A base patch needs an existing pose');
    for (const [start, end] of regionPixels(patch)) sample.copy(base, start, start, end);
  }
  const regions = movingByPose
    ? movingByPose.map(local => splitSceneRegions(base, [...moving, ...local]))
    : Array(poses.length).fill(splitSceneRegions(base, moving));
  return { base, regions };
}

async function loadFixedScene(scene, sourceRoot, sources) {
  if (!scene?.baseImage) return scene;
  assert(scene.from == null, 'Choose a source pose or a separate stationary image');
  const encoded = sourceFile(sourceRoot, scene.baseImage);
  const image = sharp(encoded);
  const { width, height } = await image.metadata();
  assert(width === tile && height === tile, 'A stationary image must match the atlas tile');
  sources.set(scene.baseImage, hash(encoded));
  return { ...scene, base: await rgb(image) };
}

function composePoses(prepared, locks, scene) {
  const fixedScene = scene && fixedSceneRegions(prepared, scene);
  const checks = prepared.map(() => []);
  const poses = prepared.map((source, index) => {
    if (!fixedScene) return Buffer.from(source);
    const { moving, fixed } = fixedScene.regions[index];
    const pose = Buffer.from(fixedScene.base);
    for (const [start, end] of moving) source.copy(pose, start, start, end);
    checks[index].push({ source: fixedScene.base, pixels: fixed, label: 'fixed scene' });
    return pose;
  });
  for (const lock of locks) {
    const source = prepared[lock.from];
    assert(Number.isInteger(lock.from) && source && Array.isArray(lock.to) && lock.to.length > 0 &&
      lock.to.every(index => Number.isInteger(index) && index !== lock.from && poses[index]), 'Invalid stationary lock targets');
    const pixels = regionPixels(lock);
    for (const index of lock.to) {
      for (const [start, end] of pixels) source.copy(poses[index], start, start, end);
      checks[index].push({ source, pixels, label: 'stationary lock' });
    }
  }
  function verify(index, pose) {
    for (const { source, pixels, label } of checks[index]) {
      assert(pixels.every(([start, end]) => pose.subarray(start, end).equals(source.subarray(start, end))),
        `Pose ${index} changed its ${label} pixels`);
    }
  }
  return { poses, verify };
}

function timing({ poses, sequence, reverse, delayMs }) {
  if (reverse) {
    assert(!sequence, 'Choose an explicit sequence or a mirrored return');
    const outward = poses.map((_, index) => index);
    sequence = [...outward, ...outward.slice(1, -1).reverse()];
    if (poses.some(pose => pose.phase != null)) {
      assert(poses.every((pose, index) => Number.isFinite(pose.phase) && (!index || pose.phase > poses[index - 1].phase)),
        'Reviewed motion phases must increase on the outward path');
    }
  }
  assert(Array.isArray(sequence) && new Set(sequence).size === poses.length &&
    sequence.every(index => Number.isInteger(index) && index >= 0 && index < poses.length), 'Invalid playback pose sequence');
  assert(Array.isArray(delayMs) && delayMs.length === sequence.length &&
    delayMs.every(delay => Number.isInteger(delay) && delay > 0), 'Specify one positive duration per playback step');
  return { sequence, delayMs, duration: delayMs.reduce((sum, delay) => sum + delay, 0) };
}

async function packVariant(recipe, context, current) {
  assert(Array.isArray(recipe.poses) && recipe.poses.length >= 2, 'Need at least two reviewed poses');
  const { sequence, delayMs, duration } = timing(recipe);
  const margin = recipe.minBorder ?? 4;
  assert(Number.isInteger(margin) && margin >= 0 && margin < tile / 2, 'Invalid minimum border');
  const sources = new Map();
  const prepared = [];
  for (const pose of recipe.poses) prepared.push(await preparePose(pose, { ...context, margin, sources }));
  const scene = await loadFixedScene(recipe.fixedScene, context.sourceRoot, sources);
  const composition = composePoses(prepared, recipe.locks ?? [], scene);
  const { poses } = composition;
  for (const [index, pose] of poses.entries()) {
    checkMargin(artworkBounds(pose, tile), margin);
    composition.verify(index, pose);
  }
  assert.equal(new Set(poses.map(hash)).size, poses.length, 'Reviewed poses include identical artwork');

  const columns = Math.min(8, poses.length, recipe.columns ?? 4);
  assert(Number.isInteger(columns) && columns >= 1, 'Invalid atlas column count');
  const rows = Math.ceil(poses.length / columns);
  const left = i => (i % columns) * tile, top = i => Math.floor(i / columns) * tile;
  const posterFrame = white(frameWidth, frameHeight).composite([tileInput(poses[sequence[0]], atlasOffsetX, atlasOffsetY)]);
  const expectedPoster = await rgb(posterFrame.clone());
  const posterBytes = await posterFrame.webp({ lossless: true, effort: 5 }).toBuffer();
  const atlasBytes = await white(tile * columns, tile * rows)
    .composite(poses.map((pose, index) => tileInput(pose, left(index), top(index))))
    .webp({ lossless: true, effort: 5 }).toBuffer();
  assert((await rgb(sharp(posterBytes))).equals(expectedPoster), 'Poster pixels changed during encoding');
  const decodedAtlas = await rgb(sharp(atlasBytes), { resolveWithObject: true });
  for (let i = 0; i < poses.length; i++) {
    const decoded = atlasTile(decodedAtlas, left(i), top(i));
    assert(decoded.equals(poses[i]), `Pose ${i} pixels changed during encoding`);
    composition.verify(i, decoded);
  }

  const poster = current.poster;
  const atlas = current.animation.atlas;
  const visual = { image: poster, poster, style: 'Controlled anime exercise loop', animation: {
    keyframes: sequence.length, uniquePoses: poses.length, duration_ms: duration, framing: context.framing,
    nativeTransformVersion: 2, background: '#ffffff', crossfade: false, atlas, columns, frameWidth, frameHeight,
    delayMs, isometricHold: current.animation.isometricHold ?? false, atlasFrameWidth: tile, atlasFrameHeight: tile,
    atlasOffsetX, atlasOffsetY, storedPoses: poses.length, poseSequence: sequence
  } };
  if (current.animation.playbackMode) visual.animation.playbackMode = current.animation.playbackMode;
  return {
    visual, files: [[assetPath(poster), posterBytes], [assetPath(atlas), atlasBytes]],
    sourceHash: hash(json({ baseCommit: context.baseCommit, recipe, sources: Array.from(sources) }))
  };
}

function verifyMachineScope(scope, reviewed, catalog) {
  const { categories, get } = require(path.join(root, 'dist/machine-data.js'));
  const ids = new Set(categories.flatMap(category => category.exerciseIds));
  const sleds = new Set(get('sled').exerciseIds);
  const expected = new Map(catalog.filter(exercise => ids.has(exercise.id)).flatMap(exercise =>
    genders.map(gender => [exercise.id + ':' + gender, { exercise, gender }])
  ));
  assert.equal(expected.size, ids.size * genders.length, 'Machine scope has missing exercise records');
  const seen = new Set();
  const count = (keys, accept = () => true) => {
    assert(Array.isArray(keys), 'Machine scope entries must be listed');
    for (const key of keys) {
      const entry = expected.get(key);
      assert(entry && !seen.has(key) && accept(entry), `Invalid or duplicate machine scope entry: ${key}`);
      seen.add(key);
    }
    return keys.length;
  };
  const updated = count([...reviewed].filter(([id]) => ids.has(id)).flatMap(([id, variants]) =>
    [...variants].map(gender => id + ':' + gender)
  ));
  const retainedAnchors = count(scope.retainedAnchors);
  const isometricHolds = count(scope.isometricHolds, ({ exercise, gender }) =>
    exercise.variants[gender].animation.storedPoses === 1
  );
  const travellingSleds = count(scope.travellingSleds, ({ exercise }) => sleds.has(exercise.id));
  assert.equal(seen.size, expected.size, 'Every machine variant needs a repair or an explicit review outcome');
  return { exercises: ids.size, variants: seen.size, updated, retainedAnchors, isometricHolds, travellingSleds };
}

async function build(recipePath, mode, destination) {
  const sourcePath = fs.realpathSync(recipePath);
  const sourceRoot = path.dirname(sourcePath);
  const recipe = read(fs.readFileSync(sourcePath));
  const { baseCommit, exercises, reviewedOn, releaseKey = 'machineMotionRepair' } = recipe;
  assert(/^[0-9a-f]{40}$/.test(baseCommit) && Array.isArray(exercises) && exercises.length, 'Provide a pinned source commit and reviewed exercises');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(reviewedOn), 'Provide the artwork review date');
  assert(releaseKey === 'machineMotionRepair' || /^[a-z][A-Za-z]*FrameLock$/.test(releaseKey), 'Invalid motion release record key');
  if (mode === '--apply') assert(sourceRoot.startsWith(path.join(root, 'animation-source') + path.sep), 'Keep release sources in the checkout');
  const baseline = read(gitFile(baseCommit, catalogPath));
  const catalog = read(fs.readFileSync(path.join(root, catalogPath)));
  const release = read(fs.readFileSync(path.join(root, releasePath)));
  const reviewed = new Map();
  const bindings = [];
  const files = new Map();
  for (const { id, framing, variants } of exercises) {
    assert(typeof framing === 'string' && framing.length > 0 && !reviewed.has(id), 'Missing framing or duplicate exercise');
    const source = baseline.find(row => row.id === id);
    const record = catalog.find(row => row.id === id);
    const selected = Object.keys(variants ?? {});
    assert(record?.animation && source?.animation && selected.length &&
      selected.every(gender => genders.includes(gender) && variants[gender] && typeof variants[gender] === 'object'),
      `Expected existing male or female variants for ${id}`);
    reviewed.set(id, new Set(selected));
    const next = { ...record.variants };
    for (const gender of genders) {
      if (!variants[gender]) continue;
      const original = source.variants[gender];
      let sourceAtlas;
      const atlas = async () => {
        if (!sourceAtlas) {
          const bytes = gitFile(baseCommit, assetPath(original.animation.atlas));
          sourceAtlas = { image: await rgb(sharp(bytes), { resolveWithObject: true }), digest: hash(bytes) };
        }
        return sourceAtlas;
      };
      let packed;
      try {
        packed = await packVariant(variants[gender], { sourceRoot, baseline: original, atlas, framing, baseCommit }, record.variants[gender]);
      } catch (error) {
        throw new Error(`${id} (${gender}): ${error.message}`, { cause: error });
      }
      next[gender] = packed.visual;
      for (const [file, bytes] of packed.files) {
        assert(!files.has(file), `Duplicate atlas or poster path: ${file}`);
        files.set(file, bytes);
      }
      bindings.push({ exercise: id, variant: gender, sourceHash: packed.sourceHash });
    }
    if (variants.male) Object.assign(record, next.male);
    record.variants = next;
  }
  const prior = release.nativeSourceBindings;
  release.nativeSourceBindings = prior.flatMap(binding => {
    const selected = reviewed.get(binding.exercise);
    if (!selected) return [binding];
    if (selected.has(binding.variant)) return [];
    if (binding.variant !== 'retained') return [binding];
    return genders.filter(gender => !selected.has(gender) && !prior.some(item =>
      item.exercise === binding.exercise && item.variant === gender
    )).map(variant => ({ ...binding, variant }));
  }).concat(bindings);
  release.nativeSourceBindings.sort((a, b) => a.exercise.localeCompare(b.exercise, 'en') || a.variant.localeCompare(b.variant, 'en'));
  release.keyframes = catalog.filter(row => !row.postpartum && !row.kettlebellAnimation)
    .reduce((total, row) => total + Object.values(row.variants).reduce((count, variant) => count + variant.animation.keyframes, 0), 0);
  const repaired = [...reviewed.keys()];
  const report = { date: reviewedOn, exercises: repaired, variants: bindings.length, pixelsVerified: true };
  const fixedSceneVariants = exercises.flatMap(exercise => Object.values(exercise.variants)).filter(variant => variant.fixedScene).length;
  if (fixedSceneVariants) report.fixedSceneVariants = fixedSceneVariants;
  if (recipe.machineScope) report.machineScope = verifyMachineScope(recipe.machineScope, reviewed, catalog);
  release[releaseKey] = report;
  files.set(catalogPath, json(catalog));
  files.set(releasePath, json(release));

  if (mode === '--out') {
    const stage = path.resolve(destination);
    assert(stage !== root && !stage.startsWith(root + path.sep), 'Stage outside the public checkout');
    fs.mkdirSync(stage, { recursive: true });
    assert.equal(fs.readdirSync(stage).length, 0, 'Stage in an empty directory');
    for (const [file, bytes] of files) {
      const target = path.join(stage, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
    }
    return { staged: stage, exercises: repaired, variants: bindings.length, files: files.size };
  }

  // All recipe checks and exact pixel comparisons have passed before any release file is replaced.
  const originals = new Map([...files.keys(), manifestPath].map(file => [file, fs.readFileSync(path.join(root, file))]));
  try {
    for (const [file, bytes] of files) fs.writeFileSync(path.join(root, file), bytes);
    const manifest = createManifest(root, release.nativeSourceBindings);
    fs.writeFileSync(path.join(root, manifestPath), json(manifest));
    const { nativeSourceBindings, ...proof } = verifyPackage(root);
    return proof;
  } catch (error) {
    for (const [file, bytes] of originals) fs.writeFileSync(path.join(root, file), bytes);
    throw error;
  }
}

if (require.main === module) {
  const [recipePath, mode, destination] = process.argv.slice(2);
  if (!recipePath || (mode !== '--apply' && !(mode === '--out' && destination))) {
    console.error('Usage: node scripts/build-machine-motion-repair.cjs <recipe.json> (--out <empty-stage> | --apply)');
    process.exitCode = 1;
  } else build(recipePath, mode, destination).then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
