import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGuardianPhases, ringAnchors, ringId, ANCHOR_RADIUS, PHASE_COUNT, RING_SIZE,
} from '../js/logic/bossphases.js';
import { WAYPOINTS, BOSS } from '../js/logic/script.js';
import { createSpline } from '../js/logic/spline.js';

const killRing = (m, action) => {
  let last = null;
  for (const id of action.ids) last = m.weakpointHit(id);
  return last;
};

test('scripted phases advance 1-2-3 and timeout defeats', () => {
  const m = createGuardianPhases();
  assert.equal(m.phase(), 0);
  for (const n of [1, 2, 3]) {
    const a = m.phaseEvent(n);
    assert.equal(a.open, n);
    assert.equal(a.early, false);
    assert.equal(a.ids.length, RING_SIZE);
    assert.equal(m.remaining(), RING_SIZE);
  }
  const end = m.timeout();
  assert.equal(end.defeated, true);
  assert.equal(end.timedOut, true);
  assert.equal(m.defeated(), true);
});

test('destroying a full ring advances early with the next ring open', () => {
  const m = createGuardianPhases();
  const a1 = m.phaseEvent(1);
  assert.equal(m.weakpointHit(a1.ids[0]), null);
  assert.equal(m.weakpointHit(a1.ids[1]), null);
  const a2 = m.weakpointHit(a1.ids[2]);
  assert.equal(a2.open, 2);
  assert.equal(a2.early, true);
  assert.equal(m.phase(), 2);
});

test('stale scripted events after an early advance are ignored', () => {
  const m = createGuardianPhases();
  killRing(m, m.phaseEvent(1));
  assert.equal(m.phase(), 2);
  assert.equal(m.phaseEvent(1), null);
  assert.equal(m.phaseEvent(2), null); // incl. the guardian's own re-emit
  const a3 = m.phaseEvent(3);
  assert.equal(a3.open, 3);
});

test('destroying all three rings defeats without a timeout', () => {
  const m = createGuardianPhases();
  let action = m.phaseEvent(1);
  action = killRing(m, action);
  assert.equal(action.open, 2);
  action = killRing(m, action);
  assert.equal(action.open, 3);
  action = killRing(m, action);
  assert.equal(action.defeated, true);
  assert.equal(action.timedOut, false);
  assert.equal(m.defeated(), true);
  assert.equal(m.timeout(), null);
  assert.equal(m.phaseEvent(3), null);
});

test('hits on unknown or already-destroyed weakpoints do nothing', () => {
  const m = createGuardianPhases();
  assert.equal(m.weakpointHit(ringId(1, 0)), null); // dormant
  const a = m.phaseEvent(1);
  assert.equal(m.weakpointHit('drone-p7'), null);
  m.weakpointHit(a.ids[0]);
  assert.equal(m.weakpointHit(a.ids[0]), null); // repeat hit
  assert.equal(m.remaining(), 2);
});

test('a scripted advance retires the unfinished ring', () => {
  const m = createGuardianPhases();
  const a1 = m.phaseEvent(1);
  m.weakpointHit(a1.ids[0]);
  const a2 = m.phaseEvent(2);
  assert.equal(a2.open, 2);
  assert.equal(m.weakpointHit(a1.ids[1]), null); // old ring is dead
  assert.equal(m.remaining(), RING_SIZE);
});

test('timeout mid-ring defeats exactly once', () => {
  const m = createGuardianPhases();
  m.phaseEvent(1);
  m.phaseEvent(2);
  m.phaseEvent(3);
  const m3 = createGuardianPhases();
  m3.phaseEvent(1);
  assert.equal(m3.timeout().defeated, true);
  assert.equal(m3.timeout(), null);
  assert.equal(m.timeout().defeated, true);
});

test('out-of-range phase events are ignored', () => {
  const m = createGuardianPhases();
  assert.equal(m.phaseEvent(0), null);
  assert.equal(m.phaseEvent(PHASE_COUNT + 1), null);
  assert.equal(m.phaseEvent(1.5), null);
  assert.equal(m.phase(), 0);
});

// geometry: every anchor must stay on the rail-facing side of the Guardian
// through its whole phase window, and within comfortable bolt range
test('ring anchors face the rail sector of their phase window', () => {
  const spline = createSpline(WAYPOINTS);
  const anchors = ringAnchors(spline, BOSS);
  assert.equal(anchors.length, PHASE_COUNT);
  const { center, phaseAt, timeoutAt } = BOSS;
  const windows = phaseAt.map((d, i) => [d, phaseAt[i + 1] ?? timeoutAt]);
  const railAngle = (d) => {
    const p = spline.pointAt(d);
    return Math.atan2(p.x - center.x, -(p.z - center.z));
  };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  anchors.forEach((ring, pi) => {
    assert.equal(ring.length, RING_SIZE);
    for (const a of ring) {
      const r = Math.hypot(a.x - center.x, a.z - center.z);
      assert.ok(Math.abs(r - ANCHOR_RADIUS) < 1e-9);
      let minDist = Infinity;
      for (let d = windows[pi][0]; d <= windows[pi][1]; d += 2) {
        const rel = Math.abs(wrap(a.angle - railAngle(d)));
        assert.ok(rel < 1.35, `phase ${pi + 1} anchor drifts behind the body (rel ${rel.toFixed(2)})`);
        const p = spline.pointAt(d);
        minDist = Math.min(minDist, Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z));
      }
      assert.ok(minDist < 20, `phase ${pi + 1} anchor never comes in range (${minDist.toFixed(1)}m)`);
    }
  });
});

test('anchor rings climb the construct phase by phase', () => {
  const anchors = ringAnchors(createSpline(WAYPOINTS), BOSS);
  const ys = anchors.map((ring) => ring[0].y);
  assert.ok(ys[0] < ys[1] && ys[1] < ys[2]);
});
