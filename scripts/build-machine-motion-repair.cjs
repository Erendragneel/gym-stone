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
  checkMargin(artworkBounds(art, size), margin, left, top);
  const result = Buffer.alloc(tile * tile * 3, 255);
  blit(result, art, size, size, left, top);
  return result;
}

function lockPixels(lock) {
  if (lock.rect) {
    const [x, y, width, height] = lock.rect;
    assert(!lock.polygon && lock.rect.length === 4 && lock.rect.every(Number.isInteger) &&
      x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= tile && y + height <= tile,
    'Invalid stationary rectangle');
    return Array.from({ length: height }, (_, row) => {
      const start = ((y + row) * tile + x) * 3;
      return [start, start + width * 3];
    });
  }
  const points = lock.polygon;
  assert(Array.isArray(points) && points.length >= 3 && points.every(point =>
    Array.isArray(point) && point.length === 2 && point.every(value => Number.isInteger(value) && value >= 0 && value <= tile)
  ), 'Invalid stationary polygon');
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
  assert(runs.length, 'Stationary polygon covers no pixels');
  return runs;
}

function lockStationaryRegions(poses, locks) {
  const result = poses.map(pose => Buffer.from(pose));
  for (const lock of locks) {
    assert(Number.isInteger(lock.from) && poses[lock.from] && Array.isArray(lock.to) && lock.to.length > 0 &&
      lock.to.every(index => Number.isInteger(index) && index !== lock.from && result[index]), 'Invalid stationary lock targets');
    const pixels = lockPixels(lock);
    for (const index of lock.to) {
      for (const [start, end] of pixels) poses[lock.from].copy(result[index], start, start, end);
    }
  }
  return result;
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
  const poses = lockStationaryRegions(prepared, recipe.locks ?? []);
  for (const pose of poses) checkMargin(artworkBounds(pose, tile), margin);
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
    assert(atlasTile(decodedAtlas, left(i), top(i)).equals(poses[i]), `Pose ${i} pixels changed during encoding`);
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

async function build(recipePath, mode, destination) {
  const sourcePath = fs.realpathSync(recipePath);
  const sourceRoot = path.dirname(sourcePath);
  const recipe = read(fs.readFileSync(sourcePath));
  const { baseCommit, exercises, reviewedOn } = recipe;
  assert(/^[0-9a-f]{40}$/.test(baseCommit) && Array.isArray(exercises) && exercises.length, 'Provide a pinned source commit and reviewed exercises');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(reviewedOn), 'Provide the artwork review date');
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
  release.machineMotionRepair = { date: reviewedOn, exercises: repaired, variants: bindings.length, pixelsVerified: true };
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
