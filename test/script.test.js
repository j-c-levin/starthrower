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

test('derelict carries 12 windowed popups and 6 breach drones', () => {
  const popups = spawns('popup', 540, 900);
  assert.equal(popups.length, 12);
  assert.equal(spawns('drone', 540, 900).length, 6);
  for (const p of popups) {
    assert.ok(p.period >= 3 && p.period <= 5, `popup at=${p.at} period ${p.period}`);
    assert.ok(p.duty >= 0.4 && p.duty <= 0.6, `popup at=${p.at} duty ${p.duty}`);
  }
});

// mirrors the runtime model: clock starts at deploy (at-40m), retire 30m behind,
// up while frac(elapsed/period) < duty
test('derelict popup cadence keeps targets up through every pass', () => {
  const popups = spawns('popup', 540, 900);
  for (let i = 0; i + 1 < popups.length; i++) {
    assert.ok(popups[i + 1].at - popups[i].at <= 35,
      `gap ${popups[i].at}->${popups[i + 1].at} leaves the pass empty`);
  }
  const upAt = (p, t) => {
    const born = (p.at - 40) / 6;
    return t >= born && t <= (p.at + 30) / 6 && ((t - born) / p.period) % 1 < p.duty;
  };
  for (const p of popups) {
    assert.ok(upAt(p, p.at / 6), `popup at=${p.at} is down as the player passes it`);
  }
  let sum = 0, n = 0;
  for (let t = 585 / 6; t <= 885 / 6; t += 0.2) {
    const up = popups.filter((p) => upAt(p, t)).length;
    assert.ok(up >= 1, `no popup up at t=${t.toFixed(1)}s (d=${(t * 6).toFixed(0)}m)`);
    sum += up; n++;
  }
  assert.ok(sum / n >= 1.5, `average up-count ${(sum / n).toFixed(2)} < 1.5`);
});

test('the rail dives through the derelict break and recovers', () => {
  const spline = createSpline(WAYPOINTS);
  let minY = Infinity;
  for (let d = 540; d <= 900; d += 2) minY = Math.min(minY, spline.pointAt(d).y);
  assert.ok(minY < -2, `expected a dive below -2m, got ${minY.toFixed(1)}`);
  assert.ok(Math.abs(spline.pointAt(905).y - 2) < 0.5, 'rail must level out before the boss');
});

test('field density ramps toward the derelict', () => {
  const first = spawns('asteroid', 180, 300).length + spawns('drone', 180, 300).length;
  const last = spawns('asteroid', 420, 540).length + spawns('drone', 420, 540).length;
  assert.ok(last >= first * 1.5, `expected a ramp, got ${first} then ${last}`);
});
