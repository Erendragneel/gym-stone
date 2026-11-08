(function (root, factory) {
  'use strict';
  const references = factory(() => root.localStorage);
  if (typeof module === 'object' && module.exports) module.exports = references;
  if (root) root.GymMachineReferences = references;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (getStorage) {
  'use strict';

  // Versioned for the normalized 512-component CLIP ViT-B/32 q8 output.
  const KEY_PREFIX = 'gym-stone-machine-clip-b32-q8-v1:';
  const DIMENSIONS = 512;
  const MAX_REFERENCES = 24;
  const MAX_PER_CATEGORY = 3;
  const MIN_SIMILARITY = 0.90;
  const MIN_MARGIN = 0.045;

  function storageKey(scope) {
    return typeof scope === 'string' && scope.length && scope.length <= 160 ? KEY_PREFIX + scope : null;
  }

  function validId(id) {
    return typeof id === 'string' && /^[a-z0-9-]{1,80}$/.test(id);
  }

  function normalize(embedding) {
    if (!Array.isArray(embedding) || embedding.length !== DIMENSIONS || !embedding.every(Number.isFinite)) return null;
    const magnitude = Math.hypot(...embedding);
    return Number.isFinite(magnitude) && magnitude > 0 ? embedding.map(value => value / magnitude) : null;
  }

  function similarity(left, right) {
    return left.reduce((sum, value, index) => sum + value * right[index], 0);
  }

  function read(key) {
    if (!key) return [];
    try {
      const raw = getStorage().getItem(key);
      if (!raw || raw.length > 250000) return [];
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved)) return [];
      return saved.slice(0, MAX_REFERENCES).flatMap(record => {
        if (!validId(record?.id)) return [];
        const embedding = normalize(record.embedding);
        return embedding ? [{ id: record.id, embedding }] : [];
      });
    } catch {
      return [];
    }
  }

  function write(key, entries) {
    if (!key) return false;
    try {
      if (entries.length) {
        getStorage().setItem(key, JSON.stringify(entries.map(({ id, embedding }) => ({
          id, embedding: embedding.map(value => Math.round(value * 100000) / 100000)
        }))));
      } else {
        getStorage().removeItem(key);
      }
      return true;
    } catch {
      return false;
    }
  }

  function remember(scope, id, embedding) {
    const key = storageKey(scope);
    const unit = normalize(embedding);
    if (!key || !validId(id) || !unit) return false;
    let retained = 1;
    const entries = read(key).filter(record => {
      // Remembering the same view under a corrected label replaces the old label.
      if (similarity(unit, record.embedding) >= 0.998) return false;
      if (record.id !== id) return true;
      if (retained >= MAX_PER_CATEGORY) return false;
      retained++;
      return true;
    });
    return write(key, [{ id, embedding: unit }, ...entries].slice(0, MAX_REFERENCES));
  }

  function match(scope, embedding) {
    const unit = normalize(embedding);
    if (!unit) return null;
    const scores = new Map();
    for (const record of read(storageKey(scope))) {
      const score = similarity(unit, record.embedding);
      if (score > (scores.get(record.id) ?? -Infinity)) scores.set(record.id, score);
    }
    const [best, next] = [...scores].sort((left, right) => right[1] - left[1]);
    if (!best || best[1] < MIN_SIMILARITY || (next && best[1] - next[1] < MIN_MARGIN)) return null;
    return { id: best[0], score: Math.min(1, best[1]) };
  }

  function count(scope) {
    return read(storageKey(scope)).length;
  }

  function clear(scope) {
    return write(storageKey(scope), []);
  }

  return Object.freeze({ remember, match, count, clear });
});
