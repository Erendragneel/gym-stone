const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parse } = require('./dist/machine-label.js');

const cases = [
  ['FWHM-012\nLEG CURL', 'exact', ['prone-leg-curl']],
  ['FWHMO12', 'exact', ['prone-leg-curl']],
  ['ＦＷＨＭ–００７_Wide Lat Pulldown', 'exact', ['plate-loaded-lat-pulldown']],
  ['GYMLECO\nModel No. 244', 'exact', ['hack-squat']],
  ['362 GYM LECO', 'exact', ['standing-hip-abduction']],
  ['FWHM-012 FWHM-007', 'possible', ['prone-leg-curl', 'plate-loaded-lat-pulldown']],
  ['Leg Curl', 'possible', ['prone-leg-curl', 'seated-leg-curl', 'standing-leg-curl', 'kneeling-leg-curl']],
  ['Seated Leg Curl', 'possible', ['seated-leg-curl']],
  ['Wide Lat Pulldown', 'possible', ['plate-loaded-lat-pulldown', 'lat-pulldown']],
  ['Chest Press', 'possible', ['chest-press', 'incline-chest-press']],
  ['Incline Chest Press', 'possible', ['incline-chest-press']],
  ['Shoulder Press', 'possible', ['shoulder-press']],
  ['Pec Deck', 'possible', ['pec-deck', 'reverse-pec-deck']],
  ['Reverse Pec Deck', 'possible', ['reverse-pec-deck']],
  ['Seated Row', 'possible', ['seated-cable-row', 'chest-supported-row']],
  ['Chest-Supported Seated Row', 'possible', ['chest-supported-row']],
  ['Seated Cable Row', 'possible', ['seated-cable-row']],
  ['Leg Press / Hack Squat', 'possible', ['hack-squat', 'leg-press']],
  ['Cable Cross-Over', 'possible', ['cable-station']],
  ['Smith Machine', 'possible', ['smith-machine']],
  ['Stair Climber', 'possible', ['stair-climber']],
  ['FWHM-012 Chest Press', 'exact', ['prone-leg-curl']],
  ['PRESS ROW CABLE SMITH STAIR', 'unknown', []],
  ['244, 362, 007, 012', 'unknown', []],
  ['Other Brand Model 244', 'unknown', []],
  ['Gymleco 244 kg / Model 362A', 'unknown', []],
  ['GYMLECO 362.5 cm', 'unknown', []],
  ['FWHM-012A', 'unknown', []]
];
for (const [text, kind, machineIds] of cases) {
  assert.deepEqual({ kind: parse(text).kind, machineIds: parse(text).machineIds }, { kind, machineIds }, text);
}
console.log('PASS: machine labels, model precedence, ambiguity and false-positive guards.');

async function verifyBrowser(url) {
  const { chromium } = require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const base = new URL(url);
    const requests = [], errors = [];
    const fixture = new URL('verify-machine-label', base).href;
    await context.route(fixture, route => route.fulfill({
      contentType: 'text/html',
      body: '<script src="machine-label.js"></script>'
    }));
    page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(fixture);
    const ambiguous = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 250;
      const ink = canvas.getContext('2d');
      ink.fillStyle = 'white';
      ink.fillRect(0, 0, 720, 250);
      ink.fillStyle = 'black';
      ink.font = 'bold 90px Arial';
      ink.fillText('Leg Curl', 55, 145);
      return GymMachineLabel.recognize(canvas);
    });
    assert.equal(ambiguous.kind, 'possible', ambiguous.text);
    assert.equal(ambiguous.machineIds.length, 4);
    const cancelled = await page.evaluate(async () => {
      const controller = new AbortController();
      const canvas = document.createElement('canvas');
      controller.abort();
      try {
        await GymMachineLabel.recognize(canvas, { signal: controller.signal });
      } catch (error) {
        return error.name;
      }
    });
    assert.equal(cancelled, 'AbortError');
    const interrupted = await page.evaluate(async () => {
      const controller = new AbortController();
      try {
        await GymMachineLabel.recognize(document.createElement('canvas'), {
          signal: controller.signal,
          onProgress: () => controller.abort()
        });
      } catch (error) {
        return error.name;
      }
    });
    assert.equal(interrupted, 'AbortError');
    const remote = await page.evaluate(async () => {
      try {
        await GymMachineLabel.recognize('https://example.invalid/a-machine.jpg');
      } catch (error) {
        return error.message;
      }
    });
    assert.match(remote, /local photo/i);

    async function readPhoto(file, format, crop) {
      const src = 'data:image/' + format + ';base64,' + fs.readFileSync(file).toString('base64');
      return page.evaluate(async ({ src, crop }) => {
        const image = await createImageBitmap(await (await fetch(src)).blob());
        const [x, y, width, height] = crop || [0, 0, image.width, image.height];
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(image, x, y, width, height, 0, 0, width, height);
        image.close();
        return GymMachineLabel.recognize(canvas);
      }, { src, crop });
    }
    const forwardPhoto = process.env.GYM_MACHINE_LABEL_FORWARD_PHOTO;
    if (forwardPhoto) {
      const full = await readPhoto(forwardPhoto, 'jpeg');
      const crop = await readPhoto(forwardPhoto, 'jpeg', [460, 415, 470, 650]);
      assert.deepEqual(full.machineIds, ['prone-leg-curl'], full.text);
      assert.equal(full.kind, 'exact', full.text);
      assert.deepEqual(crop.machineIds, ['prone-leg-curl'], crop.text);
      assert.equal(crop.kind, 'exact', crop.text);
      const nameOnly = await readPhoto(forwardPhoto, 'jpeg', [540, 430, 310, 75]);
      assert.equal(nameOnly.kind, 'possible', nameOnly.text);
      assert.equal(nameOnly.machineIds.length, 4);
      console.log('PASS: Forward FWHM-012 full photo, label crop and ambiguous title-only crop.');
    }
    const pulldownPhoto = process.env.GYM_MACHINE_LABEL_PULLDOWN_PHOTO;
    if (pulldownPhoto) {
      const crop = await readPhoto(pulldownPhoto, 'png', [30, 1435, 625, 65]);
      assert.deepEqual(crop.machineIds, ['plate-loaded-lat-pulldown'], crop.text);
      assert.equal(crop.kind, 'exact', crop.text);
      console.log('PASS: Forward FWHM-007 label crop.');
    }
    assert(requests.some(request => request.url.includes('/vendor/ocr/worker.min.js')));
    assert(requests.every(request => request.method === 'GET'
      && (request.url.startsWith(base.origin + '/') || request.url.startsWith('data:'))), 'OCR must stay local');
    assert.deepEqual(errors, []);
    console.log('PASS: bundled OCR in Chromium, local-only requests and cancellation.');
  } finally {
    await browser.close();
  }
}

if (process.env.GYM_TEST_URL) {
  verifyBrowser(process.env.GYM_TEST_URL).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
