import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpline } from '../js/logic/spline.js';

const close = (a, b, eps = 0.05) => Math.abs(a - b) < eps;

test('straight line has correct length and midpoint', () => {
  const s = createSpline([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -100 }]);
  assert.ok(close(s.length, 100, 0.5));
  const mid = s.pointAt(50);
  assert.ok(close(mid.z, -50, 0.5) && close(mid.x, 0) && close(mid.y, 0));
});

test('pointAt clamps beyond ends', () => {
  const s = createSpline([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -10 }]);
  assert.ok(close(s.pointAt(-5).z, 0, 0.1));
  assert.ok(close(s.pointAt(999).z, -10, 0.1));
});

test('tangent is normalized and points along travel', () => {
  const s = createSpline([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -100 }]);
  const t = s.tangentAt(50);
  assert.ok(close(Math.hypot(t.x, t.y, t.z), 1, 0.01));
  assert.ok(t.z < -0.99);
});

test('curved path length exceeds chord', () => {
  const s = createSpline([
    { x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: -30 }, { x: 0, y: 0, z: -60 },
  ]);
  assert.ok(s.length > 60);
});
