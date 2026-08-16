import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseParams } from '../js/logic/params.js';

test('parses debug params', () => {
  assert.deepEqual(parseParams('?desktop&dist=800&speed=8'),
    { desktop: true, debug: false, dist: 800, speed: 8 });
});

test('defaults with empty or junk input', () => {
  assert.deepEqual(parseParams(''), { desktop: false, debug: false, dist: 0, speed: 1 });
  assert.deepEqual(parseParams('?dist=abc&speed=-2'),
    { desktop: false, debug: false, dist: 0, speed: 1 });
});

test('debug is independent of desktop', () => {
  assert.deepEqual(parseParams('?debug'),
    { desktop: false, debug: true, dist: 0, speed: 1 });
  assert.deepEqual(parseParams('?desktop&debug'),
    { desktop: true, debug: true, dist: 0, speed: 1 });
});
