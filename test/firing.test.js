import { test } from 'node:test';
import assert from 'node:assert/strict';
import { throwThreshold, createHandTracker } from '../js/logic/firing.js';

const HEAD = { x: 0, y: 1.6, z: 0 };
const hand = (z, y = 1.4) => ({ x: 0.2, y, z });

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const normalize = (v) => {
  const m = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / m, y: v.y / m, z: v.z / m };
};

test('threshold scales with height and clamps', () => {
  assert.equal(throwThreshold(1.8), 0.18 * 1.8);
  assert.equal(throwThreshold(0.6), 0.15);
  assert.equal(throwThreshold(2.5), 0.4);
  assert.equal(throwThreshold(0), 0.25);
});

function makeTracker() {
  return createHandTracker({ threshold: 0.3, cooldownMs: 250 });
}

test('fires after radial displacement exceeds threshold', () => {
  const tr = makeTracker();
  let fire = null;
  for (let i = 0; i <= 10; i++) {
    fire = tr.update({ headPos: HEAD, handPos: hand(-0.2 - i * 0.05), t: i * 20 });
    if (fire) break;
  }
  assert.ok(fire, 'should have fired');
  assert.ok(fire.origin.z < -0.3, 'origin is the hand position, not the head');
  assert.ok(fire.dir, 'returns a fire direction');
});

test('does not fire twice while extended; re-arms after pull-back', () => {
  const tr = makeTracker();
  let fires = 0, t = 0;
  const feed = (z) => { if (tr.update({ headPos: HEAD, handPos: hand(z), t: t += 20 })) fires++; };
  for (let z = -0.2; z > -0.75; z -= 0.05) feed(z);
  assert.equal(fires, 1);
  for (let i = 0; i < 10; i++) feed(-0.7);
  assert.equal(fires, 1, 'held-out arm must not refire');
  for (let z = -0.7; z < -0.3; z += 0.05) feed(z);
  t += 300;
  for (let z = -0.3; z > -0.75; z -= 0.05) feed(z);
  assert.equal(fires, 2, 'second throw after re-arm');
});

test('cooldown blocks immediate refire even if re-armed', () => {
  const tr = createHandTracker({ threshold: 0.1, cooldownMs: 250 });
  let fires = 0, t = 0;
  const feed = (z) => { if (tr.update({ headPos: HEAD, handPos: hand(z), t: t += 5 })) fires++; };
  for (let cycle = 0; cycle < 3; cycle++) {
    for (let z = -0.2; z > -0.5; z -= 0.05) feed(z);
    for (let z = -0.5; z < -0.2; z += 0.05) feed(z);
  }
  assert.equal(fires, 1, 'rapid cycles inside cooldown fire once');
});

test('low-confidence crossing fires at last good smoothed pose', () => {
  const tr = makeTracker();
  let fire = null, t = 0;
  for (let z = -0.2; z > -0.4; z -= 0.05) {
    fire = tr.update({ headPos: HEAD, handPos: hand(z), confident: true, t: t += 20 });
  }
  assert.equal(fire, null);
  fire = tr.update({ headPos: HEAD, handPos: hand(-0.9), confident: false, t: t += 20 });
  assert.ok(fire, 'crossing on low-confidence frame still fires');
  assert.ok(fire.origin.z > -0.5, 'aim pose comes from confident frames, not the jitter frame');
});

test('low-confidence frames do not lower the baseline', () => {
  const tr = makeTracker();
  let t = 0;
  tr.update({ headPos: HEAD, handPos: hand(-0.4), confident: true, t: t += 20 });
  tr.update({ headPos: HEAD, handPos: hand(-0.05), confident: false, t: t += 20 });
  const fire = tr.update({ headPos: HEAD, handPos: hand(-0.55), confident: true, t: t += 20 });
  assert.equal(fire, null, 'displacement measured from confident baseline only');
});

test('straight motion aim follows the travel direction, not the head-hand line', () => {
  const tr = makeTracker();
  let fire = null, t = 0;
  // hand travels a straight line 0.2m below the head (x/y fixed, only z changes)
  for (let z = -0.1; z > -0.9; z -= 0.05) {
    fire = tr.update({ headPos: HEAD, handPos: hand(z), t: t += 20 });
    if (fire) break;
  }
  assert.ok(fire, 'should have fired');
  assert.equal(fire.dir.x, 0);
  assert.equal(fire.dir.y, 0, 'no downward slant even though the hand sits below the head');
  assert.ok(fire.dir.z < -0.99, 'direction points along the straight travel path');
});

test('overhand arc: dir follows the last ~100ms of motion, not the head-hand line', () => {
  const tr = makeTracker();
  let t = 0, fire = null, lastHand = null;

  // rest pose held long enough to fill the buffer and settle the baseline
  const rest = hand(0.1);
  for (let i = 0; i < 12 && !fire; i++) {
    lastHand = rest;
    fire = tr.update({ headPos: HEAD, handPos: rest, t: t += 20 });
  }
  assert.equal(fire, null, 'rest pose alone should not cross threshold');

  // throw: forward (-z) and slightly down (-y) from the rest pose
  for (let i = 1; i <= 8 && !fire; i++) {
    lastHand = { x: 0.2, y: 1.4 - 0.02 * i, z: 0.1 - 0.15 * i };
    fire = tr.update({ headPos: HEAD, handPos: lastHand, t: t += 20 });
  }

  assert.ok(fire, 'should have fired during the throw');

  const headHandDir = normalize(sub(lastHand, HEAD));
  assert.ok(
    Math.abs(fire.dir.x - headHandDir.x) > 0.1,
    'must not equal the head-hand line, which carries the earlier rest-pose offset'
  );
  assert.ok(Math.abs(fire.dir.x) < 0.05, 'recent motion had no sideways component');
  assert.ok(fire.dir.y < 0, 'direction follows the slightly-downward recent motion');
  assert.ok(fire.dir.z < -0.9, 'direction follows the forward swing');
});

test('degenerate (near-zero) recent motion falls back to the head-hand line', () => {
  const tr = makeTracker();
  let t = 0, fire = null, z = 0.1, lastHand = null;
  const CREEP = 0.003; // 1.5cm per 100ms window — under the 2cm degenerate floor

  for (let i = 0; i < 400 && !fire; i++) {
    z -= CREEP;
    lastHand = hand(z);
    fire = tr.update({ headPos: HEAD, handPos: lastHand, t: t += 20 });
  }

  assert.ok(fire, 'should have fired once the slow creep crosses threshold');
  const expected = normalize(sub(lastHand, HEAD));
  assert.ok(Math.abs(fire.dir.x - expected.x) < 1e-6);
  assert.ok(Math.abs(fire.dir.y - expected.y) < 1e-6);
  assert.ok(Math.abs(fire.dir.z - expected.z) < 1e-6);
});
