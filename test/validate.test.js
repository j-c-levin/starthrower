import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RIDE, SPEED } from '../js/logic/script.js';
import { validateRide } from '../js/logic/validate.js';

test('the shipped ride validates clean', () => {
  assert.deepEqual(validateRide(RIDE), []);
});

test('validator catches a hairpin', () => {
  const bad = { speed: SPEED, events: [{ at: 0, type: 'end' }], waypoints: [
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -20 }, { x: 1, y: 0, z: -2 },
  ] };
  assert.ok(validateRide(bad).some((e) => /yaw|revers/i.test(e)));
});

test('validator catches a steep climb (pitch)', () => {
  const bad = { speed: SPEED, events: [{ at: 0, type: 'end' }], waypoints: [
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -30 }, { x: 0, y: 18, z: -36 }, { x: 0, y: 18, z: -66 },
  ] };
  assert.ok(validateRide(bad).some((e) => /pitch/.test(e)));
});

test('validator catches unsorted and missing end', () => {
  const wp = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -100 }];
  assert.ok(validateRide({ speed: 6, waypoints: wp, events: [
    { at: 50, type: 'beat', name: 'departure' }, { at: 10, type: 'end' },
  ] }).length > 0);
  assert.ok(validateRide({ speed: 6, waypoints: wp, events: [
    { at: 10, type: 'beat', name: 'departure' },
  ] }).some((e) => /end/.test(e)));
});
