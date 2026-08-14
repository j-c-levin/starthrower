import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aimDirection, snapToTarget, segmentHit, armRayDir, armOffsets } from '../js/logic/aim.js';

const O = { x: 0, y: 0, z: 0 };
const HEAD = { x: 0, y: 1.6, z: 0 };
const HEIGHT = 1.8; // -> down 0.234, lateral 0.162 per armOffsets

// mirrors armRayDir's internal yaw rotation, for building "same pose,
// rotated" fixtures in the tests below
const rotateY = (v, yawRad) => {
  const cos = Math.cos(yawRad);
  const sin = Math.sin(yawRad);
  return { x: v.x * cos + v.z * sin, y: v.y, z: -v.x * sin + v.z * cos };
};
const addV = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

function shoulderAt(yawRad, side) {
  const { down, lateral } = armOffsets(HEIGHT);
  const sign = side === 'left' ? -1 : 1;
  const lateralOffset = rotateY({ x: sign * lateral, y: 0, z: 0 }, yawRad);
  return { x: HEAD.x + lateralOffset.x, y: HEAD.y - down, z: HEAD.z + lateralOffset.z };
}

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

test('armRayDir: right hand straight forward at shoulder height, yaw 0', () => {
  const shoulder = shoulderAt(0, 'right');
  const hand = { x: shoulder.x, y: shoulder.y, z: shoulder.z - 0.5 };
  const dir = armRayDir(HEAD, 0, hand, 'right', HEIGHT);
  assert.ok(Math.abs(dir.x - 0) < 0.1);
  assert.ok(Math.abs(dir.y - 0) < 0.1);
  assert.ok(Math.abs(dir.z - -1) < 0.1);
});

test('armRayDir: hand out to the right side has a strong +x component', () => {
  const shoulder = shoulderAt(0, 'right');
  const hand = { x: shoulder.x + 0.5, y: shoulder.y, z: shoulder.z };
  const dir = armRayDir(HEAD, 0, hand, 'right', HEIGHT);
  assert.ok(dir.x > 0.9, 'direction points strongly to the right');
});

test('armRayDir: yawing the head yaws the shoulder offset (same pose, rotated)', () => {
  const yaw = Math.PI / 2;
  const localForwardOffset = { x: 0, y: 0, z: -0.5 }; // "straight forward" from the shoulder

  const shoulder0 = shoulderAt(0, 'right');
  const dir0 = armRayDir(HEAD, 0, addV(shoulder0, localForwardOffset), 'right', HEIGHT);

  const shoulder90 = shoulderAt(yaw, 'right');
  const hand90 = addV(shoulder90, rotateY(localForwardOffset, yaw));
  const dir90 = armRayDir(HEAD, yaw, hand90, 'right', HEIGHT);

  const expected = rotateY(dir0, yaw);
  assert.ok(Math.abs(dir90.x - expected.x) < 1e-6);
  assert.ok(Math.abs(dir90.y - expected.y) < 1e-6);
  assert.ok(Math.abs(dir90.z - expected.z) < 1e-6);
  // matches the A-Frame convention directly: +90deg yaw turns forward toward -x
  assert.ok(Math.abs(dir90.x - -1) < 0.05);
  assert.ok(Math.abs(dir90.z - 0) < 0.05);
});

test('armRayDir: hand hanging low points the arm ray downward', () => {
  const shoulder = shoulderAt(0, 'right');
  const hand = { x: shoulder.x, y: shoulder.y - 0.8, z: shoulder.z };
  const dir = armRayDir(HEAD, 0, hand, 'right', HEIGHT);
  assert.ok(dir.y < -0.9, 'a hand hanging below the shoulder correctly aims down');
});

test('armOffsets falls back to fixed values without a calibrated height', () => {
  assert.deepEqual(armOffsets(0), { down: 0.22, lateral: 0.15 });
});
