import { test } from 'node:test';
import assert from 'node:assert/strict';
import { throwThreshold, createHandTracker } from '../js/logic/firing.js';

const HEAD = { x: 0, y: 1.6, z: 0 };
const hand = (z, y = 1.4) => ({ x: 0.2, y, z });

test('threshold scales with height and clamps', () => {
  assert.equal(throwThreshold(1.8), 0.162 * 1.8);
  assert.equal(throwThreshold(0.6), 0.135);
  assert.equal(throwThreshold(2.5), 0.36);
  assert.equal(throwThreshold(0), 0.225);
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

test('custom rearmFrac changes how far back the hand must pull to re-arm', () => {
  function armedAtStep(rearmFrac) {
    const tr = createHandTracker({ threshold: 0.3, cooldownMs: 0, rearmFrac });
    let t = 0, fires = 0, armedStep = null;
    const feed = (z) => { if (tr.update({ headPos: HEAD, handPos: hand(z), t: t += 20 })) fires++; };
    for (let z = -0.2; z > -0.75; z -= 0.05) feed(z);
    assert.equal(fires, 1);
    let step = 0;
    for (let z = -0.75; z < -0.2; z += 0.02) {
      feed(z);
      step++;
      if (tr.state() === 'armed' && armedStep === null) armedStep = step;
    }
    return armedStep;
  }
  const shallow = armedAtStep(0.2);
  const deep = armedAtStep(0.5);
  assert.ok(shallow < deep, 'a smaller rearmFrac re-arms after less pull-back than the default');
});

// The rig moves ~0.1m per 60fps frame at the shipped 6m/s rail speed.
function railCycles(handFollowsRig) {
  const tr = makeTracker();
  let fires = 0, t = 0, rail = 0;
  const feed = (z) => {
    rail -= 0.1;
    const h = { x: HEAD.x, y: HEAD.y, z: HEAD.z + rail };
    const p = hand(z);
    if (handFollowsRig) p.z += rail;
    if (tr.update({ headPos: h, handPos: p, t: t += 20 })) fires++;
  };
  for (let cycle = 0; cycle < 3; cycle++) {
    for (let z = -0.2; z > -0.75; z -= 0.05) feed(z);
    for (let z = -0.75; z < -0.2; z += 0.05) feed(z);
    t += 300;
  }
  return { fires, state: tr.state() };
}

test('throws keep working while the rig travels down the rail', () => {
  assert.equal(railCycles(true).fires, 3, 'one throw per cycle, rail motion cancels out');
});

test('a hand left behind in reference space jams the tracker for good', () => {
  // Why hand-thrower applies the rig transform to wristObject3D: with the head
  // on the rail and the hand not, displacement only ever grows, so re-arm
  // (which needs it to shrink) can never happen again.
  const { fires, state } = railCycles(false);
  assert.equal(fires, 1, 'one phantom bolt at launch, then nothing for the rest of the ride');
  assert.equal(state, 'recovering', 'latched, never re-arms');
});

test('low-confidence frames do not lower the baseline', () => {
  const tr = makeTracker();
  let t = 0;
  tr.update({ headPos: HEAD, handPos: hand(-0.4), confident: true, t: t += 20 });
  tr.update({ headPos: HEAD, handPos: hand(-0.05), confident: false, t: t += 20 });
  const fire = tr.update({ headPos: HEAD, handPos: hand(-0.55), confident: true, t: t += 20 });
  assert.equal(fire, null, 'displacement measured from confident baseline only');
});
