/* Equipment labels are read in this browser by the bundled OCR worker. */
(function (root, factory) {
  'use strict';
  const labels = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = labels;
  if (root.document) root.GymMachineLabel = labels;
})(globalThis, function (root) {
  'use strict';

  const forward = {
    '007': { id: 'plate-loaded-lat-pulldown', label: 'Forward FWHM-007 Wide Lat Pulldown' },
    '012': { id: 'prone-leg-curl', label: 'Forward FWHM-012 Lying Leg Curl' }
  };
  const gymleco = {
    '244': { id: 'hack-squat', label: 'Gymleco 244 Hacklift' },
    '362': { id: 'standing-hip-abduction', label: 'Gymleco 362 Standing Abductor' }
  };
  const brand = String.raw`GYM[\s-]*LECO`;
  const modelPrefix = String.raw`(?:SKU|MODEL(?:\s+(?:NO\.?|NUMBER|CODE))?|ART(?:ICLE)?\.?(?:\s*(?:NO\.?|NR\.?|NUMBER))?)`;
  // A weight, dimension or longer model number is not a Gymleco model match.
  const modelNumber = String.raw`(244|362)(?![A-Z0-9]|[.,]\d|-[A-Z0-9]|\s*(?:KG|LBS?|MM|CM)\b)`;
  const gymlecoCodes = [
    new RegExp(String.raw`\b${brand}\b\s*[:#®-]?\s*(?:${modelPrefix}\s*[:#-]?\s*)?${modelNumber}`, 'g'),
    new RegExp(String.raw`\b${modelNumber}\s*[:#-]?\s*${brand}\b`, 'g'),
    new RegExp(String.raw`\b${modelPrefix}\s*[:#-]?\s*${modelNumber}`, 'g')
  ];
  const gymlecoBrand = new RegExp(String.raw`\b${brand}\b`);

  const curlLabels = [
    { pattern: /\b(?:LYING|PRONE)[\s-]+(?:LEG|HAMSTRING)[\s-]+CURLS?\b/, ids: ['prone-leg-curl'], label: 'Lying Leg Curl' },
    { pattern: /\bSEATED[\s-]+(?:LEG|HAMSTRING)[\s-]+CURLS?\b/, ids: ['seated-leg-curl'], label: 'Seated Leg Curl' },
    { pattern: /\bSTANDING[\s-]+(?:LEG|HAMSTRING)[\s-]+CURLS?\b/, ids: ['standing-leg-curl'], label: 'Standing Leg Curl' },
    { pattern: /\bKNEELING[\s-]+(?:LEG|HAMSTRING)[\s-]+CURLS?\b/, ids: ['kneeling-leg-curl'], label: 'Kneeling Leg Curl' }
  ];
  const genericCurl = {
    pattern: /\b(?:LEG|HAMSTRING)[\s-]+CURLS?\b/,
    ids: curlLabels.flatMap(item => item.ids),
    label: 'Leg Curl'
  };
  const pulldownLabels = [
    { pattern: /\bPLATE[\s-]*LOADED[\s-]+(?:WIDE[\s-]+)?LAT[\s-]+PULL[\s-]*DOWN\b/, ids: ['plate-loaded-lat-pulldown'], label: 'Plate-loaded Lat Pulldown' },
    { pattern: /\b(?:CABLE|WEIGHT[\s-]*STACK)[\s-]+(?:WIDE[\s-]+)?LAT[\s-]+PULL[\s-]*DOWN\b/, ids: ['lat-pulldown'], label: 'Cable Lat Pulldown' }
  ];
  const genericPulldown = {
    pattern: /\bLAT[\s-]+PULL[\s-]*DOWN\b/,
    ids: pulldownLabels.flatMap(item => item.ids),
    label: 'Lat Pulldown'
  };
  // These specific labels must be removed before the broad chest/Smith/lat
  // patterns run, so a specialty station cannot fall back to a different guide.
  const specificLabels = [
    { pattern: /\bPENDULUM[\s-]+SQUAT(?:[\s-]+MACHINE)?\b/g, ids: ['pendulum-squat'], label: 'Pendulum Squat' },
    { pattern: /\bV[\s-]+SQUAT(?:[\s-]+MACHINE)?\b/g, ids: ['v-squat'], label: 'V-Squat' },
    { pattern: /\bSTANDING[\s-]+HIP[\s-]+THRUST(?:[\s-]+MACHINE)?\b/g, ids: ['standing-hip-thrust'], label: 'Standing Hip Thrust' },
    { pattern: /\bDECLINE[\s-]+(?:MACHINE[\s-]+)?CHEST[\s-]+PRESS(?:[\s-]+MACHINE)?\b/g, ids: ['decline-chest-press'], label: 'Decline Chest Press' },
    { pattern: /\bSTANDING[\s-]+(?:MACHINE[\s-]+)?CHEST[\s-]+PRESS(?:[\s-]+MACHINE)?\b/g, ids: ['standing-chest-press'], label: 'Standing Chest Press Machine' },
    { pattern: /\bINCLINE[\s-]+(?:MACHINE[\s-]+)?(?:CHEST[\s-]+)?FLY(?:[\s-]+MACHINE)?\b/g, ids: ['incline-machine-fly'], label: 'Incline Chest Fly Machine' },
    { pattern: /\b(?:UPRIGHT[\s-]+)?STATIONARY[\s-]+(?:BIKE|BICYCLE|CYCLING)\b/g, ids: ['stationary-bike'], label: 'Stationary Bike' },
    { pattern: /\bDUAL[\s-]+SMITH(?:[\s-]+MACHINE)?\b/g, ids: ['dual-smith'], label: 'Dual Smith — confirm model' },
    { pattern: /\bHIGH[\s-]+INCLINE(?:[\s-]+(?:MACHINE[\s-]+)?(?:CHEST[\s-]+)?PRESS(?:[\s-]+MACHINE)?)?\b/g, ids: ['high-incline'], label: 'High Incline — confirm setup' },
    { pattern: /\bVIKING[\s-]+(?:PRESS|MACHINE)\b/g, ids: ['viking-machine'], label: 'Viking Machine — confirm model' },
    { pattern: /\bSUPER[\s-]*HAND[\s-]+LAT[\s-]+PULL[\s-]*DOWN\b/g, ids: ['super-hand-pulldown'], label: 'Super Hand Lat Pulldown — confirm model' },
    { pattern: /\bMULTI[\s-]+PULL[\s-]*DOWN\b/g, ids: ['multi-pulldown'], label: 'Multi-Pulldown — confirm model' },
    { pattern: /\bFRENCH[\s-]+PRESS[\s-]+MACHINE\b/g, ids: ['french-press-machine'], label: 'French Press Machine — confirm setup' },
    { pattern: /\bDIP[\s-]+MACHINE\b/g, ids: ['dip-machine'], label: 'Dip Machine — confirm setup' },
    { pattern: /\bT[\s-]+BAR[\s-]+ROW[\s-]+MACHINE\b/g, ids: ['t-bar-row-machine'], label: 'T-Bar Row Machine — confirm setup' },
    { pattern: /\bGLUTE[\s-]+KICK[\s-]*BACK[\s-]+MACHINE\b/g, ids: ['glute-kickback-machine'], label: 'Glute Kickback Machine — confirm setup' },
    { pattern: /\b(?:ABDOMINAL|AB)[\s-]+BENCH\b/g, ids: ['ab-bench'], label: 'Abdominal Bench — confirm setup' },
    { pattern: /\bPOWER[\s-]+RACK\b/g, ids: ['power-rack'], label: 'Power Rack' },
    { pattern: /\bEZ[\s-]+(?:CURL[\s-]+)?BAR\b/g, ids: ['ez-bar'], label: 'EZ Curl Bar' },
    { pattern: /\bPREACHER[\s-]+(?:CURL[\s-]+)?(?:BENCH|STAND)\b/g, ids: ['preacher-bench'], label: 'Preacher Curl Bench' },
    { pattern: /\bINCLINE[\s-]+BENCH\b/g, ids: ['incline-bench'], label: 'Incline Bench' },
    { pattern: /\bTREADMILL\b/g, ids: ['treadmill'], label: 'Treadmill' },
    { pattern: /\bDUMBBELLS?\b/g, ids: ['dumbbells'], label: 'Dumbbells' }
  ];
  const otherLabels = [
    { pattern: /\bHACK[\s-]*(?:LIFT|SQUAT)\b/, ids: ['hack-squat'], label: 'Hack Squat' },
    { pattern: /\bSTANDING[\s-]+(?:HIP[\s-]+)?ABDUCT(?:OR|ION)\b/, ids: ['standing-hip-abduction'], label: 'Standing Abductor' },
    { pattern: /\bLEG[\s-]+EXTENSION\b/, ids: ['leg-extension'], label: 'Leg Extension' },
    { pattern: /\bLEG[\s-]+PRESS\b/, ids: ['leg-press'], label: 'Leg Press' },
    { pattern: /\bINCLINE[\s-]+CHEST[\s-]+PRESS\b/, ids: ['incline-chest-press'], label: 'Incline Chest Press' },
    { pattern: /\bCHEST[\s-]+PRESS\b/, without: /\b(?:INCLINE|DECLINE|STANDING)(?:[\s-]+(?:CABLE|BARBELL|DUMBBELL|MACHINE))?[\s-]+CHEST[\s-]+PRESS\b/g, ids: ['chest-press', 'incline-chest-press'], label: 'Chest Press' },
    { pattern: /\bSHOULDER[\s-]+PRESS\b/, ids: ['shoulder-press'], label: 'Shoulder Press' },
    { pattern: /\b(?:REVERSE[\s-]+PEC[\s-]+DECK|REAR[\s-]+DELT[\s-]+FLY)\b/, ids: ['reverse-pec-deck'], label: 'Reverse Pec Deck' },
    { pattern: /\bPEC[\s-]+DECK\b/, without: /\bREVERSE[\s-]+PEC[\s-]+DECK\b/g, ids: ['pec-deck', 'reverse-pec-deck'], label: 'Pec Deck' },
    { pattern: /\bCHEST[\s-]+SUPPORTED[\s-]+(?:SEATED[\s-]+)?ROW\b/, ids: ['chest-supported-row'], label: 'Chest-supported Row' },
    { pattern: /\bSEATED[\s-]+CABLE[\s-]+ROW\b/, ids: ['seated-cable-row'], label: 'Seated Cable Row' },
    { pattern: /\bSEATED[\s-]+ROW\b/, without: /\bCHEST[\s-]+SUPPORTED[\s-]+SEATED[\s-]+ROW\b/g, ids: ['seated-cable-row', 'chest-supported-row'], label: 'Seated Row' },
    { pattern: /\bCABLE[\s-]+CROSS[\s-]*OVER\b/, ids: ['cable-station'], label: 'Cable Crossover' },
    { pattern: /\bSMITH[\s-]+MACHINE\b/, ids: ['smith-machine'], label: 'Smith Machine' },
    { pattern: /\bSTAIR[\s-]*(?:CLIMBER|MILL)\b/, ids: ['stair-climber'], label: 'Stair Climber' }
  ];

  function parse(value) {
    const text = typeof value === 'string' ? value.trim().slice(0, 2000) : '';
    const normalized = text.normalize('NFKC').toUpperCase().replace(/[\u2010-\u2015\u2212]/g, '-');
    const models = new Set();
    // OCR can read a printed zero as O. Limit that correction to known FWHM codes.
    for (const match of normalized.matchAll(/\bFWHM[\s-]*([0O][0O]7|[0O]12)(?![A-Z0-9]|[.-][A-Z0-9])/g)) {
      models.add(forward[match[1].replaceAll('O', '0')]);
    }
    if (gymlecoBrand.test(normalized)) {
      for (const pattern of gymlecoCodes) {
        for (const match of normalized.matchAll(pattern)) models.add(gymleco[match[1]]);
      }
    }
    if (models.size) {
      const matches = [...models];
      return {
        kind: models.size === 1 ? 'exact' : 'possible',
        machineIds: [...new Set(matches.map(item => item.id))],
        text,
        label: models.size === 1 ? matches[0].label : ''
      };
    }

    const machineData = root.GymMachineData || (typeof module === 'object' && module.exports ? require('./machine-data.js') : null);
    // Manual/pasted Japanese labels are supported independently of OCR. The
    // bundled OCR worker below still reads English; this does not claim Japanese OCR.
    const exactLabels = machineData?.labelMatches(text) || [];
    if (exactLabels.length && (/[\u3040-\u30ff\u3400-\u9fff]/u.test(text) || exactLabels.some(item => item.referenceOnly))) return { kind: 'possible', machineIds: exactLabels.map(item => item.id), text,
      label: exactLabels.length === 1 ? exactLabels[0].name : '' };
    const japaneseLabels = /[\u3040-\u30ff\u3400-\u9fff]/u.test(text)
      ? text.split(/[\n\r\/／]+/).flatMap(part => machineData?.labelMatches(part.trim()) || []) : [];
    let generalText = normalized;
    const specific = specificLabels.filter(item => {
      item.pattern.lastIndex = 0;
      const found = item.pattern.test(generalText);
      item.pattern.lastIndex = 0;
      if (found) generalText = generalText.replace(item.pattern, ' ');
      return found;
    });
    const curls = curlLabels.filter(item => item.pattern.test(generalText));
    if (!curls.length && genericCurl.pattern.test(generalText)) curls.push(genericCurl);
    const pulldowns = pulldownLabels.filter(item => item.pattern.test(generalText));
    if (!pulldowns.length && genericPulldown.pattern.test(generalText)) pulldowns.push(genericPulldown);
    const others = otherLabels.filter(item => item.pattern.test(item.without
      ? generalText.replace(item.without, ' ') : generalText));
    const matches = [...specific, ...curls, ...pulldowns, ...others,
      ...japaneseLabels.map(item => ({ ids: [item.id], label: item.name }))];
    return {
      kind: matches.length ? 'possible' : 'unknown',
      machineIds: [...new Set(matches.flatMap(item => item.ids))],
      text,
      label: matches.length === 1 ? matches[0].label : ''
    };
  }

  let libraryPromise;
  function loadOCR(vendor) {
    if (root.Tesseract) return Promise.resolve(root.Tesseract);
    if (!libraryPromise) {
      libraryPromise = new Promise((resolve, reject) => {
        const script = root.document.createElement('script');
        script.src = new URL('tesseract.min.js', vendor).href;
        script.onload = () => root.Tesseract
          ? resolve(root.Tesseract)
          : reject(new Error('Text recognition could not load.'));
        script.onerror = () => {
          script.remove();
          reject(new Error('Text recognition could not load.'));
        };
        root.document.head.append(script);
      }).catch(error => {
        libraryPromise = undefined;
        throw error;
      });
    }
    return libraryPromise;
  }

  function isLocalImage(image) {
    if (typeof image === 'string') return /^data:image\/(?:jpeg|png|webp);base64,/i.test(image);
    return (root.HTMLCanvasElement && image instanceof root.HTMLCanvasElement)
      || (root.Blob && image instanceof root.Blob && image.type.startsWith('image/'));
  }

  async function recognize(image, { signal, onProgress } = {}) {
    if (!isLocalImage(image)) throw new Error('Choose a local photo to read its label.');
    const abortError = () => new DOMException('Label reading cancelled.', 'AbortError');
    if (signal?.aborted) throw abortError();

    const vendor = new URL('vendor/ocr/', root.document.baseURI);
    let worker;
    const terminate = async () => {
      const active = worker;
      worker = null;
      await active?.terminate().catch(() => {});
    };
    let abort;
    const cancelled = signal && new Promise((_, reject) => {
      abort = () => reject(abortError());
      signal.addEventListener('abort', abort, { once: true });
    });
    const job = (async () => {
      const ocr = await loadOCR(vendor);
      if (signal?.aborted) throw abortError();
      let reportInitializationError;
      const initializationError = new Promise((_, reject) => {
        reportInitializationError = error => reject(new Error(String(error)));
      });
      const initializing = ocr.createWorker('eng', 1, {
        workerPath: new URL('worker.min.js', vendor).href,
        corePath: new URL('tesseract-core-lstm.wasm.js', vendor).href,
        langPath: new URL('lang/', vendor).href,
        workerBlobURL: false,
        errorHandler: reportInitializationError,
        logger: update => { if (!signal?.aborted) onProgress?.(update); }
      });
      worker = await Promise.race([initializing, initializationError]);
      if (signal?.aborted) {
        await terminate();
        throw abortError();
      }
      await worker.setParameters({ tessedit_pageseg_mode: ocr.PSM.SPARSE_TEXT });
      if (signal?.aborted) throw abortError();
      const { data } = await worker.recognize(image);
      return parse(data?.text);
    })();
    try {
      return await (cancelled ? Promise.race([job, cancelled]) : job);
    } finally {
      if (abort) signal.removeEventListener('abort', abort);
      await terminate();
    }
  }

  return Object.freeze({ parse, recognize });
});
