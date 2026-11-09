/* Register hand and foot contacts to one fixed side view and pack the reviewed Burpee poses. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { createBurpeeManifest } = require('./verify-motion-package.cjs');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const sources = path.join(root, 'animation-source', 'burpee-motion');
const recipe = JSON.parse(fs.readFileSync(path.join(sources, 'reviewed-poses.json'), 'utf8'));
const id = 'exp-burpee', tile = 420, columns = 3, frameWidth = 600, frameHeight = 484;
const atlasOffsetX = 90, atlasOffsetY = 32, storedPoses = 9;
const sourceCell = 418, sourceMargin = 7;
const style = 'Controlled anime exercise loop';
const json = data => JSON.stringify(data, null, 2) + '\n';
const raw = (width, height) => ({ width, height, channels: 3 });

function blit(target, width, data, sourceWidth, left, top, firstRow, lastRow) {
  for (let row = firstRow; row < lastRow; row++) {
    const source = row * sourceWidth * 3;
    const destination = ((row + top) * width + left) * 3;
    data.copy(target, destination, source, source + sourceWidth * 3);
  }
}

async function prepare(art, spec, index, shiftX = spec.xShift[index]) {
  const [top, end, ground] = spec.rows[Math.floor(index / columns)];
  const width = Math.round((sourceCell - sourceMargin * 2) * recipe.scale);
  const height = Math.round((end - top) * recipe.scale);
  const left = Math.round((tile - sourceCell * recipe.scale) / 2 + (sourceMargin + shiftX) * recipe.scale);
  const y = recipe.floorY - Math.round((ground - top) * recipe.scale);
  const data = await sharp(art).extract({
    left: (index % columns) * sourceCell + sourceMargin, top, width: sourceCell - sourceMargin * 2, height: end - top
  }).resize(width, height, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  assert(left >= 0 && left + width <= tile && y >= 0 && y + height <= tile, 'Registration falls outside the atlas tile');
  const sprite = Buffer.alloc(tile * tile * 3, 255);
  blit(sprite, tile, data, width, left, y, 0, height);
  for (let pixel = 0; pixel < sprite.length; pixel += 3) {
    if (Math.min(sprite[pixel], sprite[pixel + 1], sprite[pixel + 2]) >= 245) sprite.fill(255, pixel, pixel + 3);
  }
  return sprite;
}

function compose(base, sprite, contacts, shiftX) {
  const ground = recipe.floorY;
  const result = Buffer.from(base);
  const lockStart = ground - 4, contactEnd = ground + 11;
  sprite.copy(result, 0, 0, lockStart * tile * 3);
  const ranges = contacts.map(([first, last]) => [first, last].map(x =>
    Math.round((tile - sourceCell * recipe.scale) / 2 + (x + shiftX) * recipe.scale)
  ));
  for (let y = lockStart; y < contactEnd; y++) {
    for (const [start, end] of ranges) {
      const first = (y * tile + start) * 3, last = (y * tile + end) * 3;
      sprite.copy(result, first, first, last);
    }
  }
  for (let y = lockStart; y < tile; y++) for (let x = 0; x < tile; x++) {
    if (y < contactEnd && ranges.some(([start, end]) => x >= start && x < end)) continue;
    const offset = (y * tile + x) * 3;
    assert.equal(result.readUIntBE(offset, 3), base.readUIntBE(offset, 3), 'Mat shifted away from a contact point');
  }
  return result;
}

function checkBorder(frame) {
  let artwork = 0;
  for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
    const p = (y * tile + x) * 3;
    if (Math.min(frame[p], frame[p + 1], frame[p + 2]) >= 165) continue;
    assert(x >= 15 && x < tile - 15 && y >= 18 && y < tile - 15, 'Clipped pose or source-cell border');
    artwork++;
  }
  assert(artwork > 2800, 'Incomplete pose');
}

async function encode(data, width, height) {
  const bytes = await sharp(data, {raw:raw(width, height)}).webp({lossless:true,effort:5}).toBuffer();
  const decoded = await sharp(bytes).removeAlpha().raw().toBuffer();
  assert(decoded.equals(data), 'Packed artwork pixels changed during encoding');
  return bytes;
}

async function pack(gender, spec) {
  const art = fs.readFileSync(path.join(sources, spec.sheet));
  const dimensions = await sharp(art).metadata();
  assert(dimensions.width === sourceCell * columns && dimensions.height === sourceCell * columns, 'Unexpected source sheet geometry');
  assert(spec.xShift.length === storedPoses && spec.contacts.length === storedPoses, 'Incomplete pose registration');
  const base = await prepare(art, spec, 7, 0);
  const poses = [];
  for (let index = 0; index < storedPoses; index++) {
    const sprite = await prepare(art, spec, index);
    const frame = compose(base, sprite, spec.contacts[index], spec.xShift[index]);
    checkBorder(frame);
    assert(!poses.some(pose => pose.equals(frame)), 'Repeated source pose');
    poses.push(frame);
  }
  const atlasWidth = columns * tile, atlasHeight = Math.ceil(poses.length / columns) * tile;
  const grid = Buffer.alloc(atlasWidth * atlasHeight * 3, 255);
  poses.forEach((frame, index) =>
    blit(grid, atlasWidth, frame, tile, (index % columns) * tile, Math.floor(index / columns) * tile, 0, tile)
  );
  const cover = Buffer.alloc(frameWidth * frameHeight * 3, 255);
  blit(cover, frameWidth, poses[0], tile, atlasOffsetX, atlasOffsetY, 0, tile);
  const prefix = 'assets/burpee-motion/' + gender + '-' + id;
  const poster = prefix + '-poster.webp', atlas = prefix + '-atlas.webp';
  const [posterBytes, atlasBytes] = await Promise.all([encode(cover, frameWidth, frameHeight), encode(grid, atlasWidth, atlasHeight)]);
  return {
    files: [[poster, posterBytes], [atlas, atlasBytes]],
    visual: {image:poster, poster, style, animation:{
      keyframes: recipe.sequence.length, uniquePoses: storedPoses, duration_ms: recipe.delayMs.reduce((sum, time) => sum + time, 0),
      framing:'Fixed side view with a pixel-locked mat and registered hand and foot contacts',
      nativeTransformVersion:2, background:'#ffffff', crossfade:false, atlas, columns, frameWidth, frameHeight,
      delayMs:recipe.delayMs, isometricHold:false, atlasFrameWidth:tile, atlasFrameHeight:tile,
      atlasOffsetX, atlasOffsetY, storedPoses, poseSequence:recipe.sequence
    }}
  };
}

async function main() {
  assert(recipe.sequence.length === recipe.delayMs.length && new Set(recipe.sequence).size === storedPoses &&
    recipe.sequence.every(i => Number.isInteger(i) && i >= 0 && i < storedPoses) &&
    recipe.delayMs.every(delay => Number.isInteger(delay) && delay > 0), 'Incomplete burpee timing');
  const results = await Promise.all(['male', 'female'].map(gender => pack(gender, recipe.variants[gender])));
  const variants = {male:results[0].visual, female:results[1].visual};
  const record = {
    id, name:'Burpee', aliases:['Burpees'], group:'Full body', equipment:'Bodyweight', difficulty:'Intermediate',
    tracking:'reps', supportsWeight:false, expansion:true,
    cues:[
      'Squat, plant your hands, and jump both feet back into a straight plank.',
      'Do a controlled push-up, then hop both feet back toward your hands.',
      'Jump with your arms overhead and land softly with bent knees.'
    ],
    guidanceUrl:'https://www.nasm.org/resource-center/exercise-library/squat-thrust-burpees',
    variants, ...variants.male
  };
  const catalogPath = path.join(dist, 'exercises.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const current = catalog.findIndex(exercise => exercise.id === id);
  const stepBack = catalog.findIndex(exercise => exercise.id === 'exp-step-back-burpee');
  assert(stepBack >= 0, 'The Step-Back Burpee entry is missing');
  if (current >= 0) catalog[current] = record;
  else catalog.splice(stepBack, 0, record);
  fs.mkdirSync(path.join(dist, 'assets', 'burpee-motion'), {recursive:true});
  for (const {files} of results) for (const [asset, bytes] of files) fs.writeFileSync(path.join(dist, asset), bytes);
  const manifest = createBurpeeManifest(root, record);
  fs.writeFileSync(path.join(dist, 'burpee-motion-manifest.json'), json(manifest));
  fs.writeFileSync(catalogPath, json(catalog));
  console.log('Packed both Burpee variants, ' + storedPoses + ' native poses and ' + recipe.sequence.length + ' playback steps each.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
