'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const dist = path.join(__dirname, '..', 'dist');
const rows = JSON.parse(fs.readFileSync(path.join(dist, 'exercises.json'), 'utf8'));

function artBounds(data, { width, channels }, animation) {
  const {
    columns, storedPoses, atlasFrameWidth: tileWidth, atlasFrameHeight: tileHeight,
    atlasOffsetX: offsetX, atlasOffsetY: offsetY
  } = animation;
  let left = tileWidth, top = tileHeight, right = 0, bottom = 0;
  for (let tile = 0; tile < storedPoses; tile++) {
    const x0 = (tile % columns) * tileWidth;
    const y0 = Math.floor(tile / columns) * tileHeight;
    for (let y = 0; y < tileHeight; y += 2) {
      const line = ((y0 + y) * width + x0) * channels;
      for (let x = 0; x < tileWidth; x += 2) {
        const index = line + x * channels;
        const light = Math.min(data[index], data[index + 1], data[index + 2]);
        if (light > 230) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  assert(left < right && top < bottom, 'Missing exercise artwork');
  // Include antialiasing and faint edges around the union of the full cycle.
  return [left + offsetX - 8, top + offsetY - 8, right + offsetX + 9, bottom + offsetY + 9];
}

async function guideFraming(animation) {
  const { data, info } = await sharp(path.join(dist, animation.atlas))
    .toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { frameWidth, frameHeight } = animation;
  const [left, top, right, bottom] = artBounds(data, info, animation);
  const maxScale = 1.55;
  const scale = Math.floor(1000 * Math.min(
    maxScale, (frameWidth - 48) / (right - left), (frameHeight - 36) / (bottom - top)
  )) / 1000;
  const x = Math.round((frameWidth - (left + right) * scale) / 2);
  const y = Math.round((frameHeight - (top + bottom) * scale) / 2);
  assert(scale >= 1 && x + left * scale >= 0 && y + top * scale >= 0 &&
    x + right * scale <= frameWidth && y + bottom * scale <= frameHeight,
  `Artwork exceeds fixed preview framing in ${animation.atlas}`);
  return [scale, x, y];
}

async function main() {
  const animations = new Map();
  for (const row of rows) {
    for (const { animation } of Object.values(row.variants)) {
      if (animation?.atlas) animations.set(path.basename(animation.atlas), animation);
    }
  }
  const entries = [...animations.entries()].sort(([a], [b]) => a.localeCompare(b, 'en'));
  const framed = [];
  for (let start = 0; start < entries.length; start += 6) {
    const batch = entries.slice(start, start + 6);
    framed.push(...await Promise.all(batch.map(async ([name, animation]) => [name, await guideFraming(animation)])));
  }
  const result = Object.fromEntries(framed);
  fs.writeFileSync(path.join(dist, 'motion-framing.json'), JSON.stringify(result) + '\n');
  console.log(`Fixed framing verified for ${framed.length} distinct animations`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
