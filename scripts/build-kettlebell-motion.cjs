/* Build the kettlebell supplement without changing the original motion proof. */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
let sharp;
try {
  sharp = require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  sharp = require('sharp');
}

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const style = 'Controlled anime exercise loop';
const frameWidth = 600, frameHeight = 484, cellSize = 420;
const columns = 4, storedPoses = 8, offsetX = 90, offsetY = 32;
const halfCycle = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1];
const circleBothDirections = [0, 1, 2, 3, 4, 5, 6, 7, 0, 7, 6, 5, 4, 3, 2, 1];
const specs = [
  {id: 'kettlebell-russian-twist', posterPose: 3, sequence: halfCycle, poseOrder: [0, 1, 5, 2, 3, 4, 6, 7]},
  {id: 'kettlebell-sit-up', posterPose: 0, sequence: halfCycle, poseOrder: [0, 1, 2, 3, 4, 5, 6, 7]},
  {id: 'kettlebell-halo', posterPose: 0, sequence: circleBothDirections, poseOrder: [0, 1, 2, 4, 3, 5, 6, 7]}
];
const layoutRelative = 'animation-source/kettlebell-motion/source-layout.json';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

function sourcePath(id) {
  return 'animation-source/kettlebell-motion/sheets/' + id + '.png';
}

function timing(spec) {
  return spec.sequence.map(pose => spec.id === 'kettlebell-halo'
    ? (pose === 0 ? 320 : 240)
    : (pose === 0 || pose === 7 ? 440 : 260));
}

function foreground(data, width, x, y) {
  const index = (y * width + x) * 3;
  const r = data[index], g = data[index + 1], b = data[index + 2];
  return Math.min(r, g, b) < 150 || Math.max(r, g, b) - Math.min(r, g, b) > 45;
}

function foregroundRuns(projection, maximumGap) {
  const runs = [];
  let start = -1, last = -1;
  for (let position = 0; position < projection.length; position++) {
    if (!projection[position]) continue;
    if (start < 0) start = position;
    else if (position - last > maximumGap + 1) {
      runs.push([start, last]);
      start = position;
    }
    last = position;
  }
  if (start >= 0) runs.push([start, last]);
  return runs;
}

function gapBoundaries(runs, limit) {
  return [0, ...runs.slice(1).map((run, index) => Math.floor((runs[index][1] + run[0]) / 2) + 1), limit];
}

async function prepareLayout() {
  const records = [];
  for (const spec of specs) {
    const source = sourcePath(spec.id), bytes = fs.readFileSync(path.join(root, source));
    const {data, info} = await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject: true});
    assert.equal(info.width, info.height, 'Source sheet must be square: ' + spec.id);
    const rowProjection = Array(info.height).fill(0);
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (foreground(data, info.width, x, y)) rowProjection[y]++;
    }
    const rowRuns = foregroundRuns(rowProjection, 8);
    assert.equal(rowRuns.length, 4, 'Expected four separate complete artwork rows: ' + spec.id);
    const rowBoundaries = gapBoundaries(rowRuns, info.height), cells = [];
    for (let row = 0; row < 4; row++) {
      const [rowStart, rowEnd] = rowRuns[row], projection = Array(info.width).fill(0);
      for (let y = rowStart; y <= rowEnd; y++) for (let x = 0; x < info.width; x++) {
        if (foreground(data, info.width, x, y)) projection[x]++;
      }
      const columnRuns = foregroundRuns(projection, 1);
      assert.equal(columnRuns.length, 4, 'Expected four complete figures in artwork row: ' + spec.id + ':' + row);
      const columnBoundaries = gapBoundaries(columnRuns, info.width);
      for (let column = 0; column < 4; column++) {
        const [left, right] = columnRuns[column];
        let top = info.height, bottom = -1;
        for (let y = rowStart; y <= rowEnd; y++) for (let x = left; x <= right; x++) {
          if (foreground(data, info.width, x, y)) {top = Math.min(top, y); bottom = Math.max(bottom, y);}
        }
        let shoeLeft = info.width, shoeRight = -1;
        for (let y = Math.max(top, bottom - 44); y <= bottom; y++) for (let x = left; x <= right; x++) {
          const index = (y * info.width + x) * 3, r = data[index], g = data[index + 1], b = data[index + 2];
          if (r > 65 && g < r * 0.65 && b < r * 0.65) {shoeLeft = Math.min(shoeLeft, x); shoeRight = Math.max(shoeRight, x);}
        }
        assert(shoeRight >= shoeLeft, 'Missing red shoe registration: ' + spec.id + ':' + cells.length);
        const regionLeft = Math.max(columnBoundaries[column], left - 12);
        const regionTop = Math.max(rowBoundaries[row], top - 12);
        const regionRight = Math.min(columnBoundaries[column + 1], right + 13);
        const regionBottom = Math.min(rowBoundaries[row + 1], bottom + 13);
        cells.push({
          index: cells.length,
          region: {left: regionLeft, top: regionTop, width: regionRight - regionLeft, height: regionBottom - regionTop},
          foregroundBounds: {left, top, right, bottom},
          anchor: {x: spec.id === 'kettlebell-sit-up' ? shoeRight : Math.round((shoeLeft + shoeRight) / 2), y: bottom}
        });
      }
    }
    records.push({
      id: spec.id, sourcePath: source, sourceSha256: sha256(bytes), width: info.width, height: info.height,
      uniformScale: 1.1, targetAnchor: {x: spec.id === 'kettlebell-sit-up' ? 385 : 210, y: 386},
      poseOrder: [...spec.poseOrder], cells
    });
  }
  writeJson(path.join(root, layoutRelative), {schemaVersion: 1, records});
  console.log('Prepared 48 complete native regions with one uniform scale per exercise and red-shoe translation anchors.');
}

async function writeWebp(relative, pipeline, options, files) {
  const file = path.join(dist, ...relative.split('/'));
  await pipeline.webp({lossless: true, effort: 5, ...options}).toFile(file);
  const bytes = fs.readFileSync(file);
  files.push({path: relative, sha256: sha256(bytes), bytes: bytes.length});
  return file;
}

async function buildVariant(spec, gender, sheet, layout, files, reviewFrames) {
  const firstCell = gender === 'male' ? 0 : 8;
  const poses = [];
  for (let pose = 0; pose < storedPoses; pose++) {
    const native = layout.cells[firstCell + layout.poseOrder[pose]], region = native.region;
    const scale = sheet.size / layout.width;
    const left = Math.floor(region.left * scale), top = Math.floor(region.top * scale);
    const width = Math.ceil((region.left + region.width) * scale) - left;
    const height = Math.ceil((region.top + region.height) * scale) - top;
    const translationX = layout.targetAnchor.x - (Math.round(native.anchor.x * scale) - left);
    const translationY = layout.targetAnchor.y - (Math.round(native.anchor.y * scale) - top);
    assert(translationX >= 0 && translationY >= 0 && translationX + width <= cellSize && translationY + height <= cellSize,
      'Whole native rectangle does not fit the fixed cell: ' + spec.id + ':' + gender + ':' + pose);
    const bounds = native.foregroundBounds;
    const positioned = {
      left: layout.targetAnchor.x + (bounds.left - native.anchor.x) * scale,
      top: layout.targetAnchor.y + (bounds.top - native.anchor.y) * scale,
      right: layout.targetAnchor.x + (bounds.right - native.anchor.x) * scale,
      bottom: layout.targetAnchor.y + (bounds.bottom - native.anchor.y) * scale
    };
    assert(positioned.left >= 8 && positioned.top >= 8 && positioned.right <= cellSize - 8 && positioned.bottom <= cellSize - 8,
      'Complete figure needs a larger common margin: ' + spec.id + ':' + gender + ':' + pose);
    const nativeCell = await sharp(sheet.pixels).extract({left, top, width, height}).png().toBuffer();
    poses.push(await sharp({create: {width: cellSize, height: cellSize, channels: 3, background: '#ffffff'}})
      .composite([{input: nativeCell, left: translationX, top: translationY}]).removeAlpha().raw().toBuffer());
  }
  // Each complete native region uses the same source resize and only translates.
  const frames = await Promise.all(poses.map(pose => sharp({
    create: {width: frameWidth, height: frameHeight, channels: 3, background: '#ffffff'}
  }).composite([{
    input: pose,
    raw: {width: cellSize, height: cellSize, channels: 3},
    left: offsetX,
    top: offsetY
  }]).removeAlpha().raw().toBuffer()));
  reviewFrames.push({id: spec.id, gender, frames});
  const stem = 'assets/kettlebell-motion/' + gender + '-' + spec.id;
  const image = stem + '-animated.webp', poster = stem + '-poster.webp', atlas = stem + '-atlas.webp';
  const delayMs = timing(spec);
  assert.equal(delayMs.reduce((sum, delay) => sum + delay, 0), 4000);
  const animation = {
    frameWidth, frameHeight,
    atlasFrameWidth: cellSize, atlasFrameHeight: cellSize,
    atlasOffsetX: offsetX, atlasOffsetY: offsetY,
    columns, storedPoses,
    poseSequence: [...spec.sequence], keyframes: spec.sequence.length,
    delayMs, duration_ms: 4000,
    background: '#ffffff', crossfade: false, playbackMode: 'loop', atlas
  };
  const animatedFile = await writeWebp(image, sharp(Buffer.concat(spec.sequence.map(pose => frames[pose])), {
    raw: {width: frameWidth, height: frameHeight * spec.sequence.length, channels: 3, pageHeight: frameHeight}
  }), {loop: 0, delay: delayMs}, files);
  const posterFile = await writeWebp(poster, sharp(frames[spec.posterPose], {
    raw: {width: frameWidth, height: frameHeight, channels: 3}
  }), {}, files);
  const atlasFile = await writeWebp(atlas, sharp({
    create: {width: columns * cellSize, height: 2 * cellSize, channels: 3, background: '#ffffff'}
  }).composite(poses.map((pose, index) => ({
    input: pose,
    raw: {width: cellSize, height: cellSize, channels: 3},
    left: index % columns * cellSize,
    top: Math.floor(index / columns) * cellSize
  }))), {}, files);

  const encoded = await sharp(animatedFile, {animated: true}).metadata();
  assert.equal(encoded.width, frameWidth);
  assert.equal(encoded.pageHeight, frameHeight);
  assert.equal(encoded.pages, spec.sequence.length);
  assert.equal(encoded.loop, 0);
  assert.deepEqual(encoded.delay, delayMs);
  const decodedFrames = await sharp(animatedFile, {animated: true}).removeAlpha().raw().toBuffer();
  assert(decodedFrames.equals(Buffer.concat(spec.sequence.map(pose => frames[pose]))), 'Animation pixels changed: ' + stem);
  assert((await sharp(posterFile).removeAlpha().raw().toBuffer()).equals(frames[spec.posterPose]), 'Poster pixels changed: ' + stem);
  for (let pose = 0; pose < storedPoses; pose++) {
    const decoded = await sharp(atlasFile).extract({
      left: pose % columns * cellSize, top: Math.floor(pose / columns) * cellSize,
      width: cellSize, height: cellSize
    }).removeAlpha().raw().toBuffer();
    assert(decoded.equals(poses[pose]), 'Atlas pixels changed: ' + stem + ':' + pose);
  }
  return {image, poster, style, animation};
}

async function build() {
  const catalogFile = path.join(dist, 'exercises.json');
  const catalog = readJson(catalogFile);
  for (const spec of specs) {
    assert.equal(catalog.filter(record => record.id === spec.id).length, 1, 'Missing or duplicate catalog exercise: ' + spec.id);
    assert(fs.existsSync(path.join(root, sourcePath(spec.id))), 'Missing source sheet: ' + sourcePath(spec.id));
  }
  fs.mkdirSync(path.join(dist, 'assets/kettlebell-motion'), {recursive: true});
  const layoutFile = path.join(root, layoutRelative), layoutBytes = fs.readFileSync(layoutFile), sourceLayout = JSON.parse(layoutBytes.toString('utf8'));
  assert.equal(sourceLayout.schemaVersion, 1);
  assert.equal(sourceLayout.records.length, 3);
  const records = [], files = [], sourceSheets = [], reviewFrames = [];
  for (const spec of specs) {
    const relative = sourcePath(spec.id), source = path.join(root, relative);
    const bytes = fs.readFileSync(source), metadata = await sharp(bytes).metadata();
    const layout = sourceLayout.records.find(record => record.id === spec.id);
    assert(layout && layout.sourcePath === relative && layout.sourceSha256 === sha256(bytes), 'Reviewed source layout does not match the native sheet: ' + relative);
    assert(metadata.width === layout.width && metadata.height === layout.height && layout.width === layout.height, 'Source dimensions changed: ' + relative);
    assert.equal(layout.uniformScale, 1.1, 'Unreviewed common artwork scale: ' + relative);
    assert.deepEqual(layout.poseOrder, spec.poseOrder, 'Unreviewed native pose order: ' + relative);
    assert.equal(layout.cells.length, 16);
    sourceSheets.push({path: relative, sha256: sha256(bytes)});
    // A single resize applies to the entire native sheet, before region extraction.
    const size = Math.round(metadata.width * layout.uniformScale);
    const sheet = {size, pixels: await sharp(bytes).resize(size, size).flatten({background: '#ffffff'}).removeAlpha().png().toBuffer()};
    const variants = {};
    for (const gender of ['male', 'female']) variants[gender] = await buildVariant(spec, gender, sheet, layout, files, reviewFrames);
    records.push({id: spec.id, variants});
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  const manifest = {schemaVersion: 1, records, files, sourceSheets, sourceLayout: {path: layoutRelative, sha256: sha256(layoutBytes)}};
  assert.equal(files.length, 18);
  for (const record of records) {
    const exercise = catalog.find(value => value.id === record.id);
    delete exercise.illustratedGuide;
    Object.assign(exercise, {
      kettlebellAnimation: true, style,
      image: record.variants.male.image, poster: record.variants.male.poster,
      animation: record.variants.male.animation, variants: record.variants
    });
  }
  writeJson(path.join(dist, 'kettlebell-motion-manifest.json'), manifest);
  writeJson(catalogFile, catalog);
  const reviewDirectory = path.join(root, 'animation-source/kettlebell-motion/review');
  fs.mkdirSync(reviewDirectory, {recursive: true});
  for (const review of reviewFrames) {
    await sharp({create: {width: frameWidth * 4, height: frameHeight * 2, channels: 3, background: '#ffffff'}})
      .composite(review.frames.map((frame, index) => ({input: frame, raw: {width: frameWidth, height: frameHeight, channels: 3},
        left: index % 4 * frameWidth, top: Math.floor(index / 4) * frameHeight})))
      .png().toFile(path.join(reviewDirectory, review.gender + '-' + review.id + '-contact.png'));
  }
  console.log('Built 3 kettlebell demonstrations, 6 variants, and 18 lossless assets.');
  return manifest;
}

module.exports = {build, prepareLayout};
if (require.main === module) (process.argv.includes('--prepare-layout') ? prepareLayout() : build())
  .catch(error => {console.error(error); process.exitCode = 1;});
