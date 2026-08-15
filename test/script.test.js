import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS, WAYPOINTS } from '../js/logic/script.js';
import { createSpline } from '../js/logic/spline.js';

const spawns = (type, a, b) =>
  EVENTS.filter((e) => e.type === 'spawn' && e.target === type && e.at >= a && e.at < b);

test('departure corridor carries 10 near-rail crates', () => {
  const crates = spawns('crate', 0, 180);
  assert.equal(crates.length, 10);
  const spline = createSpline(WAYPOINTS);
  for (const c of crates) {
    const p = spline.pointAt(c.at);
    const lateral = Math.hypot(p.x - c.pos[0], p.y - c.pos[1]);
    assert.ok(lateral <= 4, `crate at=${c.at} is ${lateral.toFixed(1)}m off-rail`);
  }
});

test('asteroid field carries 25 asteroids and 8 drones', () => {
  assert.equal(spawns('asteroid', 180, 540).length, 25);
  assert.equal(spawns('drone', 180, 540).length, 8);
});

test('field density ramps toward the derelict', () => {
  const first = spawns('asteroid', 180, 300).length + spawns('drone', 180, 300).length;
  const last = spawns('asteroid', 420, 540).length + spawns('drone', 420, 540).length;
  assert.ok(last >= first * 1.5, `expected a ramp, got ${first} then ${last}`);
});
