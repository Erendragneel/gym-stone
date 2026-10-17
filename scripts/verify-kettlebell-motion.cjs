/* Portable, read-only gate for the separately manifested kettlebell supplement. */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MANIFEST_PATH = 'dist/kettlebell-motion-manifest.json';
const IDS = ['kettlebell-russian-twist', 'kettlebell-sit-up', 'kettlebell-halo'];
const GENDERS = ['male', 'female'];
const STYLE = 'Controlled anime exercise loop';
const HALF_CYCLE = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1];
const HALO_CYCLE = [0, 1, 2, 3, 4, 5, 6, 7, 0, 7, 6, 5, 4, 3, 2, 1];
const LAYOUT_PATH = 'animation-source/kettlebell-motion/source-layout.json';
const POSE_ORDERS = {
  'kettlebell-russian-twist': [0, 1, 5, 2, 3, 4, 6, 7],
  'kettlebell-sit-up': [0, 1, 2, 3, 4, 5, 6, 7],
  'kettlebell-halo': [0, 1, 2, 4, 3, 5, 6, 7]
};
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const owned = value => Object.fromEntries(['image', 'poster', 'style', 'animation'].map(key => [key, value[key]]));

function ordinaryFile(stage, relative) {
  assert(typeof relative === 'string' && relative.length && !relative.includes('\\') && !path.posix.isAbsolute(relative) && !relative.split('/').some(part => !part || part === '.' || part === '..'), 'Unsafe supplement path: ' + relative);
  const base = path.resolve(stage), file = path.resolve(base, ...relative.split('/'));
  assert(file.startsWith(base + path.sep), 'Supplement path escaped the checkout');
  let current = base;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    assert(!fs.lstatSync(current).isSymbolicLink(), 'Symlink in kettlebell supplement: ' + relative);
  }
  assert(fs.lstatSync(file).isFile(), 'Supplement entry is not an ordinary file: ' + relative);
  return file;
}

function keys(value, expected, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Invalid ' + label);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), 'Unexpected fields in ' + label);
}

function present(stage, relative) {
  try { fs.lstatSync(path.join(stage, ...relative.split('/'))); return true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; return false; }
}

function verifySourceLayout(stage, proof, sourceSheets) {
  keys(proof, ['path', 'sha256'], 'kettlebell source layout proof');
  assert.equal(proof.path, LAYOUT_PATH, 'Invalid kettlebell source layout path');
  assert(typeof proof.sha256 === 'string' && /^[a-f0-9]{64}$/.test(proof.sha256), 'Invalid kettlebell source layout hash');
  if (!present(stage, proof.path)) return false;
  const bytes = fs.readFileSync(ordinaryFile(stage, proof.path));
  assert.equal(sha256(bytes), proof.sha256, 'Kettlebell source layout hash changed');
  const layout = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  keys(layout, ['schemaVersion', 'records'], 'kettlebell source layout');
  assert.equal(layout.schemaVersion, 1, 'Unsupported kettlebell source layout');
  assert(Array.isArray(layout.records) && layout.records.length === 3, 'Kettlebell source layout requires three records');
  assert.deepEqual(layout.records.map(record => record.id).sort(), [...IDS].sort(), 'Kettlebell source layout IDs changed');
  for (const record of layout.records) {
    const label = record.id;
    keys(record, ['id', 'sourcePath', 'sourceSha256', 'width', 'height', 'uniformScale', 'targetAnchor', 'poseOrder', 'cells'], 'source layout: ' + label);
    const source = sourceSheets.find(value => value.path === 'animation-source/kettlebell-motion/sheets/' + record.id + '.png');
    assert(source && record.sourcePath === source.path && record.sourceSha256 === source.sha256, 'Source layout is not bound to its native sheet: ' + label);
    assert(Number.isSafeInteger(record.width) && record.width > 0 && record.height === record.width, 'Invalid source layout dimensions: ' + label);
    assert.equal(record.uniformScale, 1.1, 'Unreviewed source artwork scale: ' + label);
    assert.deepEqual(record.targetAnchor, {x: record.id === 'kettlebell-sit-up' ? 385 : 210, y: 386}, 'Unreviewed source artwork anchor: ' + label);
    assert.deepEqual(record.poseOrder, POSE_ORDERS[record.id], 'Unreviewed source pose order: ' + label);
    assert(Array.isArray(record.cells) && record.cells.length === 16, 'Source layout requires sixteen complete native regions: ' + label);
    const scale = Math.round(record.width * record.uniformScale) / record.width;
    for (let index = 0; index < record.cells.length; index++) {
      const cell = record.cells[index], cellLabel = label + ':' + index;
      keys(cell, ['index', 'region', 'foregroundBounds', 'anchor'], 'source cell: ' + cellLabel);
      assert.equal(cell.index, index, 'Source cell order changed: ' + cellLabel);
      keys(cell.region, ['left', 'top', 'width', 'height'], 'source region: ' + cellLabel);
      keys(cell.foregroundBounds, ['left', 'top', 'right', 'bottom'], 'source foreground: ' + cellLabel);
      keys(cell.anchor, ['x', 'y'], 'source anchor: ' + cellLabel);
      const region = cell.region, bounds = cell.foregroundBounds, anchor = cell.anchor;
      assert([...Object.values(region), ...Object.values(bounds), ...Object.values(anchor)].every(Number.isSafeInteger), 'Noninteger source geometry: ' + cellLabel);
      assert(region.left >= 0 && region.top >= 0 && region.width > 0 && region.height > 0 && region.left + region.width <= record.width && region.top + region.height <= record.height, 'Source region escaped the native sheet: ' + cellLabel);
      assert(bounds.left >= region.left && bounds.top >= region.top && bounds.right >= bounds.left && bounds.bottom >= bounds.top && bounds.right < region.left + region.width && bounds.bottom < region.top + region.height, 'Native foreground is clipped by source region: ' + cellLabel);
      assert(anchor.x >= bounds.left && anchor.x <= bounds.right && anchor.y === bounds.bottom, 'Source shoe anchor is outside the foreground: ' + cellLabel);
      const left = Math.floor(region.left * scale), top = Math.floor(region.top * scale);
      const width = Math.ceil((region.left + region.width) * scale) - left;
      const height = Math.ceil((region.top + region.height) * scale) - top;
      const x = record.targetAnchor.x - (Math.round(anchor.x * scale) - left);
      const y = record.targetAnchor.y - (Math.round(anchor.y * scale) - top);
      assert(x >= 0 && y >= 0 && x + width <= 420 && y + height <= 420, 'Registered native region escaped its atlas cell: ' + cellLabel);
      assert(record.targetAnchor.x + (bounds.left - anchor.x) * scale >= 8 && record.targetAnchor.y + (bounds.top - anchor.y) * scale >= 8 && record.targetAnchor.x + (bounds.right - anchor.x) * scale <= 412 && record.targetAnchor.y + (bounds.bottom - anchor.y) * scale <= 412, 'Native foreground lost its outer cell margin: ' + cellLabel);
      for (const other of record.cells.slice(0, index)) {
        const previous = other.region;
        assert(region.left >= previous.left + previous.width || previous.left >= region.left + region.width || region.top >= previous.top + previous.height || previous.top >= region.top + region.height, 'Native source regions overlap: ' + cellLabel);
      }
    }
    if (present(stage, source.path)) {
      const native = fs.readFileSync(ordinaryFile(stage, source.path));
      assert(native.length >= 24 && native.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && native.toString('ascii', 12, 16) === 'IHDR', 'Native source is not a PNG: ' + label);
      assert.equal(native.readUInt32BE(16), record.width, 'Native source width differs from its layout: ' + label);
      assert.equal(native.readUInt32BE(20), record.height, 'Native source height differs from its layout: ' + label);
    }
  }
  return true;
}

function expectedVariant(id, gender) {
  const stem = 'assets/kettlebell-motion/' + gender + '-' + id;
  const poseSequence = id === 'kettlebell-halo' ? HALO_CYCLE : HALF_CYCLE;
  const delayMs = poseSequence.map(pose => id === 'kettlebell-halo' ? (pose === 0 ? 320 : 240) : (pose === 0 || pose === 7 ? 440 : 260));
  return {
    image: stem + '-animated.webp', poster: stem + '-poster.webp', style: STYLE,
    animation: {
      frameWidth: 600, frameHeight: 484,
      atlasFrameWidth: 420, atlasFrameHeight: 420,
      atlasOffsetX: 90, atlasOffsetY: 32, columns: 4, storedPoses: 8,
      poseSequence: [...poseSequence], keyframes: poseSequence.length, delayMs,
      duration_ms: 4000, background: '#ffffff', crossfade: false,
      playbackMode: 'loop', atlas: stem + '-atlas.webp'
    }
  };
}

// Inspect the lossless WebP containers using only Node. Pixel identity is checked
// by the build/independent decode audit; the deploy gate needs no native decoder.
function webpInfo(bytes, label) {
  assert(bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP', 'Invalid WebP: ' + label);
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, 'Invalid RIFF length: ' + label);
  const chunks = (buffer, start, end) => {
    const result = [];
    let offset = start;
    while (offset < end) {
      assert(offset + 8 <= end, 'Truncated WebP chunk: ' + label);
      const type = buffer.toString('ascii', offset, offset + 4), size = buffer.readUInt32LE(offset + 4);
      const next = offset + 8 + size + size % 2;
      assert(next <= end, 'WebP chunk escaped container: ' + label);
      result.push({type, data: buffer.subarray(offset + 8, offset + 8 + size)});
      offset = next;
    }
    assert.equal(offset, end, 'Invalid WebP chunk padding: ' + label);
    return result;
  };
  const losslessSize = data => {
    assert(data.length >= 5 && data[0] === 0x2f, 'Invalid lossless WebP bitstream: ' + label);
    const bits = data.readUInt32LE(1);
    assert.equal(bits >>> 29, 0, 'Unsupported lossless WebP version: ' + label);
    return {width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1};
  };
  const top = chunks(bytes, 12, bytes.length);
  assert(top.every(chunk => ['VP8X', 'VP8L', 'ANIM', 'ANMF'].includes(chunk.type)), 'Unexpected or lossy WebP chunk: ' + label);
  const extended = top.filter(chunk => chunk.type === 'VP8X');
  const animations = top.filter(chunk => chunk.type === 'ANIM');
  const frames = top.filter(chunk => chunk.type === 'ANMF');
  const stills = top.filter(chunk => chunk.type === 'VP8L');
  assert(extended.length <= 1 && animations.length <= 1, 'Duplicate WebP header: ' + label);
  let canvas;
  if (extended.length) {
    const data = extended[0].data;
    assert.equal(data.length, 10, 'Invalid WebP extended header: ' + label);
    canvas = {width: data.readUIntLE(4, 3) + 1, height: data.readUIntLE(7, 3) + 1};
    assert.equal(Boolean(data[0] & 2), frames.length > 0, 'WebP animation flag mismatch: ' + label);
  }
  if (!frames.length) {
    assert.equal(animations.length, 0, 'Empty WebP animation: ' + label);
    assert.equal(stills.length, 1, 'Missing lossless WebP image: ' + label);
    const size = losslessSize(stills[0].data);
    if (canvas) assert.deepEqual(canvas, size, 'WebP canvas mismatch: ' + label);
    return {...size, frames: 1, delays: [], loop: null};
  }
  assert(canvas && animations.length === 1 && stills.length === 0, 'Invalid animated WebP structure: ' + label);
  assert.equal(animations[0].data.length, 6, 'Invalid WebP animation header: ' + label);
  const delays = [];
  for (const frame of frames) {
    const data = frame.data;
    assert(data.length >= 24, 'Truncated WebP animation frame: ' + label);
    const left = data.readUIntLE(0, 3) * 2, top = data.readUIntLE(3, 3) * 2;
    const width = data.readUIntLE(6, 3) + 1, height = data.readUIntLE(9, 3) + 1;
    assert(left + width <= canvas.width && top + height <= canvas.height && (data[15] & 0xfc) === 0, 'Invalid WebP frame bounds: ' + label);
    const images = chunks(data, 16, data.length);
    assert(images.length === 1 && images[0].type === 'VP8L', 'Animation frame is not lossless WebP: ' + label);
    assert.deepEqual(losslessSize(images[0].data), {width, height}, 'WebP frame size mismatch: ' + label);
    delays.push(data.readUIntLE(12, 3));
  }
  return {...canvas, frames: frames.length, delays, loop: animations[0].data.readUInt16LE(4)};
}

function verifyKettlebellMotion(stage, suppliedCatalog) {
  stage = path.resolve(stage);
  const catalog = suppliedCatalog || readJson(ordinaryFile(stage, 'dist/exercises.json'));
  assert(Array.isArray(catalog), 'Missing exercise catalog');
  const supplements = catalog.filter(record => IDS.includes(record?.id));
  assert.equal(supplements.length, 3, 'Kettlebell supplement requires exactly three exercises');
  assert.equal(new Set(supplements.map(record => record.id)).size, 3, 'Duplicate kettlebell exercise');
  const manifest = readJson(ordinaryFile(stage, MANIFEST_PATH));
  keys(manifest, ['schemaVersion', 'records', 'files', 'sourceSheets', 'sourceLayout'], 'kettlebell manifest');
  assert.equal(manifest.schemaVersion, 1, 'Unsupported kettlebell manifest');
  assert(Array.isArray(manifest.records) && manifest.records.length === 3, 'Kettlebell manifest requires three records');
  assert.deepEqual(manifest.records.map(record => record.id).sort(), [...IDS].sort(), 'Kettlebell manifest IDs changed');

  const expectedFiles = new Map();
  for (const id of IDS) {
    const record = supplements.find(value => value.id === id), proof = manifest.records.find(value => value.id === id);
    assert(record.kettlebellAnimation === true && record.illustratedGuide == null && record.equipment === 'Kettlebell' && record.tracking === 'reps' && record.expansion === true && record.supportsWeight === true, 'Invalid kettlebell metadata: ' + id);
    assert(record.gif == null, 'Legacy GIF in kettlebell exercise: ' + id);
    keys(proof, ['id', 'variants'], 'kettlebell manifest record: ' + id);
    keys(proof.variants, GENDERS, 'kettlebell manifest variants: ' + id);
    keys(record.variants, GENDERS, 'kettlebell catalog variants: ' + id);
    for (const gender of GENDERS) {
      const expected = expectedVariant(id, gender);
      assert.deepEqual(proof.variants[gender], expected, 'Unreviewed kettlebell animation metadata: ' + id + ':' + gender);
      assert.deepEqual(record.variants[gender], expected, 'Catalog differs from kettlebell manifest: ' + id + ':' + gender);
      assert.equal(expected.animation.delayMs.reduce((total, delay) => total + delay, 0), expected.animation.duration_ms);
      expectedFiles.set(expected.image, {width: 600, height: 484, frames: expected.animation.keyframes, delays: expected.animation.delayMs, loop: 0});
      expectedFiles.set(expected.poster, {width: 600, height: 484, frames: 1, delays: [], loop: null});
      expectedFiles.set(expected.animation.atlas, {width: 1680, height: 840, frames: 1, delays: [], loop: null});
    }
    assert.deepEqual(owned(record), proof.variants.male, 'Default kettlebell animation differs from male variant: ' + id);
  }

  assert(Array.isArray(manifest.files) && manifest.files.length === 18, 'Kettlebell manifest requires 18 asset files');
  assert.deepEqual(manifest.files.map(file => file.path).sort(), [...expectedFiles.keys()].sort(), 'Kettlebell asset inventory changed');
  for (const file of manifest.files) {
    keys(file, ['path', 'sha256', 'bytes'], 'kettlebell file');
    assert(/^assets\/kettlebell-motion\/(?:male|female)-kettlebell-(?:russian-twist|sit-up|halo)-(?:animated|poster|atlas)\.webp$/.test(file.path), 'Invalid kettlebell asset path');
    assert(typeof file.sha256 === 'string' && /^[a-f0-9]{64}$/.test(file.sha256) && Number.isSafeInteger(file.bytes) && file.bytes > 0, 'Invalid kettlebell file proof: ' + file.path);
    const bytes = fs.readFileSync(ordinaryFile(stage, 'dist/' + file.path));
    assert.equal(bytes.length, file.bytes, 'Kettlebell asset byte count changed: ' + file.path);
    assert.equal(sha256(bytes), file.sha256, 'Kettlebell asset hash changed: ' + file.path);
    assert.deepEqual(webpInfo(bytes, file.path), expectedFiles.get(file.path), 'Kettlebell WebP format or timing changed: ' + file.path);
  }
  const assetDirectory = path.join(stage, 'dist', 'assets', 'kettlebell-motion');
  const actualFiles = fs.readdirSync(assetDirectory, {withFileTypes: true}).map(entry => {
    assert(entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith('.webp'), 'Unexpected kettlebell asset entry: ' + entry.name);
    return 'assets/kettlebell-motion/' + entry.name;
  });
  assert.deepEqual(actualFiles.sort(), [...expectedFiles.keys()].sort(), 'Unmanifested kettlebell asset');

  assert(Array.isArray(manifest.sourceSheets) && manifest.sourceSheets.length === 3, 'Kettlebell manifest requires three source sheet hashes');
  const expectedSources = IDS.map(id => 'animation-source/kettlebell-motion/sheets/' + id + '.png');
  assert.deepEqual(manifest.sourceSheets.map(source => source.path).sort(), expectedSources.sort(), 'Kettlebell source sheet inventory changed');
  let sourceSheetsVerified = 0;
  for (const source of manifest.sourceSheets) {
    keys(source, ['path', 'sha256'], 'kettlebell source sheet');
    assert(typeof source.sha256 === 'string' && /^[a-f0-9]{64}$/.test(source.sha256), 'Invalid kettlebell source sheet hash');
    // The private deployment contains the proof but deliberately omits sources.
    if (present(stage, source.path)) {
      assert.equal(sha256(fs.readFileSync(ordinaryFile(stage, source.path))), source.sha256, 'Kettlebell source sheet hash changed: ' + source.path);
      sourceSheetsVerified++;
    }
  }
  const sourceLayoutVerified = verifySourceLayout(stage, manifest.sourceLayout, manifest.sourceSheets);
  assert(sourceSheetsVerified === 0 || sourceLayoutVerified, 'Native source sheets require their reviewed source layout');
  return {passed: true, exercises: 3, variants: 6, motionFiles: 18, sourceSheets: 3, sourceSheetsVerified, sourceLayoutVerified};
}

module.exports = {MANIFEST_PATH, IDS, verifyKettlebellMotion};
if (require.main === module) {
  try { console.log(JSON.stringify(verifyKettlebellMotion(process.argv[2] || '.'), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
