import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeightSampler } from '../js/logic/heights.js';

test('stable() is 0 with no samples', () => {
  assert.equal(createHeightSampler().stable(), 0);
});

test('stable() near the top of the sample distribution', () => {
  const s = createHeightSampler();
  for (let i = 0; i < 100; i++) s.addSample(1.5 + (i % 10) * 0.01);
  const v = s.stable();
  assert.ok(v >= 1.57 && v <= 1.6);
});

test('ignores absurd samples', () => {
  const s = createHeightSampler();
  s.addSample(1.6); s.addSample(0.05); s.addSample(9);
  assert.equal(s.count(), 1);
});
