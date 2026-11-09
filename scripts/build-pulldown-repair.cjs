/* Pack reviewed full-body pulldown poses into Gym Stone's existing atlas format. */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { baseMotionRecords, createManifest, verifyPackage } = require('./verify-motion-package.cjs');

const sharp = require(require.resolve('sharp', {
  paths: [__dirname, path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')]
}));
const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'animation-source/pulldown-repair');
const exercise = 'exp-plate-loaded-lat-pulldown';
const tile = 420;
const frameWidth = 600;
const frameHeight = 484;
const atlasOffsetX = 90;
const atlasOffsetY = 32;
const renderSize = 378;
const padding = (tile - renderSize) / 2;
const genders = ['male', 'female'];

const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const white = (width, height) => sharp({ create: { width, height, channels: 3, background: '#fff' } });
const rgb = image => image.removeAlpha().raw().toBuffer();

function measurePose(bytes, leftPlateX) {
  const pose = { left: tile, top: tile, right: 0, floor: 0, leftGrip: tile, rightGrip: tile, leftPlate: tile, rightPlate: tile };
  for (let y = 0; y < tile; y++) {
    for (let x = 0; x < tile; x++) {
      const pixel = (y * tile + x) * 3;
      const red = bytes[pixel];
      const green = bytes[pixel + 1];
      const blue = bytes[pixel + 2];
      // Within the two handle bands, the highest warm pixels mark each fist.
      if (y < 201 && red > 140 && red > green + 25 && green > blue + 15 && green > 95) {
        if (x > 81 && x < 165) pose.leftGrip = Math.min(pose.leftGrip, y);
        if (x > 255 && x < 341) pose.rightGrip = Math.min(pose.rightGrip, y);
      }
      if (y >= 105 && y < 225 && Math.max(red, green, blue) < 125) {
        if (x === leftPlateX) pose.leftPlate = Math.min(pose.leftPlate, y);
        if (x === tile - leftPlateX) pose.rightPlate = Math.min(pose.rightPlate, y);
      }
      if (Math.min(red, green, blue) >= 140) continue;
      pose.left = Math.min(pose.left, x);
      pose.top = Math.min(pose.top, y);
      pose.right = Math.max(pose.right, x);
      pose.floor = Math.max(pose.floor, y);
    }
  }
  return pose;
}

async function packPose({ sheet, cell, offset = [0, 0] }) {
  assert(/^[a-z0-9-]+\.png$/.test(sheet), 'Invalid source sheet');
  const source = sharp(path.join(sourceRoot, 'sheets', sheet));
  const { width, height } = await source.metadata();
  assert.equal(width, height, 'Source sheet must be square');
  assert(Number.isInteger(cell) && cell >= 0 && cell < 4 && width % 2 === 0, 'Expected a reviewed 2x2 sheet cell');
  assert(offset.length === 2 && offset.every(value => Number.isInteger(value) && Math.abs(value) <= padding), 'Invalid source translation');
  const size = width / 2;
  const pose = await source.extract({ left: cell % 2 * size, top: Math.floor(cell / 2) * size, width: size, height: size })
    .resize(renderSize, renderSize).flatten({ background: '#fff' }).png().toBuffer();
  return white(tile, tile).composite([{ input: pose, left: padding + offset[0], top: padding + offset[1] }]).png().toBuffer();
}

async function packVariant(gender, poses, sequence, delayMs) {
  const prepared = await Promise.all(poses.map(packPose));
  const frame = pose => white(frameWidth, frameHeight).composite([{ input: pose, left: atlasOffsetX, top: atlasOffsetY }]);
  const leftPlateX = gender === 'male' ? 103 : 108;
  const measurements = await Promise.all(prepared.map(async pose => measurePose(await rgb(sharp(pose)), leftPlateX)));
  for (const [index, { left, top, right, floor, leftGrip, rightGrip, leftPlate, rightPlate }] of measurements.entries()) {
    assert(left >= 20 && top >= 20 && right < tile - 20 && floor < tile - 20, `Clipped ${gender} pulldown pose`);
    assert(Math.abs(floor - measurements[0].floor) <= 1, `Unstable ${gender} floor anchor`);
    assert(leftGrip < tile && rightGrip < tile && Math.abs(leftGrip - rightGrip) <= 2, `Uneven ${gender} grip`);
    assert(leftPlate < tile && rightPlate < tile && Math.abs(leftPlate - rightPlate) <= 2, `Uneven ${gender} plates`);
    if (index > 0) {
      const previous = measurements[index - 1];
      assert(leftGrip > previous.leftGrip && rightGrip > previous.rightGrip, `Reversed ${gender} pull`);
      assert(leftPlate < previous.leftPlate && rightPlate < previous.rightPlate, `Reversed ${gender} plate travel`);
    }
  }

  const poster = `assets/motion-v18/${gender}-${exercise}-poster.webp`;
  const atlas = `assets/motion-v18/${gender}-${exercise}-atlas.webp`;
  const posterFile = path.join(root, 'dist', poster);
  const atlasFile = path.join(root, 'dist', atlas);
  const columns = Math.min(4, poses.length);
  const rows = Math.ceil(poses.length / columns);
  const position = index => ({ left: index % columns * tile, top: Math.floor(index / columns) * tile });

  await frame(prepared[0]).webp({ lossless: true, effort: 5 }).toFile(posterFile);
  await white(tile * columns, tile * rows).composite(prepared.map((input, index) => ({ input, ...position(index) })))
    .webp({ lossless: true, effort: 5 }).toFile(atlasFile);

  const expectedFrames = await Promise.all(prepared.map(pose => rgb(frame(pose))));
  assert((await rgb(sharp(posterFile))).equals(expectedFrames[0]), `Changed ${gender} poster pixels`);
  for (const [index, expected] of expectedFrames.entries()) {
    const packed = await sharp(atlasFile).extract({ ...position(index), width: tile, height: tile }).png().toBuffer();
    assert((await rgb(frame(packed))).equals(expected), `Changed ${gender} pose ${index} pixels`);
  }
  assert.equal(new Set(expectedFrames.map(sha256)).size, poses.length, `Duplicate ${gender} pose`);

  return {
    image: poster,
    poster,
    style: 'Controlled anime exercise loop',
    animation: {
      keyframes: sequence.length,
      uniquePoses: poses.length,
      duration_ms: delayMs.reduce((sum, delay) => sum + delay, 0),
      framing: 'Fixed camera; aligned seat and floor; controlled pull and return',
      nativeTransformVersion: 2,
      background: '#ffffff',
      crossfade: false,
      atlas,
      columns,
      frameWidth,
      frameHeight,
      delayMs,
      isometricHold: false,
      atlasFrameWidth: tile,
      atlasFrameHeight: tile,
      atlasOffsetX,
      atlasOffsetY,
      storedPoses: poses.length,
      poseSequence: sequence
    }
  };
}

async function build() {
  const { poses, delayMs } = read(path.join(sourceRoot, 'source-layout.json'));
  const cycleLength = delays => delays.reduce((sum, delay) => sum + delay, 0);
  assert.equal(cycleLength(delayMs.male), cycleLength(delayMs.female), 'Use the same cycle length for both variants');

  const catalogFile = path.join(root, 'dist/exercises.json');
  const catalog = read(catalogFile);
  const record = catalog.find(row => row.id === exercise);
  assert(record, 'Missing plate-loaded lat pulldown');
  const variants = {};
  const bindings = [];
  for (const gender of genders) {
    const outward = poses[gender].map((_, index) => index);
    const sequence = [...outward, ...outward.slice(1, -1).reverse()];
    assert.equal(sequence.length, delayMs[gender].length, 'Supply one duration for every phase');
    variants[gender] = await packVariant(gender, poses[gender], sequence, delayMs[gender]);
    const names = [...new Set(poses[gender].map(pose => pose.sheet))];
    const sources = names.map(name => fs.readFileSync(path.join(sourceRoot, 'sheets', name)));
    bindings.push({ exercise, variant: gender, sourceHash: sha256(Buffer.concat(sources)) });
  }
  Object.assign(record, variants.male, { variants });
  write(catalogFile, catalog);

  const releaseFile = path.join(root, 'dist/motion-release.json');
  const release = read(releaseFile);
  release.nativeSourceBindings = release.nativeSourceBindings.filter(binding => binding.exercise !== exercise);
  release.nativeSourceBindings.push(...bindings);
  release.nativeSourceBindings.sort((a, b) => a.exercise.localeCompare(b.exercise, 'en') || a.variant.localeCompare(b.variant, 'en'));
  const original = baseMotionRecords(catalog);
  release.keyframes = original.reduce((total, row) => total + Object.values(row.variants)
    .reduce((count, variant) => count + variant.animation.keyframes, 0), 0);
  release.pulldownRepair = { date: '2026-11-04', exercise, variants: genders.length,
    storedPosesPerVariant: Object.fromEntries(genders.map(gender => [gender, poses[gender].length])),
    sourceMethod: 'Built-in ImageGen whole-character redraw', pixelsVerified: true };
  write(releaseFile, release);
  write(path.join(root, 'dist/motion-package-manifest.json'), createManifest(root, release.nativeSourceBindings));
  const { nativeSourceBindings, ...result } = verifyPackage(root);
  console.log(JSON.stringify(result));
}

if (require.main === module) build().catch(error => { console.error(error); process.exitCode = 1; });
