import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aimDirection, snapToTarget, segmentHit } from '../js/logic/aim.js';

const O = { x: 0, y: 0, z: 0 };

test('aimDirection normalizes head-through-hand', () => {
  const d = aimDirection(O, { x: 0, y: 0, z: -2 });
  assert.deepEqual(d, { x: 0, y: 0, z: -1 });
});

test('snap picks nearest-angle target inside cone', () => {
  const targets = [
    { id: 'a', pos: { x: 0.5, y: 0, z: -10 }, radius: 0.5 },
    { id: 'b', pos: { x: 4, y: 0, z: -10 }, radius: 0.5 },
  ];
  const r = snapToTarget(O, { x: 0, y: 0, z: -1 }, targets, 6);
  assert.equal(r.targetId, 'a');
  assert.ok(r.dir.x > 0.01, 'direction snapped toward target center');
});

test('no snap outside cone', () => {
  const targets = [{ id: 'a', pos: { x: 5, y: 0, z: -10 }, radius: 0.5 }];
  const r = snapToTarget(O, { x: 0, y: 0, z: -1 }, targets, 6);
  assert.equal(r.targetId, null);
  assert.deepEqual(r.dir, { x: 0, y: 0, z: -1 });
});

test('segmentHit finds sphere on path, nearest first', () => {
  const targets = [
    { id: 'far', pos: { x: 0, y: 0, z: -20 }, radius: 1 },
    { id: 'near', pos: { x: 0, y: 0, z: -5 }, radius: 1 },
  ];
  assert.equal(segmentHit(O, { x: 0, y: 0, z: -30 }, targets), 'near');
  assert.equal(segmentHit(O, { x: 0, y: 0, z: -3 }, targets), null);
  assert.equal(segmentHit(O, { x: 10, y: 0, z: -30 }, targets), null);
});
