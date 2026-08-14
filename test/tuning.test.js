import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TUNING_DEFAULTS, createTuning } from '../js/logic/tuning.js';

test('defaults when absent', () => {
  const tuning = createTuning('');
  for (const key of Object.keys(TUNING_DEFAULTS)) {
    assert.equal(tuning.get(key), TUNING_DEFAULTS[key]);
  }
  assert.deepEqual(tuning.overrides(), []);
});

test('numeric override applies', () => {
  const tuning = createTuning('?cooldownMs=150&thrFactor=0.22');
  assert.equal(tuning.get('cooldownMs'), 150);
  assert.equal(tuning.get('thrFactor'), 0.22);
  assert.equal(tuning.get('thrMin'), TUNING_DEFAULTS.thrMin, 'unrelated keys stay default');
});

test('junk values ignored, defaults kept', () => {
  const tuning = createTuning('?cooldownMs=abc&thrFactor=-1&boltSpeed=0&thrMax=NaN');
  assert.equal(tuning.get('cooldownMs'), TUNING_DEFAULTS.cooldownMs);
  assert.equal(tuning.get('thrFactor'), TUNING_DEFAULTS.thrFactor);
  assert.equal(tuning.get('boltSpeed'), TUNING_DEFAULTS.boltSpeed);
  assert.equal(tuning.get('thrMax'), TUNING_DEFAULTS.thrMax);
  assert.deepEqual(tuning.overrides(), []);
});

test('unknown keys ignored', () => {
  const tuning = createTuning('?foo=5&thrFactor=0.3');
  assert.equal(tuning.get('foo'), undefined);
  assert.equal(tuning.get('thrFactor'), 0.3);
  assert.deepEqual(tuning.overrides(), [{ key: 'thrFactor', value: 0.3 }]);
});

test('overrides() lists exactly the applied ones, in TUNING_DEFAULTS key order', () => {
  const tuning = createTuning('?cooldownMs=150&thrFactor=0.22&junk=abc');
  assert.deepEqual(tuning.overrides(), [
    { key: 'thrFactor', value: 0.22 },
    { key: 'cooldownMs', value: 150 },
  ]);
});
