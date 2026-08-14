import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TARGET_VALUES, createScore, loadBest, saveBest } from '../js/logic/scoring.js';

test('hit awards base value at x1', () => {
  const s = createScore();
  assert.equal(s.hit('asteroid'), 25);
  assert.equal(s.score(), 25);
});

test('multiplier steps at 5-hit streaks and caps at 4', () => {
  const s = createScore();
  for (let i = 0; i < 5; i++) s.hit('crate');
  assert.equal(s.multiplier(), 2);
  assert.equal(s.hit('crate'), 20);
  for (let i = 0; i < 30; i++) s.hit('crate');
  assert.equal(s.multiplier(), 4);
});

test('miss resets streak but not score', () => {
  const s = createScore();
  for (let i = 0; i < 6; i++) s.hit('crate');
  const before = s.score();
  s.miss();
  assert.equal(s.multiplier(), 1);
  assert.equal(s.score(), before);
});

test('best score round-trips through storage and only improves', () => {
  const store = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = String(v); } };
  assert.equal(loadBest(store), 0);
  assert.equal(saveBest(store, 500), true);
  assert.equal(saveBest(store, 300), false);
  assert.equal(loadBest(store), 500);
});
